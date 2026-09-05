// Email/password signup. When Supabase is enabled (env vars set), this should
// be swapped to `supabase.auth.signUp(...)`. Locally we hash with bcrypt and
// store in Prisma so the demo flow works without external dependencies.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { setAuthCookie } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, password, and name are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { name, role: "customer" },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ user: { id: data.user.id, email, name, role: "customer" } });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await db.user.create({ data: { email, name, password: hashed } });
    await db.cart.create({ data: { userId: user.id } });

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    return setAuthCookie(res, user.id);
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
