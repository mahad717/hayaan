// GET /api/admin/accounting/reconciliation?from=<ISO>&to=<ISO>
// Orders vs payments for the picked period (admin-only). Difference =
// actual − expected; recon status derived per spec §6. Legacy orders with
// no payments rows fall back to their order status (no data mutation).

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  toCents,
  centsToMajor,
} from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const now = new Date();
  const from = req.nextUrl.searchParams.get("from")
    ? new Date(req.nextUrl.searchParams.get("from") as string)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.nextUrl.searchParams.get("to") ? new Date(req.nextUrl.searchParams.get("to") as string) : now;
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.rpc("accounting_recon", {
      from_ts: from.toISOString(),
      to_ts: to.toISOString(),
    });
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      rows: (data ?? []).map((r: any) => ({
        orderId: r.order_id,
        customer: r.customer,
        orderTotal: Number(r.order_total ?? 0),
        expectedPayment: Number(r.expected_payment ?? 0),
        actualPayment: Number(r.actual_payment ?? 0),
        difference: Number(r.difference ?? 0),
        paymentMethod: r.payment_method,
        paymentReference: r.payment_reference,
        paymentStatus: r.payment_status,
        reconStatus: r.recon_status,
        orderStatus: r.order_status,
        orderDate: r.order_date,
        refunded: Number(r.refunded ?? 0),
      })),
    });
  }

  // Local Prisma derivation (mirrors the SQL logic).
  const db = await getDb();
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    include: { items: false },
  });
  const payments = await db.paymentRecord.findMany({ where: { status: "paid" } });
  const paidByOrder = new Map<string, number>();
  for (const p of payments) {
    paidByOrder.set(p.orderId, (paidByOrder.get(p.orderId) ?? 0) + toCents(p.amount ?? 0));
  }
  const rows = orders.map((o) => {
    const expectedC = toCents(o.totalAmount);
    const hasPayments = paidByOrder.has(o.id);
    const actualC = hasPayments
      ? paidByOrder.get(o.id) ?? 0
      : ["paid", "shipped", "delivered"].includes(o.status)
        ? expectedC
        : 0;
    const diffC = actualC - expectedC;
    let recon: string;
    if (o.status === "cancelled") recon = o.refundAmount > 0 ? "Refunded" : "Unmatched";
    else if (o.refundAmount >= o.totalAmount && o.totalAmount > 0) recon = "Refunded";
    else if (actualC === 0 && o.paymentStatus === "failed") recon = "Failed";
    else if (actualC === 0) recon = "Unmatched";
    else if (Math.abs(diffC) < 1) recon = "Matched"; // < 1 cent tolerance
    else if (diffC > 0) recon = "Overpaid";
    else recon = "Underpaid";
    return {
      orderId: o.id,
      customer: o.shippingName || "Customer",
      orderTotal: centsToMajor(expectedC),
      expectedPayment: centsToMajor(expectedC),
      actualPayment: centsToMajor(actualC),
      difference: centsToMajor(diffC),
      paymentMethod: o.paymentMethod,
      paymentReference: o.paymentRef,
      paymentStatus: o.paymentStatus,
      reconStatus: recon,
      orderStatus: o.status,
      orderDate: o.createdAt.toISOString(),
      refunded: centsToMajor(toCents(o.refundAmount)),
    };
  });
  return NextResponse.json({ rows });
}
