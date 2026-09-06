// Email/password login. Uses Supabase Auth when env vars are set; falls back
// to local Prisma + bcrypt otherwise. bcrypt is dynamically imported so it
// never gets bundled into the Cloudflare build.

import { NextRequest, NextResponse } from "next/server";

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
      if (!supabase) {
        return NextResponse.json(
          {
            error:
              "Auth is not configured on the server: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing at runtime. Set them in Cloudflare (Build AND Runtime) and redeploy.",
          },
          { status: 500 },
        );
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const raw = error?.message ?? "Invalid credentials.";
        let hint = "";
        if (/invalid login credentials/i.test(raw)) {
          hint =
            ' No account matches. If you never clicked "Seed now", the demo admin does not exist yet — seed first, then sign in.';
        } else if (/email not confirmed/i.test(raw)) {
          hint = " This user exists but is unconfirmed. Open Supabase, Authentication > Users, confirm the email, then try again.";
        } else if (/rate limit|too many/i.test(raw)) {
          hint = " Too many attempts — wait a minute and try again.";
        }
        return NextResponse.json({ error: hint ? `${raw}.${hint}` : raw }, { status: 401 });
      }
      const name = (data.user.user_metadata?.name as string) ?? email.split("@")[0];
      const role = (data.user.user_metadata?.role as string) ?? "customer";
      // Persist BOTH session flavors: signInWithPassword already wrote the
      // @supabase/ssr `sb-*` cookies, and this adds our durable
      // `shop_session` cookie so the session survives even if the sb-*
      // cookies are lost or expire (no refresh middleware on Workers).
      const res = NextResponse.json({ user: { id: data.user.id, email, name, role } });
      return setAuthCookie(res, data.user.id);
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
