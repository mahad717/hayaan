import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  upsertProductCost,
  deleteProductCost,
  getProductCost,
  auditChange,
  isMissingAccountingSchema,
  accountingUnavailableResponse,
} from "@/lib/accounting";
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
  const product = await (await getDb()).product.findUnique({ where: { id }, include: { category: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product: rowToProduct(product) });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json();

  // Confidential cost updates (Task 49): validate, audit old → new, then
  // persist in the RLS-locked side-car. Never touches the public product row.
  if (body.cost !== undefined) {
    const oldCost = await getProductCost(id);
    if (body.cost === null || body.cost === "") {
      try {
        await deleteProductCost(id);
        await auditChange({ actor: user, entity: "product", entityId: id, field: "cost", oldValue: oldCost, newValue: null });
      } catch (err: any) {
        if (isMissingAccountingSchema(err)) return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else {
      const newCost = Number(body.cost);
      if (!Number.isFinite(newCost) || newCost < 0) {
        return NextResponse.json({ error: "Product cost must be zero or greater." }, { status: 400 });
      }
      try {
        await upsertProductCost(id, newCost, user);
        if (oldCost !== newCost) {
          await auditChange({ actor: user, entity: "product", entityId: id, field: "cost", oldValue: oldCost, newValue: newCost });
        }
      } catch (err: any) {
        if (isMissingAccountingSchema(err)) return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
  }
  // Selling price is also a sensitive financial field — audit the change.
  if (body.price !== undefined) {
    const supabase = isSupabaseServerEnabled ? createServiceClient()! : null;
    const oldPrice = supabase
      ? await supabase.from("products").select("price").eq("id", id).single().then((r: any) => (r.data ? Number(r.data.price) : null))
      : await (await getDb()).product.findUnique({ where: { id }, select: { price: true } }).then((p) => (p ? p.price : null));
    if (oldPrice != null && Number(body.price) !== oldPrice) {
      await auditChange({ actor: user, entity: "product", entityId: id, field: "price", oldValue: oldPrice, newValue: Number(body.price) });
    }
  }
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
    if (body.supplierUrl !== undefined) update.supplier_url = body.supplierUrl;
    if (body.supplierSku !== undefined) update.supplier_sku = body.supplierSku;
    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .select("*, category:categories(*)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ product: rowToProduct(data) });
  }
  const updated = await (await getDb()).product.update({
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
      ...(body.supplierUrl !== undefined ? { supplierUrl: body.supplierUrl } : {}),
      ...(body.supplierSku !== undefined ? { supplierSku: body.supplierSku } : {}),
    },
    include: { category: true },
  });
  return NextResponse.json({ product: rowToProduct(updated) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  await (await getDb()).product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
