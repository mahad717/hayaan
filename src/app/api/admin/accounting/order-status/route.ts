// POST /api/admin/accounting/order-status
// Admin order-status transition — admin-only. Used from the reconciliation
// view (e.g. cancel an order). Cancelling writes a CANCEL ledger reversal
// (revenue −, cogs +) so the ledger stays reconcilable with reports
// (cancelled orders are excluded from report revenue), optionally restocks,
// and audits the change.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  insertLedgerEntries,
  insertMovement,
  incrementStock,
  buildSaleLines,
  auditChange,
} from "@/lib/accounting";

const ALLOWED = new Set(["pending", "paid", "shipped", "delivered", "cancelled"]);

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
  const status = String(body.status ?? "");
  const restock = body.restock !== false; // default true on cancel
  if (!orderId || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "orderId and a valid status are required." }, { status: 400 });
  }

  interface OrderRow {
    id: string;
    status: string;
  }
  let order: OrderRow | null = null;
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data } = await supabase.from("orders").select("id, status").eq("id", orderId).single();
    if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    order = data as any;
  } else {
    const o = await (await getDb()).order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
    if (!o) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    order = o;
  }
  const existing = order as OrderRow;
  if (existing.status === status) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  try {
    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) {
        if (isMissingAccountingSchema(error)) {
          return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      await (await getDb()).order.update({ where: { id: orderId }, data: { status } });
    }

    if (status === "cancelled") {
      // Reversal entries so ledger ≡ reports: reports exclude cancelled
      // orders from revenue, so the original SALE group gets its inverse.
      try {
        const { lines, subtotalCents } = await buildSaleLines(orderId);
        if (subtotalCents > 0) {
          let cogsC = lines.reduce((s, l) => s + (l.unitCost != null ? l.unitCost : 0) * l.quantity, 0);
          const entries: Parameters<typeof insertLedgerEntries>[0] = [
            {
              entryType: "cancel",
              account: "revenue",
              amountCents: -subtotalCents,
              orderId,
              description: `Order cancelled — revenue reversal (${orderId.slice(0, 8)}…)`,
            },
          ];
          if (cogsC > 0) {
            entries.push({
              entryType: "cancel",
              account: "cogs",
              amountCents: cogsC,
              orderId,
              description: "Order cancelled — COGS reversal",
            });
          }
          await insertLedgerEntries(entries, admin);
        }
      } catch (acctErr) {
        console.error("[order-status] cancel reversal skipped:", acctErr);
      }
      if (restock) {
        const { lines } = await buildSaleLines(orderId);
        for (const l of lines) {
          if (l.productId) {
            await insertMovement({
              productId: l.productId,
              orderId,
              movementType: "adjustment",
              quantityDelta: l.quantity,
              unitCost: l.unitCost,
            });
            await incrementStock(l.productId, l.quantity);
          }
        }
      }
    }

    await auditChange({
      actor: admin,
      entity: "order",
      entityId: orderId,
      field: "status",
      oldValue: existing.status,
      newValue: status,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingAccountingSchema(err)) {
      return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
