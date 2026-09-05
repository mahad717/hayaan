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
    categoryId: row.categoryId,
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

  const products = await db.product.findMany({
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
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json();
  const { name, description, price, compareAt, currency, sku, stock, images, tags, categoryId, featured } = body;
  if (!name || !description || !price || !categoryId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
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
    return NextResponse.json({ product: rowToProduct(data) });
  }
  const product = await db.product.create({
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
  return NextResponse.json({ product: rowToProduct(product) });
}
