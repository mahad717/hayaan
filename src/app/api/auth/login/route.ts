// Email/password login. Uses Supabase Auth when env vars are set; falls back
// to local Prisma + bcrypt otherwise. bcrypt is dynamically imported so it
// never gets bundled into the Cloudflare build.

import { NextRequest, NextResponse } from "next/server";

// Required by Cloudflare Pages — all API routes must run on the Edge Runtime.
export const runtime = "edge";
import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { setAuthCookie } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (isSupabaseServerEnabled) {
      const supabase = await createServerClient();
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return NextResponse.json({ error: error?.message ?? "Invalid credentials." }, { status: 401 });
      }
      const name = (data.user.user_metadata?.name as string) ?? email.split("@")[0];
      const role = (data.user.user_metadata?.role as string) ?? "customer";
      return NextResponse.json({ user: { id: data.user.id, email, name, role } });
    }

    const { default: bcrypt } = await import("bcryptjs");
    const db = await getDb();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    return setAuthCookie(res, user.id);
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
