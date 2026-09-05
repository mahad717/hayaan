// Prisma client with lazy initialization.
//
// Why lazy: Cloudflare Pages runs on the V8 runtime, not Node.js. The
// `@prisma/client` package uses Node built-ins (fs, crypto) at module-load
// time, so a static `import { PrismaClient } from "@prisma/client"` at the
// top of a file would break the Cloudflare build. By using `await import()`
// inside `getDb()`, the bundler skips Prisma entirely when the function is
// never called — which is exactly what happens in production where every
// API route takes the Supabase path.
//
// Locally (without SUPABASE_SERVICE_ROLE_KEY), the API routes call
// `getDb()` and Prisma loads normally under Node.js.

import type { PrismaClient } from "@prisma/client";

type PrismaT = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaT | undefined;
};

let _db: PrismaT | null = null;

export async function getDb(): Promise<PrismaT> {
  if (_db) return _db;
  if (globalForPrisma.prisma) {
    _db = globalForPrisma.prisma;
    return _db;
  }
  // Dynamic import — only evaluated when this function is actually called.
  // Cloudflare's bundler treats this as a separate chunk and skips it when
  // the calling branch is unreachable.
  const { PrismaClient } = await import("@prisma/client");
  _db = new PrismaClient({ log: ["query"] });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = _db;
  return _db;
}

// Backwards-compat: legacy `db` export. Returns null — callers should
// migrate to `await getDb()`. Kept so old imports don't crash at build time.
export const db: PrismaT | null = null;
