// POST /api/admin/accounting/refunds
// Record a refund against an order — admin-only.
//   { orderId, amount, restock? }
// Validates 0 < amount ≤ collected (payments or order total), accumulates
// orders.refund_amount, writes the REFUND ledger group (revenue adjustment,
// optional inventory restock at cost), and audits the change. Reconciliation
// flips to "Refunded" when the full amount is refunded.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  getPaidCents,
  insertLedgerEntries,
  insertMovement,
  incrementStock,
  auditChange,
  toCents,
  centsToMajor,
} from "@/lib/accounting";

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const orderId = String(body.orderId ?? "");
  const amount = Number(body.amount);
  const restock = body.restock !== false; // default true
  if (!orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Refund amount must be greater than zero." }, { status: 400 });
  }

  interface OrderRow {
    id: string;
    status: string;
    totalAmount: number;
    refundAmount: number;
    items: { productId: string | null; quantity: number }[];
  }
  let order: OrderRow | null = null;

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data } = await supabase
      .from("orders")
      .select("id, status, total_amount, refund_amount, items:order_items(product_id, quantity)")
      .eq("id", orderId)
      .single();
    if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    order = {
      id: data.id,
      status: data.status,
      totalAmount: Number(data.total_amount),
      refundAmount: Number((data as any).refund_amount ?? 0),
      items: ((data as any).items ?? []) as any,
    };
  } else {
    const db = await getDb();
    const o = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { productId: true, quantity: true } } },
    });
    if (!o) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    order = { id: o.id, status: o.status, totalAmount: o.totalAmount, refundAmount: o.refundAmount, items: o.items };
  }

  const collectedCents =
    (await getPaidCents(orderId)) ||
    (["paid", "shipped", "delivered"].includes(order.status) ? toCents(order.totalAmount) : 0);
  const alreadyC = toCents(order.refundAmount);
  const amountC = toCents(amount);
  if (alreadyC + amountC > collectedCents) {
    return NextResponse.json(
      {
        error: `Refund exceeds the collected amount. Collected $${centsToMajor(collectedCents).toFixed(2)}, already refunded $${centsToMajor(alreadyC).toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  const newRefundC = alreadyC + amountC;
  const newRefund = centsToMajor(newRefundC);
  const fullyRefunded = newRefundC >= collectedCents;

  try {
    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      const { error } = await supabase
        .from("orders")
        .update({
          refund_amount: newRefund,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) {
        if (isMissingAccountingSchema(error)) {
          return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      await (await getDb()).order.update({
        where: { id: orderId },
        data: { refundAmount: newRefund, refundedAt: new Date() },
      });
    }

    // Ledger: revenue adjustment −amount; optionally restock inventory +cost.
    const lines: Parameters<typeof insertLedgerEntries>[0] = [
      {
        entryType: "refund",
        account: "refunds",
        amountCents: -amountC,
        orderId,
        description: `Refund $${amount.toFixed(2)} on order ${orderId.slice(0, 8)}…`,
      },
    ];
    if (restock) {
      // Restock the original quantities (movements + product.stock). The
      // inventory VALUE side of the entry needs a reliable unit cost, which
      // historical orders may not have — movements carry null cost there and
      // no inventory ledger line is written (never guess, spec §15).
      for (const item of order.items) {
        if (item.productId) {
          await insertMovement({
            productId: item.productId,
            orderId,
            movementType: "refund_restock",
            quantityDelta: item.quantity,
            unitCost: null,
          });
          await incrementStock(item.productId, item.quantity);
        }
      }
    }
    await insertLedgerEntries(lines, admin);
    await auditChange({
      actor: admin,
      entity: "order",
      entityId: orderId,
      field: "refund_amount",
      oldValue: order.refundAmount,
      newValue: newRefund,
    });
    return NextResponse.json({ ok: true, refundAmount: newRefund, fullyRefunded });
  } catch (err: any) {
    if (isMissingAccountingSchema(err)) {
      return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
