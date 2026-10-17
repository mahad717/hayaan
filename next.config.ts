import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers deployment uses the official OpenNext adapter
  // (`bun run build` → `opennextjs-cloudflare build`), which runs
  // `next build` and converts the output to `.open-next/worker.js` +
  // `.open-next/assets`. The standalone output below is what makes the
  // converted server runnable; it also enables `bun run start` on
  // Node.js hosts (Vercel, Railway, etc.).
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Mark Node-only packages as external so the Cloudflare bundler doesn't
  // try to bundle them. They're only loaded via dynamic import() in the
  // local-dev fallback paths, which never execute on Cloudflare.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "dotenv"],

  experimental: {
    // Reuse dynamic-route payloads in the client router cache for 30s.
    // Next's default is 0, so every router.push to a dynamic route (e.g.
    // "Back to shop" from /product/[slug] to "/") paid a full SSR
    // round-trip — very visible on mobile. With a 30s window, the PDP's
    // prefetch of "/" (see product-detail.tsx) lands in the cache and the
    // click swaps instantly from memory instead of re-rendering server-side.
    // Data surfaces (catalog/cart/orders/admin) are client-fetched via /api,
    // so a 30s-old RSC shell never hides fresher data.
    staleTimes: {
      dynamic: 30,
    },
  },

  // Task 108 — bfcache eligibility for the storefront's document routes.
  // force-dynamic emits `Cache-Control: private, no-cache, no-store, ...`
  // and `no-store` DISQUALIFIES the page from Chrome/Safari's back/forward
  // cache — which is why every "Back to shop" re-parsed the whole document
  // on the owner's A18 (video forensics 20261017: 3.3-3.5s returns whenever
  // the Speculation-Rules prerender hadn't finished building, vs instant
  // returns once it had). Dropping `no-store` while KEEPING `no-cache +
  // max-age=0 + must-revalidate` preserves the exact freshness semantics of
  // the HTTP cache (browser must revalidate every time; `private` keeps
  // shared caches out) while letting the browser snapshot the live page for
  // instant back/forward restores. Stale-snapshot risk on restore is covered
  // by a pageshow(persisted) catalog refetch in product-grid.tsx. Admin and
  // /api routes are intentionally untouched.
  async headers() {
    const bfcacheFriendly = [{ key: "Cache-Control", value: "private, no-cache, max-age=0, must-revalidate" }];
    return [
      { source: "/", headers: bfcacheFriendly },
      { source: "/product/:slug", headers: bfcacheFriendly },
      { source: "/category/:slug", headers: bfcacheFriendly },
    ];
  },
};

export default nextConfig;
