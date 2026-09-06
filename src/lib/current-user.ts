// Unified auth resolution — works for both the local Prisma+bcrypt fallback
// and live Supabase Auth. Used by every API route that needs to identify
// the signed-in user.
//
// Resolution order:
//   1. If Supabase server is enabled (URL + anon + service_role all set):
//      read the JWT from cookies via @supabase/ssr and call getUser().
//   2. Otherwise: read the local `shop_session` cookie and look up the user
//      in the Prisma `User` table.

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { getUserFromRequest, getSupabaseUserById } from "@/lib/auth-session";
import type { SafeUser } from "@/lib/types";

function mapSupabaseUser(u: SupabaseAuthUser): SafeUser {
  const name = (u.user_metadata?.name as string | undefined) ?? u.email!.split("@")[0];
  const role = (u.user_metadata?.role as string | undefined) ?? "customer";
  return {
    id: u.id,
    email: u.email!,
    name,
    role: role === "admin" ? "admin" : "customer",
  };
}

async function resolveSupabaseUser(req: NextRequest | null): Promise<SafeUser | null> {
  // 1) Canonical: the @supabase/ssr cookie session. We then hydrate the
  //    profile from public.users (service role) so the shipping address
  //    fields ride along — JWT user_metadata doesn't carry them.
  const supabase = await createServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const profile = await getSupabaseUserById(data.user.id);
      return profile ?? mapSupabaseUser(data.user);
    }
  }
  // 2) Fallback: our durable `shop_session` cookie (survives lost/expired
  //    sb-* cookies — there is no token-refresh middleware on Workers).
  return req ? getUserFromRequest(req) : null;
}

export async function getCurrentUser(req: NextRequest): Promise<SafeUser | null> {
  if (isSupabaseServerEnabled) {
    return resolveSupabaseUser(req);
  }
  return getUserFromRequest(req);
}

/**
 * Resolve the signed-in user from a Server Component / page context
 * (no `NextRequest` available there — read cookies via `next/headers`).
 * Mirrors `getCurrentUser()` so both paths stay in sync.
 */
export async function getServerUser(): Promise<SafeUser | null> {
  if (isSupabaseServerEnabled) {
    // 1) Canonical: the @supabase/ssr cookie session (hydrated from
    //    public.users so profile/address fields are included).
    const supabase = await createServerClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const profile = await getSupabaseUserById(data.user.id);
        if (profile) return profile;
      }
    }
    // 2) Fallback: `shop_session` cookie → Supabase profile lookup.
    const cookieStore = await cookies();
    const userId = cookieStore.get("shop_session")?.value;
    if (!userId) return null;
    return getSupabaseUserById(userId);
  }
  // Local fallback: `shop_session` cookie holds the user id directly.
  const cookieStore = await cookies();
  const userId = cookieStore.get("shop_session")?.value;
  if (!userId) return null;
  const { getDb } = await import("@/lib/db");
  const db = await getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
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
  return user ?? null;
}
