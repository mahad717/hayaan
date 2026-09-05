import { NextResponse } from "next/server";

// Required by Cloudflare Pages — all API routes must run on the Edge Runtime.
export const runtime = "edge";
import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { clearAuthCookie } from "@/lib/auth-session";

export async function POST() {
  if (isSupabaseServerEnabled) {
    const supabase = await createServerClient();
    await supabase!.auth.signOut();
  }
  const res = NextResponse.json({ ok: true });
  return clearAuthCookie(res);
}
