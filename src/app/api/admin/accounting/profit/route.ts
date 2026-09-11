// GET /api/admin/accounting/profit?from=<ISO>&to=<ISO>&sort=<key>
// Per-product profitability report (admin-only). Sort keys: revenue-desc,
// profit-desc, profit-asc, margin-desc, margin-asc, units-desc.
// Products with missing cost snapshots are flagged (missingCost: true) and
// their COGS/profit exclude the unknown part — never guessed (spec §15).

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
  const sort = req.nextUrl.searchParams.get("sort") ?? "revenue-desc";

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.rpc("accounting_profit", {
      from_ts: from.toISOString(),
      to_ts: to.toISOString(),
    });
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []).map((r: any) => ({
      productId: r.product_id,
      productName: r.product_name,
      unitsSold: Number(r.units_sold ?? 0),
      revenue: Number(r.revenue ?? 0),
      cogs: r.cogs != null ? Number(r.cogs) : 0,
      grossProfit: r.gross_profit != null ? Number(r.gross_profit) : Number(r.revenue ?? 0),
      margin: r.margin != null ? Number(r.margin) : null,
      missingCost: !!r.missing_cost,
    }));
    sortRows(rows, sort);
    const totals = rows.reduce(
      (acc, r) => {
        acc.unitsSold += r.unitsSold;
        acc.revenue = Math.round((acc.revenue + r.revenue) * 100) / 100;
        acc.cogs = Math.round((acc.cogs + r.cogs) * 100) / 100;
        return acc;
      },
      { unitsSold: 0, revenue: 0, cogs: 0 },
    );
    totals.cogs = Math.round(totals.cogs * 100) / 100;
    return NextResponse.json({
      rows,
      totals: {
        unitsSold: totals.unitsSold,
        revenue: totals.revenue,
        cogs: totals.cogs,
        grossProfit: Math.round((totals.revenue - totals.cogs) * 100) / 100,
        grossMargin: marginPct(toCents(totals.revenue), toCents(totals.cogs)),
      },
    });
  }

  // Local Prisma aggregation.
  const db = await getDb();
  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lt: to }, status: { in: ["paid", "shipped", "delivered"] } },
    select: { id: true, items: { select: { id: true, productId: true, name: true, price: true, quantity: true } } },
  });
  const itemIds = orders.flatMap((o) => o.items.map((i) => i.id));
  const costs = itemIds.length
    ? await db.orderItemCost.findMany({
        where: { orderItemId: { in: itemIds } },
        select: { orderItemId: true, unitCost: true },
      })
    : [];
  const costMap = new Map(costs.map((c) => [c.orderItemId, c.unitCost]));

  interface Acc {
    productId: string;
    productName: string;
    unitsSold: number;
    revenueC: number;
    cogsC: number;
    missing: boolean;
  }
  const byProduct = new Map<string, Acc>();
  for (const o of orders) {
    for (const i of o.items) {
      if (!i.productId) continue;
      let acc = byProduct.get(i.productId);
      if (!acc) {
        acc = { productId: i.productId, productName: i.name, unitsSold: 0, revenueC: 0, cogsC: 0, missing: false };
        byProduct.set(i.productId, acc);
      }
      acc.unitsSold += i.quantity;
      acc.revenueC += toCents(i.price) * i.quantity;
      const c = costMap.get(i.id);
      if (c == null) acc.missing = true;
      else acc.cogsC += toCents(c) * i.quantity;
    }
  }
  const rows = Array.from(byProduct.values()).map((a) => ({
    productId: a.productId,
    productName: a.productName,
    unitsSold: a.unitsSold,
    revenue: centsToMajor(a.revenueC),
    cogs: centsToMajor(a.cogsC),
    grossProfit: centsToMajor(a.revenueC - a.cogsC),
    margin: marginPct(a.revenueC, a.cogsC),
    missingCost: a.missing,
  }));
  sortRows(rows, sort);
  const totalsC = rows.reduce(
    (acc, r) => ({ units: acc.units + r.unitsSold, revenue: acc.revenue + toCents(r.revenue), cogs: acc.cogs + toCents(r.cogs) }),
    { units: 0, revenue: 0, cogs: 0 },
  );
  return NextResponse.json({
    rows,
    totals: {
      unitsSold: totalsC.units,
      revenue: centsToMajor(totalsC.revenue),
      cogs: centsToMajor(totalsC.cogs),
      grossProfit: centsToMajor(totalsC.revenue - totalsC.cogs),
      grossMargin: marginPct(totalsC.revenue, totalsC.cogs),
    },
  });
}

function sortRows(rows: any[], sort: string) {
  const by = {
    "revenue-desc": (a: any, b: any) => b.revenue - a.revenue,
    "profit-desc": (a: any, b: any) => b.grossProfit - a.grossProfit,
    "profit-asc": (a: any, b: any) => a.grossProfit - b.grossProfit,
    "margin-desc": (a: any, b: any) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity),
    "margin-asc": (a: any, b: any) => (a.margin ?? Infinity) - (b.margin ?? Infinity),
    "units-desc": (a: any, b: any) => b.unitsSold - a.unitsSold,
  } as Record<string, (a: any, b: any) => number>;
  rows.sort(by[sort] ?? by["revenue-desc"]);
}
