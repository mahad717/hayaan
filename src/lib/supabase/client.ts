// Supabase browser client.
//
// To enable real Supabase Auth + Postgres in production:
//   1. Create a project at https://supabase.com and grab the URL + anon key.
//   2. Add to `.env.local`:
//        NEXT_PUBLIC_SUPABASE_URL=...
//        NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//        SUPABASE_SERVICE_ROLE_KEY=...   (server only — used in API routes)
//   3. Run the SQL in `src/lib/supabase/schema.sql` against your Supabase project.
//   4. Swap Prisma calls in `src/app/api/**` for `supabase.from(...)` queries.
//
// When env vars are missing (local dev / preview), `createClient` returns null
// and the app falls back to Prisma + bcrypt auth defined in this repo.

import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as ssrCreateBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = Boolean(url && anonKey);

export function createBrowserClient(): SupabaseClient | null {
  if (!isSupabaseEnabled) return null;
  return supabaseCreateClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Cookie-backed browser client for OAuth flows ("Continue with Google").
 * @supabase/ssr stores the PKCE code verifier in a cookie, which lets the
 * /auth/callback route handler complete the exchange server-side. The plain
 * supabase-js client above keeps the verifier in localStorage where the
 * server can never see it — OAuth must start from THIS client.
 */
export function createOAuthBrowserClient() {
  if (!isSupabaseEnabled) return null;
  return ssrCreateBrowserClient(url as string, anonKey as string);
}
