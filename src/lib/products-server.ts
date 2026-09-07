// Server-side product reads for SSR routes (product pages, sitemap).
// Same dual path as the API routes: Supabase service-role in production,
// Prisma + SQLite locally. Kept out of the API route so server components
// can reuse it without an HTTP round-trip.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

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

/** All active products (id + slug + updated), for sitemap generation. */
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
