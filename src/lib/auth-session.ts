// Session helper. Stores the app's own `shop_session` cookie (user id) which
// login/signup set in BOTH modes. In Supabase mode it is a durable fallback
// for the @supabase/ssr `sb-*` cookies: if those are ever lost, expired
// (no refresh middleware on Cloudflare), or fail to persist, the session is
// still resolvable through this cookie.
//
// Lazy Prisma: `getDb()` dynamically imports @prisma/client only when called,
// which means Prisma is never bundled into the Cloudflare build (the Supabase
// path always runs in production).

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
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

export function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const userId = decodeURIComponent(match.split("=")[1] ?? "");
  return userId || null;
}

/**
 * Resolve a Supabase auth user id to an app profile. Reads public.users
 * first (service role — RLS-free), and falls back to the auth user's
 * user_metadata when the profile row has not been synced yet.
 */
export async function getSupabaseUserById(userId: string): Promise<SafeUser | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      role: profile.role === "admin" ? "admin" : "customer",
    };
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  const u = data.user;
  const name = (u.user_metadata?.name as string | undefined) ?? u.email.split("@")[0];
  const role = (u.user_metadata?.role as string | undefined) ?? "customer";
  return { id: u.id, email: u.email, name, role: role === "admin" ? "admin" : "customer" };
}

export async function getUserFromRequest(req: Request): Promise<SafeUser | null> {
  const userId = readSessionCookie(req);
  if (!userId) return null;

  // Supabase mode: resolve the id against Supabase. Prisma/SQLite cannot run
  // on Cloudflare Workers, so the Prisma lookup below is local-only.
  if (isSupabaseServerEnabled) {
    return getSupabaseUserById(userId);
  }

  const db = await getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return user ?? null;
}
