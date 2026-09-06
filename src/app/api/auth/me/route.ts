// Session restore — used by the storefront on load. Delegates to the unified
// resolver which tries the @supabase/ssr cookie session first and falls back
// to the durable `shop_session` cookie (see src/lib/current-user.ts).
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  return NextResponse.json({ user });
}
