// Supabase server client (for API routes / server components).
// Falls back to null when env vars are not configured.

import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient as supabaseSsrCreateClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServerEnabled = Boolean(url && anonKey);

/**
 * Service-role client — bypasses RLS. Use ONLY in trusted server contexts
 * (API routes behind your own auth check). Never expose to the browser.
 */
export function createServiceClient(): SupabaseClient | null {
  if (!isSupabaseServerEnabled || !serviceRoleKey) return null;
  return supabaseCreateClient(url as string, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * SSR client bound to the user's cookies — respects RLS, uses the anon key.
 * Pass through `await cookies()` from `next/headers`.
 */
export async function createServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseServerEnabled) return null;
  const cookieStore = await cookies();
  return supabaseSsrCreateClient(url as string, anonKey as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when middleware refreshes sessions.
        }
      },
    },
  });
}
