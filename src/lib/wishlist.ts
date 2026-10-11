// Wishlist (Task 88) — server-side helpers behind /api/wishlist. Same dual
// path as every other store feature: Supabase service-role in production,
// Prisma + SQLite locally.
//
// Data flow: one row per (user, product) in the `wishlist_items` side-car
// table (RLS deny-all in Supabase — customers never touch it directly).
// The wishlist view and the header badge list full product rows, so reads
// join the saved product ids back onto the products table and keep the
// save order (newest first).
//
// Pre-migration degradation: if `wishlist_items` does not exist yet (owner
// hasn't run 2026-10-11-wishlist.sql), the API returns a structured
// `unavailable` response instead of 500-ing — hearts stay hidden and the
// wishlist view shows its empty state, mirroring the product-reviews
// pattern.
//
// Rows whose product has since been deleted (or deactivated) are skipped on
// read; the stale row is left in place harmlessly (products are never
// hard-deleted in practice, and Supabase has ON DELETE CASCADE anyway).

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { rowToProduct } from "@/lib/products-server";
import type { Product } from "@/lib/types";

/** True when the wishlist_items table has not been migrated yet. */
export function isWishlistTableMissing(
  err: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = err.message ?? "";
  // PostgREST: missing table surfaces as PGRST205 with a schema-cache message.
  if (code === "PGRST205" && /wishlist_items/i.test(msg)) return true;
  if (/could not find the table.*wishlist_items/i.test(msg)) return true;
  // Raw Postgres / Prisma-shaped messages.
  if (/relation .*wishlist_items.* does not exist/i.test(msg)) return true;
  if (/no such table: ?wishlist_items/i.test(msg)) return true;
  return false;
}

/**
 * The user's wishlist, newest save first. Products that no longer resolve
 * (deleted/deactivated) are silently skipped — the caller never sees a hole.
 * Throws raw errors — callers wrap with isWishlistTableMissing.
 */
export async function listWishlist(userId: string): Promise<Product[]> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("created_at, product:products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? [])
      .map((row: any) => (row.product ? rowToProduct(row.product) : null))
      .filter((p: Product | null): p is Product => p !== null && p.isActive !== false);
  }

  const db = await getDb();
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  if (rows.length === 0) return [];
  const productIds = rows.map((r) => r.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  // Keep the save order, drop products that vanished.
  return rows
    .map((r) => byId.get(r.productId))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => rowToProduct(p as unknown as Record<string, unknown>));
}

/**
 * Save a product for the user. Idempotent — saving twice keeps one row.
 * Throws raw errors — callers wrap with isWishlistTableMissing.
 */
export async function addWishlistItem(userId: string, productId: string): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase
      .from("wishlist_items")
      .upsert(
        { user_id: userId, product_id: productId },
        { onConflict: "user_id,product_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return;
  }

  const db = await getDb();
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
}

/**
 * Remove a product from the user's wishlist. Idempotent — removing a product
 * that isn't saved is a no-op.
 * Throws raw errors — callers wrap with isWishlistTableMissing.
 */
export async function removeWishlistItem(userId: string, productId: string): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
    return;
  }

  const db = await getDb();
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
}
