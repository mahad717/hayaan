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
import { db } from "@/lib/db";
import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/auth-session";
import type { SafeUser } from "@/lib/types";

export async function getCurrentUser(req: NextRequest): Promise<SafeUser | null> {
  if (isSupabaseServerEnabled) {
    const supabase = await createServerClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const name = (data.user.user_metadata?.name as string | undefined) ?? data.user.email!.split("@")[0];
    const role = (data.user.user_metadata?.role as string | undefined) ?? "customer";
    return {
      id: data.user.id,
      email: data.user.email!,
      name,
      role: role === "admin" ? "admin" : "customer",
    };
  }
  return getUserFromRequest(req);
}
