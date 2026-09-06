import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import type { SafeUser } from "@/lib/types";

// Profile fields that the signed-in user may edit. Email and role are
// intentionally NOT editable here (email is the auth identity, role is
// privileged).
const EDITABLE = ["name", "phone", "address", "city", "zip", "country"] as const;

type ProfileInput = Partial<Record<(typeof EDITABLE)[number], string>>;

function sanitize(body: Record<string, unknown>): ProfileInput {
  const out: ProfileInput = {};
  for (const key of EDITABLE) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") continue;
    out[key] = raw.trim().slice(0, 200); // cap length — free-form text fields
  }
  return out;
}

function missingColumnHint(message: string): string {
  if (/column|does not exist/i.test(message)) {
    return `${message} — Hint: run src/lib/supabase/migrations/2026-09-06-profile-address.sql in the Supabase SQL editor to add the profile/shipping columns.`;
  }
  return message;
}

// GET /api/account — the signed-in user's profile (id, email, name, role +
// saved shipping address). getCurrentUser already hydrates the address from
// the profile store; this route simply guarantees a fresh read.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ user });
}

// PUT /api/account — update profile + saved shipping address.
// Body: { name?, phone?, address?, city?, zip?, country? }
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data = sanitize(body);
  if (data.name !== undefined && !data.name) {
    return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // --- Supabase (production) ---
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is missing at runtime — cannot write the profile." },
        { status: 500 },
      );
    }

    // Keep the auth metadata name in sync (used by JWT-only paths), then upsert
    // the full profile row.
    if (data.name !== undefined) {
      const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { name: data.name },
      });
      if (metaErr) {
        return NextResponse.json({ error: missingColumnHint(metaErr.message) }, { status: 500 });
      }
    }

    const { data: updated, error } = await supabase
      .from("users")
      .upsert({ id: user.id, email: user.email, ...data }, { onConflict: "id" })
      .select("id, email, name, role, phone, address, city, zip, country")
      .single();
    if (error) {
      return NextResponse.json({ error: missingColumnHint(error.message) }, { status: 500 });
    }
    const fresh: SafeUser = {
      id: updated.id,
      email: updated.email,
      name: updated.name ?? user.email.split("@")[0],
      role: updated.role === "admin" ? "admin" : "customer",
      phone: updated.phone,
      address: updated.address,
      city: updated.city,
      zip: updated.zip,
      country: updated.country,
    };
    return NextResponse.json({ user: fresh });
  }

  // --- Local Prisma fallback ---
  const db = await getDb();
  const fresh = await db.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      address: true,
      city: true,
      zip: true,
      country: true,
    },
  });
  return NextResponse.json({ user: fresh });
}
