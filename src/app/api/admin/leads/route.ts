// Admin lead management (Task 57) — list / set status / delete.
// GET    /api/admin/leads?status=new&limit=200
// PATCH  /api/admin/leads   { id, status }   status: new|contacted|won|lost
// DELETE /api/admin/leads?id=<uuid>
//
// Reads/writes go through the service role: the `leads` table is RLS-deny-all,
// so this route is the ONLY way leads are ever surfaced (admin session gated).

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/accounting";

const STATUSES = new Set(["new", "contacted", "won", "lost"]);

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 200;

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    let q = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && STATUSES.has(status)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      leads: (data ?? []).map((l) => ({ ...l, createdAt: l.created_at })),
    });
  }

  const leads = await (await getDb()).lead.findMany({
    where: status && STATUSES.has(status) ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ leads });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Provide a lead id and a valid status." }, { status: 400 });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("leads").update({ status: body.status }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  await (await getDb()).lead.update({ where: { id: body.id }, data: { status: body.status } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide a lead id." }, { status: 400 });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  await (await getDb()).lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
