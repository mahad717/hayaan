// Session helper for the local fallback. Stores a signed-looking session cookie.
// When Supabase is enabled, sessions are managed by @supabase/ssr directly.
//
// Lazy Prisma: `getDb()` dynamically imports @prisma/client only when called,
// which means Prisma is never bundled into the Cloudflare build (the Supabase
// path always runs in production).

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SafeUser } from "@/lib/types";

const COOKIE_NAME = "shop_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export function setAuthCookie(res: NextResponse, userId: string): NextResponse {
  res.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}

export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export async function getUserFromRequest(req: Request): Promise<SafeUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const userId = decodeURIComponent(match.split("=")[1] ?? "");
  if (!userId) return null;
  const db = await getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return user ?? null;
}
