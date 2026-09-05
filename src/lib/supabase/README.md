# Supabase integration

This project ships **Supabase-ready** code paths. The app runs against Prisma +
SQLite locally so you have a working preview immediately, and can be flipped to
real Supabase (Postgres + Auth + Storage + Realtime) by setting three env vars.

## Files

| File | Purpose |
| --- | --- |
| `client.ts` | Browser Supabase client (uses the anon key, persists sessions). |
| `server.ts` | Server Supabase client (service-role for trusted API routes, SSR cookie-bound client for RLS-friendly calls). |
| `schema.sql` | SQL to run in Supabase's SQL editor — mirrors the Prisma schema + RLS policies + realtime. |

## Switching from Prisma to Supabase

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```
4. Open Supabase's SQL editor and paste the contents of
   `src/lib/supabase/schema.sql`. Run it.
5. In each API route under `src/app/api/**`, swap Prisma calls for Supabase.
   The existing `isSupabaseServerEnabled` / `createServiceClient()` helpers
   make this a small refactor — for example:
   ```ts
   // Before (Prisma)
   const products = await db.product.findMany({ where: { isActive: true } });

   // After (Supabase)
   const supabase = createServiceClient()!;
   const { data: products } = await supabase
     .from('products')
     .select('*')
     .eq('is_active', true);
   ```
6. For auth, replace the local bcrypt login in `src/app/api/auth/*` with
   `supabase.auth.signInWithPassword(...)`. The browser client at
   `createBrowserClient()` already wires up session persistence.

## Why we keep Prisma around

The sandbox cannot reach external Supabase projects reliably, and the user
needs a live preview without pasting credentials. Prisma + SQLite lets the demo
run end-to-end (signup, cart, checkout, admin) so you can see the UX before
flipping the switch.
