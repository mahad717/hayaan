// Google OAuth callback — the redirect_to target of the Supabase PKCE flow
// started by "Continue with Google" in the auth modal.
//
// Flow: browser → Google consent → Supabase /auth/v1/callback → HERE with
// ?code=… (the PKCE verifier rides in a cookie set by the @supabase/ssr
// browser client, so the server can complete the exchange).
//
// On success we set the app's own durable `shop_session` cookie (the exact
// cookie email/password login sets), so every existing API — /api/auth/me,
// /api/cart, /api/orders, admin guards — treats this user as signed in with
// no other changes. The @supabase/ssr `sb-*` cookies are written too.

import { NextRequest, NextResponse } from "next/server";

import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { setAuthCookie } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url);
  const next = searchParams.get("next") ?? "/";
  const fail = NextResponse.redirect(`${origin}${next}`);

  const code = searchParams.get("code");
  if (!code || !isSupabaseServerEnabled) return fail;

  try {
    const supabase = await createServerClient();
    if (!supabase) return fail;

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("[auth/callback]", error?.message ?? "no user in exchange");
      return fail;
    }

    return setAuthCookie(NextResponse.redirect(`${origin}${next}`), data.user.id);
  } catch (err) {
    console.error("[auth/callback]", err);
    return fail;
  }
}
