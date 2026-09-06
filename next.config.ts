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
};

export default nextConfig;
