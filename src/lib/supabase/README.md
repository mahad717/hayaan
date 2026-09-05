# Supabase integration

This project ships **Supabase-ready** code paths. The app runs against Prisma +
SQLite locally so you have a working preview immediately, and can be flipped to
real Supabase (Postgres + Auth + Storage + Realtime) by setting three env vars.

## Files

| File | Purpose |
| --- | --- |
| `client.ts` | Browser Supabase client (uses the anon key, persists sessions). |
| `server.ts` | Server Supabase clients — service-role for trusted API routes, SSR cookie-bound client for RLS-friendly reads. |
| `schema.sql` | SQL to run in Supabase's SQL editor — mirrors the Prisma schema + RLS policies + realtime. |

## The three env vars — what each one unlocks

| Env var | Where it's used | What it enables |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Required for any Supabase call. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public key — safe to ship to the browser. Used for RLS-respecting reads + Supabase Auth sessions. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to the browser | Unlocks the service-role client (`createServiceClient()`) which bypasses RLS. Required by every API route that writes or performs trusted/admin operations. |

## With only URL + anon (current state)

You can already:
- Initialize the browser Supabase client (`createBrowserClient()`) — useful if you want to add client-side auth flows or realtime subscriptions later.
- Call `createServerClient()` from Server Components for RLS-respecting reads (e.g. list public products).

You **cannot** yet:
- Switch the API routes from Prisma to Supabase. They check `isSupabaseServerEnabled`, which is only `true` when the service_role key is also set. Until then, every route gracefully uses the local Prisma + bcrypt stack.

## Add the service_role key to fully switch over

1. In your Supabase dashboard: **Project Settings → API → `service_role` secret** → Copy.
2. Add to `.env` (already partially filled in):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...    # paste the secret here
   ```
3. Restart the dev server (`bun run dev`).
4. Open Supabase's SQL editor and paste the contents of
   `src/lib/supabase/schema.sql`. Run it. This creates the tables, RLS policies,
   and realtime publication that mirror the Prisma models.
5. Every API route in `src/app/api/**` will now use Supabase instead of Prisma.

## Why we keep Prisma around

The sandbox cannot reach external Supabase projects reliably during local
development, and the user needs a live preview without pasting credentials.
Prisma + SQLite lets the demo run end-to-end (signup, cart, checkout, admin) so
you can see the UX before flipping the switch.
