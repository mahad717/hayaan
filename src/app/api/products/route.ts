import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { upsertProductCost, isMissingAccountingSchema, accountingUnavailableResponse } from "@/lib/accounting";
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
    isActive: row.isActive ?? row.is_active,
    // Supabase rows are snake_case (category_id); Prisma rows are camelCase.
    // Without the fallback every product's categoryId came back undefined and
    // the storefront's category pills filtered EVERYTHING out ("No products
    // found" on any pill except All) while the DB data itself was intact.
    categoryId: row.categoryId ?? row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const sort = searchParams.get("sort") ?? "newest";
  const limit = Number(searchParams.get("limit") ?? 100);

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    let query = supabase.from("products").select("*, category:categories(*)").eq("is_active", true);
    if (q) query = query.ilike("name", `%${q}%`);
    if (category && category !== "all") query = query.eq("category_id", category);
    if (featured === "true") query = query.eq("featured", true);
    if (sort === "price-asc") query = query.order("price", { ascending: true });
    else if (sort === "price-desc") query = query.order("price", { ascending: false });
    else if (sort === "rating") query = query.order("rating", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    const { data, error } = await query.limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: (data ?? []).map(rowToProduct) });
  }

  const products = await (await getDb()).product.findMany({
    where: {
      isActive: true,
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
      ...(category && category !== "all" ? { categoryId: category } : {}),
      ...(featured === "true" ? { featured: true } : {}),
    },
    include: { category: true },
    orderBy:
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
          ? { price: "desc" }
          : sort === "rating"
            ? { rating: "desc" }
            : { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ products: products.map(rowToProduct) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json();
  const { name, description, price, compareAt, currency, sku, stock, images, tags, categoryId, featured, cost } = body;
  if (!name || !description || !price || !categoryId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  // Confidential supplier cost (Task 49). Validated server-side: >= 0, and
  // stored in the RLS-locked product_costs side-car — never on the product
  // row that public queries read.
  let costValue: number | null = null;
  if (cost !== undefined && cost !== null && cost !== "") {
    costValue = Number(cost);
    if (!Number.isFinite(costValue) || costValue < 0) {
      return NextResponse.json({ error: "Product cost must be zero or greater." }, { status: 400 });
    }
  }
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        description,
        price,
        compare_at: compareAt ?? null,
        currency: currency ?? "USD",
        sku: sku ?? null,
        stock: stock ?? 0,
        images: images ?? [],
        tags: tags ?? [],
        featured: featured ?? false,
        category_id: categoryId,
      })
      .select("*, category:categories(*)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (costValue != null) {
      try {
        await upsertProductCost(data.id, costValue, user);
      } catch (err: any) {
        if (isMissingAccountingSchema(err)) {
          return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    return NextResponse.json({ product: rowToProduct(data) });
  }
  const product = await (await getDb()).product.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      description,
      price,
      compareAt,
      currency: currency ?? "USD",
      sku,
      stock: stock ?? 0,
      images: JSON.stringify(images ?? []),
      tags: JSON.stringify(tags ?? []),
      featured: featured ?? false,
      categoryId,
    },
    include: { category: true },
  });
  if (costValue != null) {
    try {
      await upsertProductCost(product.id, costValue, user);
    } catch (err: any) {
      if (isMissingAccountingSchema(err)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }
  return NextResponse.json({ product: rowToProduct(product) });
}
