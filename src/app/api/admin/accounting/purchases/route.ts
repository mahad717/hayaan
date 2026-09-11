// Purchases (supplier restocks) — admin-only.
//   GET  ?from=&to=&limit=   list purchases
//   POST { supplier, productId, quantity, unitCost, purchaseDate?, reference?,
//          paymentStatus?, applyStock? }
// Records the purchase, optionally increments product.stock (audited), and
// writes the PURCHASE ledger group: inventory(+total) / cash-or-payable(-total).

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  auditChange,
  insertLedgerEntries,
  insertMovement,
  incrementStock,
  toCents,
  centsToMajor,
} from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("purchase_date", { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      purchases: (data ?? []).map((p: any) => ({
        id: p.id,
        supplier: p.supplier,
        productId: p.product_id,
        quantity: p.quantity,
        unitCost: Number(p.unit_cost ?? 0),
        totalCost: Number(p.total_cost ?? 0),
        purchaseDate: p.purchase_date,
        reference: p.reference,
        paymentStatus: p.payment_status,
        stockApplied: p.stock_applied,
      })),
    });
  }

  const purchases = await (await getDb()).purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    take: 200,
  });
  return NextResponse.json({
    purchases: purchases.map((p) => ({
      id: p.id,
      supplier: p.supplier,
      productId: p.productId,
      quantity: p.quantity,
      unitCost: p.unitCost,
      totalCost: p.totalCost,
      purchaseDate: p.purchaseDate.toISOString(),
      reference: p.reference,
      paymentStatus: p.paymentStatus,
      stockApplied: p.stockApplied,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const supplier = String(body.supplier ?? "").trim();
  const quantity = Math.floor(Number(body.quantity));
  const unitCost = Number(body.unitCost);
  if (!supplier) return NextResponse.json({ error: "Supplier is required." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive whole number." }, { status: 400 });
  }
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return NextResponse.json({ error: "Unit cost must be zero or greater." }, { status: 400 });
  }
  const productId = body.productId ? String(body.productId) : null;
  const totalCost = centsToMajor(toCents(unitCost) * quantity);
  const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();
  const paymentStatus = body.paymentStatus === "paid" ? "paid" : "unpaid";
  const applyStock = body.applyStock !== false && !!productId;
  const reference = body.reference ? String(body.reference).trim() : null;

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        supplier,
        product_id: productId,
        quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        purchase_date: isNaN(purchaseDate.getTime()) ? new Date().toISOString() : purchaseDate.toISOString(),
        reference,
        payment_status: paymentStatus,
        stock_applied: applyStock,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    try {
      if (applyStock && productId) {
        await incrementStock(productId, quantity);
        await insertMovement({
          productId,
          purchaseId: data!.id,
          movementType: "purchase",
          quantityDelta: quantity,
          unitCost,
        });
      }
      await insertLedgerEntries([
        {
          entryType: "purchase",
          account: "inventory",
          amountCents: toCents(totalCost),
          purchaseId: data!.id,
          productId,
          description: `Purchase from ${supplier} (${quantity} × $${unitCost.toFixed(2)})`,
        },
        {
          entryType: "purchase",
          account: paymentStatus === "paid" ? "cash" : "accounts_payable",
          amountCents: -toCents(totalCost),
          purchaseId: data!.id,
          description: paymentStatus === "paid" ? "Cash paid to supplier" : "Payable to supplier",
        },
      ], admin);
      await auditChange({
        actor: admin,
        entity: "purchase",
        entityId: data!.id,
        field: "purchase",
        oldValue: null,
        newValue: `${supplier}: ${quantity} × $${unitCost.toFixed(2)} (${paymentStatus}${applyStock ? ", stock applied" : ""})`,
      });
    } catch (acctErr) {
      console.error("[purchases] side-effects skipped:", acctErr);
    }
    return NextResponse.json({ ok: true, id: data!.id });
  }

  const db = await getDb();
  const purchase = await db.purchase.create({
    data: {
      supplier,
      productId,
      quantity,
      unitCost,
      totalCost,
      purchaseDate: isNaN(purchaseDate.getTime()) ? new Date() : purchaseDate,
      reference,
      paymentStatus,
      stockApplied: applyStock,
    },
  });
  try {
    if (applyStock && productId) {
      await incrementStock(productId, quantity);
      await insertMovement({
        productId,
        purchaseId: purchase.id,
        movementType: "purchase",
        quantityDelta: quantity,
        unitCost,
      });
    }
    await insertLedgerEntries([
      {
        entryType: "purchase",
        account: "inventory",
        amountCents: toCents(totalCost),
        purchaseId: purchase.id,
        productId,
        description: `Purchase from ${supplier} (${quantity} × $${unitCost.toFixed(2)})`,
      },
      {
        entryType: "purchase",
        account: paymentStatus === "paid" ? "cash" : "accounts_payable",
        amountCents: -toCents(totalCost),
        purchaseId: purchase.id,
        description: paymentStatus === "paid" ? "Cash paid to supplier" : "Payable to supplier",
      },
    ], admin);
    await auditChange({
      actor: admin,
      entity: "purchase",
      entityId: purchase.id,
      field: "purchase",
      oldValue: null,
      newValue: `${supplier}: ${quantity} × $${unitCost.toFixed(2)} (${paymentStatus}${applyStock ? ", stock applied" : ""})`,
    });
  } catch (acctErr) {
    console.error("[purchases] side-effects skipped:", acctErr);
  }
  return NextResponse.json({ ok: true, id: purchase.id });
}
