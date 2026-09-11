// GET /api/admin/accounting/ledger?from=&to=&type=&limit=
// The internal accounting ledger (admin-only): signed entries per financial
// event, grouped by entryGroup. Traceability layer — never customer-facing.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
} from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const from = params.get("from") ? new Date(params.get("from") as string) : null;
  const to = params.get("to") ? new Date(params.get("to") as string) : null;
  const type = params.get("type");
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, 500);

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    let q = supabase
      .from("ledger_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (from && !isNaN(from.getTime())) q = q.gte("created_at", from.toISOString());
    if (to && !isNaN(to.getTime())) q = q.lt("created_at", to.toISOString());
    if (type && type !== "all") q = q.eq("entry_type", type);
    const { data, error } = await q;
    if (error) {
      if (isMissingAccountingSchema(error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      entries: (data ?? []).map((e: any) => ({
        id: e.id,
        entryType: e.entry_type,
        account: e.account,
        entryGroup: e.entry_group,
        orderId: e.order_id,
        purchaseId: e.purchase_id,
        productId: e.product_id,
        amount: Number(e.amount ?? 0),
        currency: e.currency,
        description: e.description,
        actor: e.actor,
        createdAt: e.created_at,
      })),
    });
  }

  const db = await getDb();
  const entries = await db.ledgerEntry.findMany({
    where: {
      ...(from && !isNaN(from.getTime()) ? { createdAt: { gte: from } } : {}),
      ...(to && !isNaN(to.getTime()) ? { createdAt: { lt: to } } : {}),
      ...(type && type !== "all" ? { entryType: type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      account: e.account,
      entryGroup: e.entryGroup,
      orderId: e.orderId,
      purchaseId: e.purchaseId,
      productId: e.productId,
      amount: e.amount,
      currency: e.currency,
      description: e.description,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
