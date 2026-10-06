import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import {
  deleteReview,
  getMyReview,
  getReviewSummary,
  isReviewsTableMissing,
  listApprovedReviews,
  publicReview,
  upsertReview,
} from "@/lib/reviews";
import type { ProductReview } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function unavailableResponse() {
  // product_reviews table not migrated yet — the PDP hides the section
  // instead of erroring. Mirrors the accounting 503 pattern but softer: this
  // is a normal pre-migration state, not an outage.
  return NextResponse.json(
    {
      reviews: [],
      summary: { average: 0, count: 0 },
      unavailable: true,
      hint: "Run src/lib/supabase/migrations/2026-10-05-product-reviews.sql in the Supabase SQL editor to enable reviews.",
    },
    { status: 200 },
  );
}

/**
 * GET /api/products/[id]/reviews — public.
 * Approved reviews (newest first) + summary + (when signed in) the caller's
 * own review so the PDP form can prefill an edit.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: productId } = await ctx.params;
  try {
    const [reviews, summary, user] = await Promise.all([
      listApprovedReviews(productId),
      getReviewSummary(productId),
      getCurrentUser(req),
    ]);

    let myReview: ProductReview | null = null;
    if (user) {
      try {
        // A hidden review stays visible to its author (with the status hint).
        myReview = await getMyReview(productId, user.id);
      } catch {
        // Non-fatal: the section still renders without the edit prefill.
      }
    }

    return NextResponse.json({
      reviews: reviews.map(publicReview),
      summary,
      myReview,
      canReview: !!user,
    });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to load reviews." }, { status: 500 });
  }
}

const MAX_COMMENT = 2000;

/**
 * POST /api/products/[id]/reviews — signed-in customers (and admins).
 * One review per user per product: a second POST updates the first.
 * Auto-approved; admin moderation (hide/delete) happens in the dashboard.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: productId } = await ctx.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  }

  let body: { rating?: unknown; comment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be a whole number from 1 to 5." }, { status: 400 });
  }

  const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (rawComment.length > MAX_COMMENT) {
    return NextResponse.json({ error: `Comments are limited to ${MAX_COMMENT} characters.` }, { status: 400 });
  }
  // A rating-only review is fine; the star summary is the primary signal.

  try {
    const saved = await upsertReview({
      productId,
      userId: user.id,
      authorName: user.name || user.email.split("@")[0],
      rating,
      comment: rawComment,
    });
    const summary = await getReviewSummary(productId);
    return NextResponse.json({ review: { ...publicReview(saved), userId: user.id }, summary });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to save the review." }, { status: 500 });
  }
}

/** DELETE /api/products/[id]/reviews — the author removes their own review. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: productId } = await ctx.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const mine = await getMyReview(productId, user.id);
    if (!mine) {
      return NextResponse.json({ error: "You have not reviewed this product." }, { status: 404 });
    }
    await deleteReview(mine.id);
    const summary = await getReviewSummary(productId);
    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to delete the review." }, { status: 500 });
  }
}
