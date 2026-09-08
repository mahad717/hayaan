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
};

export default nextConfig;
