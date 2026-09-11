// POST /api/admin/accounting/payments
// Record a (manual/external) payment against an order — admin-only. Used for
// cash on delivery collections, bank transfers, or any provider not yet
// wired to an automatic integration (extensible per spec §7).
// Duplicate (provider, transactionRef) submissions are detected and reported
// instead of double-counting revenue.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import {
  requireAdminUser,
  accountingUnavailableResponse,
  isMissingAccountingSchema,
  insertPayment,
  auditChange,
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
  if (!orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
  }
  const provider = String(body.provider ?? "manual").trim() || "manual";
  const method = body.method ? String(body.method).trim() : null;
  const reference = body.reference ? String(body.reference).trim() : null;
  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

  // Confirm the order exists (either backend).
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).single();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  } else {
    const order = await (await getDb()).order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const res = await insertPayment({
      orderId,
      provider,
      method,
      transactionRef: reference,
      amount,
      status: "paid",
      paidAt: isNaN(paidAt.getTime()) ? new Date().toISOString() : paidAt.toISOString(),
    });
    if (res.duplicate) {
      return NextResponse.json(
        { error: "A payment with this provider and transaction reference was already recorded — nothing was double-counted.", duplicate: true },
        { status: 409 },
      );
    }
    await auditChange({
      actor: admin,
      entity: "payment",
      entityId: res.id ?? orderId,
      field: "payment",
      oldValue: null,
      newValue: `${provider}/${method ?? "-"} $${amount.toFixed(2)} ref=${reference ?? "-"} → order ${orderId}`,
    });
    return NextResponse.json({ ok: true, id: res.id });
  } catch (err: any) {
    if (isMissingAccountingSchema(err)) {
      return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
