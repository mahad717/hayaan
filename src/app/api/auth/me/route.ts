import { NextRequest, NextResponse } from "next/server";
import { isSupabaseServerEnabled, createServerClient } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  if (isSupabaseServerEnabled) {
    const supabase = await createServerClient();
    const { data } = await supabase!.auth.getUser();
    if (!data.user) return NextResponse.json({ user: null });
    const name = (data.user.user_metadata?.name as string) ?? data.user.email!.split("@")[0];
    const role = (data.user.user_metadata?.role as string) ?? "customer";
    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email!, name, role },
    });
  }
  const user = await getUserFromRequest(req);
  return NextResponse.json({ user });
}
