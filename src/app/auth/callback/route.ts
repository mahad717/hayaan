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
//
// Google sign-ins have NO public.users row (there is no handle_new_user
// trigger on the project), which would leave cart/orders/profile writes
// orphaned — so this route upserts one for every OAuth user. For the owner
// allowlist email it also persists role=admin (service-role writable only,
// so this is the single trusted writer of that state).

import { NextRequest, NextResponse } from "next/server";

import { isSupabaseServerEnabled, createServerClient, createServiceClient } from "@/lib/supabase/server";
import { setAuthCookie } from "@/lib/auth-session";
import { isAdminEmail } from "@/lib/admin-emails";

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

    const u = data.user;
    const email = u.email ?? "";
    const ownerAdmin = isAdminEmail(email);
    const name =
      (u.user_metadata?.name as string | undefined) ??
      (u.user_metadata?.full_name as string | undefined) ??
      (email ? email.split("@")[0] : "Shopper");

    // Sync public.users: insert when missing, never stomp a customer's
    // profile edits; for the owner email, force role=admin on every login
    // so the DB row matches the allowlist even if it was seeded differently.
    const service = createServiceClient();
    if (service && email) {
      const row = { id: u.id, email, name, role: ownerAdmin ? "admin" : "customer" };
      const { error: upsertErr } = await service
        .from("users")
        .upsert(row, { onConflict: "id", ignoreDuplicates: !ownerAdmin });
      if (upsertErr) console.error("[auth/callback] users upsert:", upsertErr.message);
    }

    return setAuthCookie(NextResponse.redirect(`${origin}${next}`), u.id);
  } catch (err) {
    console.error("[auth/callback]", err);
    return fail;
  }
}
