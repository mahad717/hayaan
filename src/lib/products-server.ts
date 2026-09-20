// Server-side product reads for SSR routes (product pages, sitemap).
// Same dual path as the API routes: Supabase service-role in production,
// Prisma + SQLite locally. Kept out of the API route so server components
// can reuse it without an HTTP round-trip.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { CATEGORY_SEO_DESCRIPTIONS } from "@/lib/category-seo";
import type { Category, Product } from "@/lib/types";

export function rowToProduct(row: any): Product {
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
    categoryId: row.categoryId ?? row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
      : undefined,
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("slug", decodeURIComponent(slug))
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToProduct(data) : null;
  }

  const product = await (await getDb()).product.findFirst({
    where: { slug: decodeURIComponent(slug), isActive: true },
    include: { category: true },
  });
  return product ? rowToProduct(product) : null;
}

/** All active products for the storefront grid — mirrors GET /api/products'
 *  default (newest-first) query. Used by the home page to render the catalog
 *  into the SSR HTML. */
export async function listActiveProducts(limit = 100): Promise<Product[]> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToProduct);
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(rowToProduct);
}

/** Categories for the storefront filter pills — mirrors GET /api/categories. */
export async function listCategories(): Promise<Category[]> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
    }));
  }

  const categories = await (await getDb()).category.findMany({ orderBy: { name: "asc" } });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
  }));
}

/** One category by slug (for /category/[slug] landing pages).
 *
 *  Description precedence: a SUBSTANTIAL owner-authored DB description
 *  (>= 80 chars) wins outright. Short DB stubs (seed-era labels like
 *  "Laptops, printers, TVs, gaming and accessories.") are replaced by the
 *  keyword-targeted SEO fallback — the owner asked for exactly this in
 *  Task 73 and can still override anything longer via
 *  PATCH /api/admin/categories/[id]. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const decoded = decodeURIComponent(slug);
  const withSeoFallback = (c: Category): Category => {
    const db = c.description?.trim() ?? "";
    const description = db.length >= 80 ? db : CATEGORY_SEO_DESCRIPTIONS[c.slug] || db || null;
    return { ...c, description };
  };

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", decoded)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? withSeoFallback({ id: data.id, name: data.name, slug: data.slug, description: data.description ?? null })
      : null;
  }

  const category = await (await getDb()).category.findFirst({ where: { slug: decoded } });
  return category
    ? withSeoFallback({ id: category.id, name: category.name, slug: category.slug, description: category.description ?? null })
    : null;
}

/** Active products in one category, newest-first — mirrors the storefront
 *  grid order so /category/[slug] pages show the same cards. */
export async function listProductsByCategorySlug(slug: string, limit = 100): Promise<Product[]> {
  const decoded = decodeURIComponent(slug);
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .select("*, category:categories!inner(id, name, slug, description)")
      .eq("is_active", true)
      .eq("categories.slug", decoded)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToProduct);
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true, category: { slug: decoded } },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(rowToProduct);
}

/** All active product+category slugs (with names) for sitemap + category
 *  hub generation. */
export async function listActiveProductSlugs(): Promise<Array<{ slug: string; updatedAt: Date | string }>> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true)
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ slug: row.slug, updatedAt: row.updated_at }));
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    take: 1000,
  });
  return products;
}
