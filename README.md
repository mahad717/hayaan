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
- ☁️ `wrangler.toml` for Cloudflare Pages deployment

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

## Deploy to Cloudflare Pages

1. Push the repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select this repo. Cloudflare auto-detects Next.js.
4. Set build command to `bun run build` and output dir to `.next/standalone`.
5. Add the three Supabase env vars (and `DATABASE_URL` if keeping Prisma) under
   **Settings → Environment variables**.
6. Deploy.

Or from the CLI:

```bash
bunx wrangler pages deploy .next/standalone --project-name=mercado
```

## Stack summary

| Layer       | Tech                                                              |
| ----------- | ----------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router) + React 19                                |
| Language    | TypeScript 5                                                      |
| Styling     | Tailwind CSS 4 + shadcn/ui (New York)                            |
| State       | Zustand (client) + TanStack Query (optional, server state)       |
| Auth        | bcrypt locally / Supabase Auth in production                     |
| Database    | Prisma + SQLite locally / Supabase Postgres in production        |
| Deployment  | Cloudflare Pages (`@cloudflare/next-on-pages`)                  |

## License

MIT — use it for whatever you like.
