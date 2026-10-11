import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import {
  addWishlistItem,
  isWishlistTableMissing,
  listWishlist,
  removeWishlistItem,
} from "@/lib/wishlist";

function unavailableResponse() {
  // wishlist_items table not migrated yet — hearts stay hidden and the
  // wishlist view shows its empty state instead of erroring. Mirrors the
  // product-reviews pattern: a normal pre-migration state, not an outage.
  return NextResponse.json(
    {
      products: [],
      unavailable: true,
      hint: "Run src/lib/supabase/migrations/2026-10-11-wishlist.sql in the Supabase SQL editor to enable the wishlist.",
    },
    { status: 200 },
  );
}

/**
 * GET /api/wishlist — the caller's saved products (newest first).
 * Guests get an empty list (same shape as the cart GET) so the UI can render
 * hearts optimistically; only a signed-in caller can get `unavailable: true`.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ products: [] });
  try {
    const products = await listWishlist(user.id);
    return NextResponse.json({ products });
  } catch (err: any) {
    if (isWishlistTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to load your wishlist." }, { status: 500 });
  }
}

/**
 * POST /api/wishlist { productId } — save a product (idempotent).
 * Returns the updated list so the client store stays in sync in one call.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in to save items to your wishlist." }, { status: 401 });
  }
  const { productId } = await req.json().catch(() => ({}));
  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }
  try {
    await addWishlistItem(user.id, productId);
    const products = await listWishlist(user.id);
    return NextResponse.json({ products, saved: true });
  } catch (err: any) {
    if (isWishlistTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to save the item." }, { status: 500 });
  }
}

/**
 * DELETE /api/wishlist?productId=… — remove a saved product (idempotent).
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in to update your wishlist." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }
  try {
    await removeWishlistItem(user.id, productId);
    const products = await listWishlist(user.id);
    return NextResponse.json({ products, saved: false });
  } catch (err: any) {
    if (isWishlistTableMissing(err)) return unavailableResponse();
    return NextResponse.json({ error: err?.message ?? "Failed to update your wishlist." }, { status: 500 });
  }
}
