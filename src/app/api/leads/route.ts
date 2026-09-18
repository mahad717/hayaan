// POST /api/leads — public lead capture (Task 57).
// Sources: footer newsletter form, offer popup, /quote bulk-request form.
// Supabase: writes into the RLS-deny-all `leads` table via the service role.
// Prisma (local dev): same shape into the sqlite `leads` table.
//
// Abuse controls:
// * honeypot field `website` — bots that fill it get a fake-ok and no row;
// * per-IP in-memory throttle (5 submissions / 10 min) — a cheap deterrent,
//   not a hard guarantee (isolates reset); the admin can delete spam rows.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

const LEAD_TYPES = new Set(["newsletter", "quote", "deals"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LEN = { name: 120, email: 200, phone: 40, business: 160, message: 4000, source: 40 };

// --- New-lead email notification (Task 59) --------------------------------
// Every stored lead is mirrored to the owner's inbox so leads can be answered
// while warm, without polling the admin tab. Uses the Resend REST API and is
// fully env-gated: with RESEND_API_KEY unset this is a no-op and leads still
// land in the admin Leads tab.
const LEAD_NOTIFY_TO = (process.env.LEAD_NOTIFY_EMAIL ?? SUPPORT_EMAIL).trim();
const LEAD_NOTIFY_FROM = (process.env.LEAD_NOTIFY_FROM ?? `Hayaan Market <${SUPPORT_EMAIL}>`).trim();

async function notifyLead(row: {
  type: string; name: string | null; email: string | null;
  phone: string | null; business: string | null; message: string | null; source: string;
}): Promise<void> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return;
  const subject =
    row.type === "quote"
      ? `New bulk-quote request from ${row.name ?? "a buyer"}`
      : row.type === "deals"
        ? `New deal-alert signup — ${row.name ?? row.phone ?? row.email ?? "a shopper"}`
        : `New newsletter signup${row.email ? ` — ${row.email}` : ""}`;
  const body = [
    `Type: ${row.type}`,
    row.name && `Name: ${row.name}`,
    row.business && `Business: ${row.business}`,
    row.email && `Email: ${row.email}`,
    row.phone && `Phone/WhatsApp: ${row.phone}`,
    `Source: ${row.source}`,
    row.message ? `\nMessage:\n${row.message}` : "",
    "\n— Manage this lead in the admin Leads tab: https://hayaan.co/admin",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: LEAD_NOTIFY_FROM,
        to: [LEAD_NOTIFY_TO],
        subject,
        text: body,
        // Reply-to the lead so answering the notification is one click.
        ...(row.email ? { reply_to: row.email } : {}),
      }),
    });
    if (!res.ok) {
      console.error("lead notification failed", res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    // Best-effort only — never fail the lead capture because of the email.
    console.error("lead notification error", e);
  }
}

// Tiny sliding-window throttle keyed by client IP.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

function throttled(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_HITS) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot — real users never see this field; bots that fill it are dropped
  // with a success-shaped response so they don't retry with a different tactic.
  if (clip(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (throttled(ip)) {
    return NextResponse.json(
      { error: "Too many submissions — please try again later." },
      { status: 429 },
    );
  }

  const type = typeof body.type === "string" && LEAD_TYPES.has(body.type) ? body.type : "newsletter";
  const name = clip(body.name, MAX_LEN.name);
  const email = clip(body.email, MAX_LEN.email);
  const phone = clip(body.phone, MAX_LEN.phone);
  const business = clip(body.business, MAX_LEN.business);
  const message = clip(body.message, MAX_LEN.message);
  const source = clip(body.source, MAX_LEN.source) ?? "site";

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  // A lead must be reachable: newsletter needs email or phone; a quote needs
  // a name plus at least one contact channel, and what the buyer wants.
  if (type === "quote") {
    if (!name) {
      return NextResponse.json({ error: "Please tell us your name." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Please describe what you need." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Leave a phone number or email so we can send the quote." },
        { status: 400 },
      );
    }
  } else if (!email && !phone) {
    return NextResponse.json(
      { error: "Leave your email or WhatsApp number so we can reach you." },
      { status: 400 },
    );
  }

  const row = { type, name, email, phone, business, message, source };

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("leads").insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await notifyLead(row);
    return NextResponse.json({ ok: true });
  }

  await (await getDb()).lead.create({ data: row });
  await notifyLead(row);
  return NextResponse.json({ ok: true });
}
