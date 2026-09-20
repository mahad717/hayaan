// Set or change the signed-in user's auth password.
//
// POST /api/auth/password  { password }
//
// This is the "password field in the profile" endpoint: a user who signed in
// with Continue with Google (or anyone who wants to change their password)
// sets one here, and from then on email + password sign-in works for the
// account. The durable `shop_session` cookie proves identity — the current
// password is deliberately NOT required (Google users don't have one yet).
//
// Supabase mode uses the service-role admin API (works regardless of the
// state of the short-lived sb-* session cookies); the local Prisma fallback
// re-hashes with bcrypt so the dev flow works too.

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const { password } = await req.json();
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient();
      if (!supabase) {
        return NextResponse.json(
          { error: "Auth is not configured on the server: SUPABASE_SERVICE_ROLE_KEY is missing at runtime." },
          { status: 500 },
        );
      }
      const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
      if (error) {
        console.error("[auth/password]", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // Local-only fallback — bcrypt is dynamically imported here so the
    // Cloudflare bundler never pulls it in (the Supabase branch runs in prod).
    const { default: bcrypt } = await import("bcryptjs");
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const hashed = await bcrypt.hash(password, 10);
    await db.user.update({ where: { id: user.id }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/password]", err);
    return NextResponse.json({ error: "Could not set the password. Please try again." }, { status: 500 });
  }
}
