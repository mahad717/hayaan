// Admin lead management (Task 57) — list / add manually / set status / delete.
// GET    /api/admin/leads?status=new&limit=200
// POST   /api/admin/leads   { type, name?, email?, phone?, business?, message?, source?, status? }
// PATCH  /api/admin/leads   { id, status }   status: new|contacted|won|lost
// DELETE /api/admin/leads?id=<uuid>
//
// Reads/writes go through the service role: the `leads` table is RLS-deny-all,
// so this route is the ONLY way leads are ever surfaced (admin session gated).
// POST is the owner's manual entry path (Task 64): leads collected off-site —
// walk-in customers, WhatsApp DMs, phone calls — join the same pipeline so
// they flow into Export CSV / Copy phones with everything else.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/accounting";

const STATUSES = new Set(["new", "contacted", "won", "lost"]);
const LEAD_TYPES = new Set(["newsletter", "quote", "deals"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LEN = { name: 120, email: 200, phone: 40, business: 160, message: 4000, source: 40 };

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

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

/**
 * Manual lead entry (Task 64) — the owner adding a lead collected off-site
 * (walk-in, WhatsApp DM, phone call). Same reachability rules as the public
 * capture route: a lead must have email or phone; quotes need a name and a
 * message. No Resend notification — the owner is the one typing it in.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const type = typeof body.type === "string" && LEAD_TYPES.has(body.type) ? body.type : "newsletter";
  const name = clip(body.name, MAX_LEN.name);
  const email = clip(body.email, MAX_LEN.email);
  const phone = clip(body.phone, MAX_LEN.phone);
  const business = clip(body.business, MAX_LEN.business);
  const message = clip(body.message, MAX_LEN.message);
  const source = clip(body.source, MAX_LEN.source) ?? "manual";
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : "new";

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "A lead needs a phone number or email so you can reach them." },
      { status: 400 },
    );
  }
  if (type === "quote") {
    if (!name) return NextResponse.json({ error: "Quote leads need a name." }, { status: 400 });
    if (!message)
      return NextResponse.json({ error: "Quote leads need a message describing the request." }, { status: 400 });
  }

  const row = { type, name, email, phone, business, message, source, status };

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.from("leads").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, lead: { ...data, createdAt: data.created_at } });
  }

  const lead = await (await getDb()).lead.create({ data: row });
  return NextResponse.json({ ok: true, lead });
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
