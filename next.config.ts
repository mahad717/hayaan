import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages uses @cloudflare/next-on-pages to translate Next.js
  // into a Workers-compatible bundle. The standalone output is NOT used by
  // Cloudflare — that's only for Node.js deployments.
  //
  // We keep `output: "standalone"` so `bun run build` works for Node.js hosts
  // (Vercel, Railway, etc.). For Cloudflare, use `bun run build:pages` which
  // runs `@cloudflare/next-on-pages` and emits to `.vercel/output/static`.
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Mark Node-only packages as external so the Cloudflare bundler doesn't
  // try to bundle them. They're only loaded via dynamic import() in the
  // local-dev fallback paths, which never execute on Cloudflare.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "dotenv"],
};

export default nextConfig;
