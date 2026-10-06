import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { isReviewsTableMissing, listAllReviews } from "@/lib/reviews";

/**
 * GET /api/admin/reviews — admin moderation queue.
 * ALL reviews (approved + hidden), newest first, joined with the product
 * name/slug so the dashboard can render one flat table.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const reviews = await listAllReviews();
    // Resolve product names for the table. Small store — one catalog fetch is
    // cheaper (and simpler) than a per-review join.
    const { getDb } = await import("@/lib/db");
    const { isSupabaseServerEnabled, createServiceClient } = await import("@/lib/supabase/server");
    const byId = new Map<string, { name: string; slug: string }>();

    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      const { data, error } = await supabase.from("products").select("id, name, slug").limit(2000);
      if (error) throw error;
      for (const p of data ?? []) byId.set(p.id, { name: p.name, slug: p.slug });
    } else {
      const db = await getDb();
      const products = await db.product.findMany({ select: { id: true, name: true, slug: true } });
      for (const p of products) byId.set(p.id, { name: p.name, slug: p.slug });
    }

    return NextResponse.json({
      reviews: reviews.map((r) => ({ ...r, product: byId.get(r.productId) ?? null })),
      total: reviews.length,
    });
  } catch (err: any) {
    if (isReviewsTableMissing(err)) {
      return NextResponse.json(
        {
          reviews: [],
          total: 0,
          unavailable: true,
          hint: "Run src/lib/supabase/migrations/2026-10-05-product-reviews.sql in the Supabase SQL editor to enable reviews.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: err?.message ?? "Failed to load reviews." }, { status: 500 });
  }
}
