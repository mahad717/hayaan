// GET /api/digital/download?item=<order_item_id>
//
// Gated delivery for digital products (Task 82). The order item's product is
// resolved server-side and the buyer is redirected (302) to the deliverable:
//   • "https://…"            → external link, redirected as-is
//   • "sb://<bucket>/<path>" → PRIVATE Supabase Storage object; a short-lived
//                              signed URL (5 min) is minted per request, so
//                              the raw object never becomes public
//
// Entitlement rules (all enforced here, none trustable from the client):
//   • the signed-in user must own the order
//   • the order must be collected: status paid/shipped/delivered OR the
//     gateway payment_status is "paid"
//   • the product must still be a digital product with a delivery link
//
// The URL itself never appears in any public product/order payload — this
// endpoint is the only path to it, so sharing the /api/digital/download link
// is useless without the buyer's session cookie.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";

const SIGNED_URL_TTL_SECONDS = 300;

const PAID_STATUSES = new Set(["paid", "shipped", "delivered"]);

function orderIsCollected(order: { status: string; paymentStatus: string }): boolean {
  return PAID_STATUSES.has(order.status) || order.paymentStatus === "paid";
}

/** Parse "sb://<bucket>/<path>" storage references. Returns null otherwise. */
function parseStorageRef(url: string): { bucket: string; path: string } | null {
  const match = /^sb:\/\/([^/]+)\/(.+)$/.exec(url.trim());
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to download your purchase." }, { status: 401 });
  }
  const itemId = new URL(req.url).searchParams.get("item");
  if (!itemId) {
    return NextResponse.json({ error: "Missing item." }, { status: 400 });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data: row } = await supabase
      .from("order_items")
      .select(
        "id, order_id, orders(id, user_id, status, payment_status), product:products(product_type, digital_url, digital_instructions)",
      )
      .eq("id", itemId)
      .maybeSingle();
    if (!row || !row.orders || (row.orders as any).user_id !== user.id) {
      return NextResponse.json({ error: "Download not found for this account." }, { status: 404 });
    }
    if (!orderIsCollected({ status: (row.orders as any).status, paymentStatus: (row.orders as any).payment_status ?? "pending" })) {
      return NextResponse.json({ error: "This download unlocks as soon as your payment is confirmed." }, { status: 403 });
    }
    const product = row.product as any;
    if (!product || product.product_type !== "digital" || !product.digital_url) {
      return NextResponse.json({ error: "This item is not a digital download." }, { status: 400 });
    }

    const trimmed = (product.digital_url as string).trim();
    // Private Supabase Storage object → mint a short-lived signed URL.
    const ref = parseStorageRef(trimmed);
    if (ref) {
      const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: "Could not generate the download link — try again." }, { status: 500 });
      }
      return NextResponse.redirect(data.signedUrl, 302);
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return NextResponse.redirect(trimmed, 302);
    }
    return NextResponse.json(
      { error: "This product's download link is misconfigured — please contact support@hayaan.co." },
      { status: 500 },
    );
  }

  const item = await (await getDb()).orderItem.findUnique({
    where: { id: itemId },
    include: {
      order: { select: { userId: true, status: true, paymentStatus: true } },
      product: { select: { productType: true, digitalUrl: true } },
    },
  });
  if (!item || item.order.userId !== user.id) {
    return NextResponse.json({ error: "Download not found for this account." }, { status: 404 });
  }
  if (!orderIsCollected({ status: item.order.status, paymentStatus: item.order.paymentStatus })) {
    return NextResponse.json({ error: "This download unlocks as soon as your payment is confirmed." }, { status: 403 });
  }
  if (item.product.productType !== "digital" || !item.product.digitalUrl) {
    return NextResponse.json({ error: "This item is not a digital download." }, { status: 400 });
  }
  const target = item.product.digitalUrl.trim();
  // Local preview has no Supabase Storage; external https links still work.
  if (/^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, 302);
  }
  return NextResponse.json(
    { error: "This product's download link is misconfigured — please contact support@hayaan.co." },
    { status: 500 },
  );
}
