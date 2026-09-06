// Supabase server client (for API routes / server components).
// Falls back to null when env vars are not configured.
//
// Why service_role is required for the server path:
//   The API routes in /api/products, /api/cart, /api/orders, /api/auth/admin
//   all use `createServiceClient()` to bypass RLS for trusted operations
//   (creating products, reading any user's cart during checkout, etc.).
//   Without the service_role key, those routes gracefully fall back to the
//   local Prisma + bcrypt stack so the app keeps working.
//
//   The anon-key SSR client (`createServerClient()`) is still usable on its
//   own for read-only operations that respect RLS — e.g. fetching the public
//   product catalog from a Server Component.

import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient as supabaseSsrCreateClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when both the anon key AND the service_role key are present. */
export const isSupabaseServerEnabled = Boolean(url && anonKey && serviceRoleKey);

/** True when at least the anon key is present (browser client + SSR reads work). */
export const isSupabaseClientEnabled = Boolean(url && anonKey);

/**
 * Service-role client — bypasses RLS. Use ONLY in trusted server contexts
 * (API routes behind your own auth check). Never expose to the browser.
 *
 * Returns null when the service_role key is missing — callers must check
 * the return value before using it.
 */
export function createServiceClient(): SupabaseClient | null {
  if (!url || !serviceRoleKey) return null;
  return supabaseCreateClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * SSR client bound to the user's cookies — respects RLS, uses the anon key.
 * Safe to call from Server Components even without the service_role key.
 * Pass through `await cookies()` from `next/headers`.
 */
export async function createServerClient(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return supabaseSsrCreateClient(url, anonKey, {
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
