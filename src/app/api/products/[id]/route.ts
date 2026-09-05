import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/auth-session";
import type { Product } from "@/lib/types";

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAt: row.compareAt != null ? Number(row.compareAt) : null,
    currency: row.currency ?? "USD",
    sku: row.sku ?? null,
    stock: row.stock,
    rating: row.rating,
    reviewCount: row.reviewCount,
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || "[]"),
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || "[]"),
    featured: row.featured,
    isActive: row.isActive,
    categoryId: row.categoryId ?? row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
      : undefined,
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ product: rowToProduct(data) });
  }
  const product = await db.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product: rowToProduct(product) });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json();
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.price !== undefined) update.price = body.price;
    if (body.compareAt !== undefined) update.compare_at = body.compareAt;
    if (body.stock !== undefined) update.stock = body.stock;
    if (body.images !== undefined) update.images = body.images;
    if (body.tags !== undefined) update.tags = body.tags;
    if (body.featured !== undefined) update.featured = body.featured;
    if (body.isActive !== undefined) update.is_active = body.isActive;
    if (body.categoryId !== undefined) update.category_id = body.categoryId;
    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .select("*, category:categories(*)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ product: rowToProduct(data) });
  }
  const updated = await db.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.compareAt !== undefined ? { compareAt: body.compareAt } : {}),
      ...(body.stock !== undefined ? { stock: body.stock } : {}),
      ...(body.images !== undefined ? { images: JSON.stringify(body.images) } : {}),
      ...(body.tags !== undefined ? { tags: JSON.stringify(body.tags) } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
    },
    include: { category: true },
  });
  return NextResponse.json({ product: rowToProduct(updated) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  await db.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
