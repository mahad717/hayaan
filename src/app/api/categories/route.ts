import { NextResponse } from "next/server";

// Required by Cloudflare Pages — all API routes must run on the Edge Runtime.
export const runtime = "edge";
import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      categories: (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
      })),
    });
  }
  const categories = await (await getDb()).category.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
    })),
  });
}
