import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Update a category. PATCH /api/admin/categories/[id]
 * Admin-gated. Accepts { description } (and optionally { name }) — used for
 * SEO category descriptions; the /category/[slug] page surfaces the
 * description as visible content and in the meta/JSON-LD.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const updates: { name?: string; description?: string | null } = {};
  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    updates.name = name;
  }
  if (body?.description !== undefined) {
    const description = String(body.description).trim();
    updates.description = description || null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select("id, name, slug, description")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data });
  }

  const db = await getDb();
  const data = await db.category.update({
    where: { id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
    },
  });
  return NextResponse.json({
    category: { id: data.id, name: data.name, slug: data.slug, description: data.description },
  });
}
