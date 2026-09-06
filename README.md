# Mercado — Next.js + Supabase + Cloudflare starter

A production-ready e-commerce starter built with **Next.js 16 (App Router)**,
**Prisma**, **Tailwind CSS 4 + shadcn/ui**, **Supabase-ready auth & data layer**,
and **Cloudflare Pages** deployment config.

## What's inside

- 🛍️ Catalog grid with search, category filters, and sorting
- 📦 Product detail page with image gallery and quantity picker
- 🛒 Persistent cart drawer with live totals
- 🔐 Email + password auth (bcrypt locally / Supabase Auth in production)
- 💳 Multi-step checkout with shipping + payment options
- 👤 Order history view
- 🛠️ Admin dashboard with full product CRUD
- 🎨 Tailwind 4 + shadcn/ui (New York style)
- 🚀 One-command seed for demo products
- ☁️ `wrangler.toml` + `open-next.config.ts` for Cloudflare Workers deployment (OpenNext adapter)

## Quick start (local demo)

```bash
# 1. Install dependencies
bun install

# 2. Push the Prisma schema to local SQLite
bun run db:push

# 3. Start the dev server (auto-runs in this sandbox)
bun run dev

# 4. Seed the demo catalog + admin user
curl -X POST http://localhost:3000/api/seed
# → Admin: admin@shop.demo / admin123

# 5. Open http://localhost:3000 (or the preview panel in this sandbox)
```

## Architecture

```
src/
├── app/
│   ├── page.tsx                # SPA entry — state-driven view switching
│   ├── layout.tsx              # Root layout + Toaster
│   └── api/
│       ├── auth/{signup,login,logout,me}/route.ts
│       ├── products/route.ts            # GET list / POST create
│       ├── products/[id]/route.ts      # GET / PUT / DELETE
│       ├── categories/route.ts
│       ├── cart/route.ts                # GET / POST / DELETE
│       ├── orders/route.ts              # GET / POST
│       ├── orders/[id]/route.ts
│       └── seed/route.ts                # POST → demo data
├── components/
│   ├── store/
│   │   ├── header.tsx
│   │   ├── hero.tsx
│   │   ├── product-card.tsx
│   │   ├── product-grid.tsx
│   │   ├── product-detail.tsx
│   │   ├── cart-drawer.tsx
│   │   ├── auth-modal.tsx
│   │   ├── checkout.tsx
│   │   ├── orders-view.tsx
│   │   ├── admin-panel.tsx
│   │   └── footer.tsx
│   └── ui/                     # shadcn/ui (already installed)
├── hooks/
│   └── use-store.ts            # Zustand store + data fetchers
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── auth-session.ts         # Local cookie session helpers
│   ├── types.ts                # Shared domain types
│   ├── utils.ts                # Tailwind merge helper
│   └── supabase/
│       ├── client.ts           # Browser Supabase client (anon key)
│       ├── server.ts           # Service-role + SSR cookie clients
│       ├── schema.sql          # Full SQL schema + RLS for Supabase
│       └── README.md           # Migration guide (Prisma → Supabase)
└── prisma/
    └── schema.prisma           # Local DB schema (SQLite)
```

## Switching from local Prisma to real Supabase

Every API route already has a Supabase code path that activates when these env
vars are present:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

See [`src/lib/supabase/README.md`](src/lib/supabase/README.md) for the full
migration steps, including running `schema.sql` for table creation and RLS
policies.

## First-time Supabase setup (do this before your first deploy)

Skip these steps and the deployed site shows an **empty storefront**, sign-in
fails, and `/admin` silently redirects you back to the homepage. That's not a
bug — the server-side guard works, but no admin account exists in Supabase
yet, so every visit to `/admin` bounces to `/`.

### 1. Create the tables

Supabase dashboard → **SQL Editor** → paste the full contents of
[`src/lib/supabase/schema.sql`](src/lib/supabase/schema.sql) → **Run**.

This creates `users`, `categories`, `products`, `carts`, `cart_items`,
`orders`, `order_items` plus RLS policies and realtime. The script is
idempotent — safe to run again.

### 2. Seed the catalog and create the admin account

From your machine (keys go in `.env`, which is never committed):

```bash
cat >> .env <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://mqyhgyakhfhuctnvezby.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role secret>
EOF

bun install
bun run seed:supabase
```

This upserts 4 categories + 12 demo products and creates the admin login:

| Email | Password | Role |
| --- | --- | --- |
| `admin@shop.demo` | `admin123` | admin |

> **No terminal handy?** Supabase dashboard → **Authentication → Users →
> Add user** (email + password, auto-confirm). Then edit that user's
> `raw_user_meta_data` JSON to `{"name": "Store Admin", "role": "admin"}`.
>
> The `/admin` guard reads `user_metadata.role` from the Supabase JWT.
> Accounts created through the storefront signup form are always
> `"role": "customer"` — flipping the role in the dashboard is the only way
> to promote someone.

### 3. Point Cloudflare at Supabase

Set the build-time and runtime variables listed in the deploy section below,
redeploy, then sign in as `admin@shop.demo` and click **Admin**. You should
see the dedicated admin chrome (dark topbar, Dashboard badge, product
manager) instead of the storefront.

### Verify the database is live

```bash
curl "https://mqyhgyakhfhuctnvezby.supabase.co/rest/v1/products?select=name&limit=3" \
  -H "apikey: <your anon key>"
```

- JSON rows → tables exist and public reads work.
- `{"code":"42P01","message":"relation ... does not exist"}` → step 1 was
  skipped.

