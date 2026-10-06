// Product reviews (Task 85) — server-side helpers shared by the public PDP
// review APIs and the admin moderation queue. Same dual path as every other
// store feature: Supabase service-role in production, Prisma + SQLite locally.
//
// Data flow: reviews live in the `product_reviews` side-car table (RLS
// deny-all in Supabase — customers never touch it directly). Every write
// RECOMPUTES the average/count over approved reviews and denormalizes them
// onto products.rating / products.review_count, so product cards, the PDP
// header, sort-by-rating, and the Product JSON-LD aggregateRating all read
// the summary with zero extra queries.
//
// Pre-migration degradation: if `product_reviews` does not exist yet (owner
// hasn't run 2026-10-05-product-reviews.sql), the APIs return a structured
// `unavailable` response instead of 500-ing — the PDP hides the section and
// the admin dashboard shows the migration hint, mirroring the accounting
// pattern.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import type { ProductReview, ReviewSummary } from "@/lib/types";

export const REVIEW_STATUSES = ["approved", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** True when the product_reviews table has not been migrated yet. */
export function isReviewsTableMissing(
  err: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = err.message ?? "";
  // PostgREST: missing table surfaces as PGRST205 with a schema-cache message.
  if (code === "PGRST205" && /product_reviews/i.test(msg)) return true;
  if (/could not find the table.*product_reviews/i.test(msg)) return true;
  // Raw Postgres / Prisma-shaped messages.
  if (/relation .*product_reviews.* does not exist/i.test(msg)) return true;
  if (/no such table: ?product_reviews/i.test(msg)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type ReviewRow = Record<string, any>;

function rowToReview(row: ReviewRow): ProductReview {
  return {
    id: row.id,
    productId: row.productId ?? row.product_id,
    rating: Number(row.rating),
    authorName: row.authorName ?? row.author_name ?? "",
    comment: row.comment ?? "",
    verifiedPurchase: Boolean(row.verifiedPurchase ?? row.verified_purchase),
    status: row.status === "hidden" ? "hidden" : "approved",
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

/** Public payload — strips the reviewer identity (privacy). */
function publicReview(r: ProductReview): ProductReview {
  return {
    id: r.id,
    productId: r.productId,
    rating: r.rating,
    authorName: r.authorName,
    comment: r.comment,
    verifiedPurchase: r.verifiedPurchase,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Approved reviews for a product, newest first. Throws raw errors — callers
 *  wrap with isReviewsTableMissing. */
export async function listApprovedReviews(productId: string, limit = 100): Promise<ProductReview[]> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, product_id, user_id, author_name, rating, comment, verified_purchase, status, created_at, updated_at")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(rowToReview);
  }

  const db = await getDb();
  const rows = await db.review.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => rowToReview(r as unknown as ReviewRow));
}

/** ALL reviews for the admin queue (both statuses), newest first. */
export async function listAllReviews(limit = 200): Promise<ProductReview[]> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, product_id, user_id, author_name, rating, comment, verified_purchase, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(rowToReview);
  }

  const db = await getDb();
  const rows = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => rowToReview(r as unknown as ReviewRow));
}

/** The requesting user's own review of a product (any status). */
export async function getMyReview(productId: string, userId: string): Promise<ProductReview | null> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, product_id, user_id, author_name, rating, comment, verified_purchase, status, created_at, updated_at")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { ...rowToReview(data), userId } : null;
  }

  const db = await getDb();
  const row = await db.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  return row ? { ...rowToReview(row as unknown as ReviewRow), userId } : null;
}

/** Summary over approved reviews: average (1 decimal), count, distribution. */
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .select("rating")
      .eq("product_id", productId)
      .eq("status", "approved")
      .limit(1000);
    if (error) throw error;
    return summarize((data ?? []).map((r: any) => Number(r.rating)));
  }

  const db = await getDb();
  const rows = await db.review.findMany({
    where: { productId, status: "approved" },
    select: { rating: true },
  });
  return summarize(rows.map((r) => r.rating));
}

