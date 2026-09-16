// GET /api/admin/accounting/overview?from=<ISO>&to=<ISO>
// Financial overview for the picked period (admin-only).
// Supabase: aggregates inside the SECURITY DEFINER RPC (decimal-exact).
// Prisma (local): aggregates in integer cents.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  toCents,
  centsToMajor,
  marginPct,
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
    const { data, error } = await supabase.rpc("accounting_overview", {
      from_ts: from.toISOString(),
      to_ts: to.toISOString(),
    });
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      overview: {
        revenue: Number(row?.revenue ?? 0),
        cogs: Number(row?.cogs ?? 0),
        grossProfit: Number(row?.gross_profit ?? 0),
        grossMargin: Number(row?.gross_margin ?? 0),
        discounts: Number(row?.discounts ?? 0),
        refunds: Number(row?.refunds ?? 0),
        shippingRevenue: Number(row?.shipping_revenue ?? 0),
        taxCollected: Number(row?.tax_collected ?? 0),
        netRevenue: Number(row?.net_revenue ?? 0),
        ordersCount: Number(row?.orders_count ?? 0),
        missingCostItems: Number(row?.missing_cost_items ?? 0),
        cancelledCount: Number(row?.cancelled_count ?? 0),
      },
    });
  }

  // Local Prisma aggregation (integer cents).
  const db = await getDb();
  const PAID = ["paid", "shipped", "delivered"];
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to }, status: { in: PAID } },
    select: {
      id: true,
      discountAmount: true,
      refundAmount: true,
      shippingCost: true,
      taxAmount: true,
      items: { select: { id: true, price: true, quantity: true } },
    },
  });
  const itemIds = orders.flatMap((o) => o.items.map((i) => i.id));
  const costs = itemIds.length
    ? await db.orderItemCost.findMany({
        where: { orderItemId: { in: itemIds } },
        select: { orderItemId: true, unitCost: true },
      })
    : [];
  const costMap = new Map(costs.map((c) => [c.orderItemId, c.unitCost]));

  let revenueC = 0, cogsC = 0, discountsC = 0, refundsC = 0, shipC = 0, taxC = 0, missing = 0;
  for (const o of orders) {
    const merchC = o.items.reduce((s, i) => s + toCents(i.price) * i.quantity, 0);
    revenueC += Math.max(0, merchC - toCents(o.discountAmount));
    discountsC += toCents(o.discountAmount);
    refundsC += toCents(o.refundAmount);
    shipC += toCents(o.shippingCost);
    taxC += toCents(o.taxAmount);
    for (const i of o.items) {
      const c = costMap.get(i.id);
      if (c == null) missing += 1;
      else cogsC += toCents(c) * i.quantity;
    }
  }
  const cancelledCount = await db.order.count({
    where: { createdAt: { gte: from, lt: to }, status: "cancelled" },
  });
  return NextResponse.json({
    overview: {
      revenue: centsToMajor(revenueC),
      cogs: centsToMajor(cogsC),
      grossProfit: centsToMajor(revenueC - cogsC),
      grossMargin: marginPct(revenueC, cogsC),
      discounts: centsToMajor(discountsC),
      refunds: centsToMajor(refundsC),
      shippingRevenue: centsToMajor(shipC),
      taxCollected: centsToMajor(taxC),
      netRevenue: centsToMajor(revenueC - refundsC),
      ordersCount: orders.length,
      missingCostItems: missing,
      cancelledCount,
    },
  });
}