### Troubleshooting sign-in on the deployed Worker

Open **`https://<your-worker>.workers.dev/api/diag`** in a browser. It is a
read-only health check (booleans and counts only — no secrets) that tells you
exactly what is missing:

| `mode` / field | Meaning | Fix |
|---|---|---|
| `local-prisma` | No Supabase env vars visible at runtime | Set all three in Cloudflare, redeploy |
| `supabase-partial` | `SUPABASE_SERVICE_ROLE_KEY` missing at runtime — login silently falls back to the local engine, which crashes on Workers | Add it as a Runtime **Secret**, redeploy |
| `catalog.error` set | `schema.sql` was never run | Run it in the Supabase SQL editor |
| `auth.demoAdminExists: false` | Seeder never ran | Open the site, click **Seed now** |
| everything ready | Config is fine | Sign in with the demo credentials |

Sign-in errors are also self-explanatory now: "Invalid login credentials"
means the seeder has not created the admin yet; "Email not confirmed" means
confirm the user under Supabase → Authentication → Users. Sessions survive
page reloads via a durable `shop_session` cookie even if the Supabase
`sb-*` cookies expire (there is no token-refresh middleware on Workers).

## Deploy to Cloudflare Workers (Workers Builds)

This project deploys as a **Cloudflare Worker** using the official [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter — the supported way to run Next.js on Workers. Workers Builds is Cloudflare's CI/CD pipeline; it requires both a build command AND a deploy command.

> **History:** this repo previously used `@cloudflare/next-on-pages`. That pipeline is Cloudflare **Pages**-only: its `_worker.js/` output relies on Pages runtime semantics (bare-specifier module resolution + an automatic `ASSETS` binding) that `wrangler deploy` on Workers cannot reproduce — every SSR route fails at runtime with `No such module "__next-on-pages-dist__/..."`. The OpenNext adapter emits a normal Worker bundle (`.open-next/worker.js`) + static assets (`.open-next/assets`), which `wrangler deploy` handles natively.

### Dashboard settings (Workers Builds)

In your Cloudflare dashboard → **Workers & Pages → hayaan → Settings → Builds & deployments**, set:

| Field | Value |
|---|---|
| **Build command** | `bun run build` |
| **Deploy command** | `npx wrangler deploy` |
| **Root directory** | `/` |
| **Compatibility flags** | `nodejs_compat` (already set in `wrangler.toml`) |

### Environment variables — two different places

**1. Build variables** (Build → Variables and Secrets). Next.js inlines `NEXT_PUBLIC_*` at build time — without these, the browser-side Supabase client is silently disabled:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mqyhgyakhfhuctnvezby.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (public — safe for browser) |

**2. Runtime variables & secrets** (Settings → Variables and Secrets), read via `process.env` in the Worker:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mqyhgyakhfhuctnvezby.supabase.co` (plain text; also in `wrangler.toml` `[vars]`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (plain text) |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role secret (**type: Secret** — never expose to the browser) |

### How it works

When you push to `main`:

1. **Workers Builds** clones your repo and runs `bun install --frozen-lockfile`
2. **Build command** (`bun run build` → `next build && opennextjs-cloudflare build --skipNextBuild`):
   - Runs `next build` to produce the standard Next.js output
   - Converts it into a single Worker bundle at `.open-next/worker.js` plus static assets in `.open-next/assets/`
   - `--skipNextBuild` prevents the adapter from re-running the `build` npm script recursively
3. **Deploy command** (`npx wrangler deploy`) reads `wrangler.toml`:
   - Uploads `.open-next/worker.js` as the Worker script (~1.4 MB gzipped)
   - Uploads `.open-next/assets/` as static assets
   - Binds the Worker to the `ASSETS` binding for static file serving
4. Your Worker is live at `https://hayaan-market.<your-subdomain>.workers.dev`

### CLI deploy alternative

```bash
# Build locally (emits .open-next/)
bun run build

# Deploy (requires wrangler CLI + Cloudflare auth)
npx wrangler deploy

# Or dry-run to verify config without deploying
npx wrangler deploy --dry-run

# Or preview the production worker locally
bun run preview
```

### Why lazy Prisma + bcrypt?

`@prisma/client` and `bcryptjs` use Node.js built-ins (`fs`, `crypto`) that don't work on the Workers runtime. To keep them out of the hot path, they're loaded via dynamic `await import()` inside the local-dev fallback branches. In production, `isSupabaseServerEnabled` is `true` (the three Supabase env vars are set), so those branches never execute. Note: do **not** re-add `export const runtime = "edge"` to routes — the edge runtime is deprecated in Next 16 and unsupported by the OpenNext adapter; everything runs in the same Worker.

If you ever want to remove the local Prisma fallback entirely, delete `src/lib/db.ts`, `src/lib/auth-session.ts`, `src/app/api/seed/route.ts`, and the `if (!isSupabaseServerEnabled)` branches in every route.

## Stack summary

| Layer       | Tech                                                              |
| ----------- | ----------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router) + React 19                                |
| Language    | TypeScript 5                                                      |
| Styling     | Tailwind CSS 4 + shadcn/ui (New York)                            |
| State       | Zustand (client) + TanStack Query (optional, server state)       |
| Auth        | bcrypt locally / Supabase Auth in production                     |
| Database    | Prisma + SQLite locally / Supabase Postgres in production        |
| Deployment  | Cloudflare Workers (`@opennextjs/cloudflare` adapter)           |

## License

MIT — use it for whatever you like.
