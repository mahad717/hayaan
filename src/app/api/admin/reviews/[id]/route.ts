import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { deleteReview, isReviewsTableMissing, setReviewStatus } from "@/lib/reviews";

type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}

/** PATCH /api/admin/reviews/[id] — approve or hide ({ status: "approved" | "hidden" }). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const status = body.status;
  if (status !== "approved" && status !== "hidden") {
    return NextResponse.json({ error: "Status must be 'approved' or 'hidden'." }, { status: 400 });
  }

  try {
    await setReviewStatus(id, status);
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) {
      return NextResponse.json({ error: "Reviews are not migrated yet — run 2026-10-05-product-reviews.sql." }, { status: 503 });
    }
    return NextResponse.json({ error: err?.message ?? "Failed to update the review." }, { status: 500 });
  }
}

/** DELETE /api/admin/reviews/[id] — permanently remove a review. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin(req);
  if (guard) return guard;
  const { id } = await ctx.params;

  try {
    await deleteReview(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) {
      return NextResponse.json({ error: "Reviews are not migrated yet — run 2026-10-05-product-reviews.sql." }, { status: 503 });
    }
    return NextResponse.json({ error: err?.message ?? "Failed to delete the review." }, { status: 500 });
  }
}