function summarize(ratings: number[]): ReviewSummary {
  const count = ratings.length;
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  for (const r of ratings) {
    total += r;
    if (distribution[String(r)] !== undefined) distribution[String(r)] += 1;
  }
  return {
    average: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    count,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** True when the user has a PAID order containing this product. */
export async function isVerifiedPurchase(productId: string, userId: string): Promise<boolean> {
  const PAID_ORDER_STATUSES = ["paid", "shipped", "delivered"];
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, items:order_items(product_id)")
      .eq("user_id", userId)
      .limit(200);
    if (error) return false; // verification is a bonus flag — never block the review
    const paid = (data ?? []).filter(
      (o: any) => o.payment_status === "paid" || PAID_ORDER_STATUSES.includes(o.status),
    );
    return paid.some((o: any) => (o.items ?? []).some((i: any) => i.product_id === productId));
  }

  const db = await getDb();
  const item = await db.orderItem.findFirst({
    where: {
      productId,
      order: { userId, OR: [{ paymentStatus: "paid" }, { status: { in: PAID_ORDER_STATUSES } }] },
    },
    select: { id: true },
  });
  return !!item;
}

/** Create or update the user's review (one per product per user), then
 *  refresh the denormalized product aggregates. `status` resets to approved
 *  on edit — an author fixing a hidden review publishes the new text. */
export async function upsertReview(input: {
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<ProductReview> {
  const verified = await isVerifiedPurchase(input.productId, input.userId);

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .upsert(
        {
          product_id: input.productId,
          user_id: input.userId,
          author_name: input.authorName,
          rating: input.rating,
          comment: input.comment,
          verified_purchase: verified,
          status: "approved",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,user_id" },
      )
      .select("id, product_id, user_id, author_name, rating, comment, verified_purchase, status, created_at, updated_at")
      .single();
    if (error) throw error;
    await recomputeProductRating(input.productId);
    return { ...rowToReview(data), userId: input.userId };
  }

  const db = await getDb();
  const saved = await db.review.upsert({
    where: { productId_userId: { productId: input.productId, userId: input.userId } },
    create: {
      productId: input.productId,
      userId: input.userId,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      verifiedPurchase: verified,
      status: "approved",
    },
    update: {
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      verifiedPurchase: verified,
      status: "approved",
    },
  });
  await recomputeProductRating(input.productId);
  return { ...(saved as unknown as ProductReview), userId: input.userId };
}

/** Admin moderation: approve / hide. Hidden reviews stay (author can see the
 *  hint) but never count toward aggregates. */
export async function setReviewStatus(reviewId: string, status: ReviewStatus): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .select("product_id")
      .single();
    if (error) throw error;
    await recomputeProductRating(data.product_id);
    return;
  }

  const db = await getDb();
  const row = await db.review.update({ where: { id: reviewId }, data: { status } });
  await recomputeProductRating(row.productId);
}

/** Delete a review (admin anywhere; the author via the ownership-checked
 *  public route), then refresh that product's aggregates. */
export async function deleteReview(reviewId: string): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("id", reviewId)
      .select("product_id")
      .single();
    if (error) throw error;
    await recomputeProductRating(data.product_id);
    return;
  }

  const db = await getDb();
  const row = await db.review.delete({ where: { id: reviewId } });
  await recomputeProductRating(row.productId);
}

/** Recompute products.rating / products.review_count over approved reviews.
 *  Called after every write so every surface (cards, PDP, sort, JSON-LD)
 *  stays in sync without joining reviews at read time. */
export async function recomputeProductRating(productId: string): Promise<ReviewSummary> {
  const summary = await getReviewSummary(productId);

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase
      .from("products")
      .update({ rating: summary.average, review_count: summary.count })
      .eq("id", productId);
    if (error) throw error;
    return summary;
  }

  const db = await getDb();
  await db.product.update({
    where: { id: productId },
    data: { rating: summary.average, reviewCount: summary.count },
  });
  return summary;
}

export { publicReview };
