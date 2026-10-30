// POST /api/orders/lookup — Task 136 (guest checkout) order status for guests.
//
// Body: { ids: string[] } — the order references a guest's browser keeps in
// localStorage ("Track your order" view). Returns a minimal, read-only
// projection of ONLY guest orders (user_id IS NULL) whose id is in the list:
//   • a signed-in customer's orders are unreachable here (their /api/orders
//     view already covers them),
//   • ids are unguessable, so the endpoint leaks nothing to a caller that
//     doesn't already hold the reference,
//   • at most 20 ids per call, each shape-checked — nothing enumerates.
// Digital download links intentionally stay out: /api/digital/download keeps
// its own session/ownership gate, and guests track via WhatsApp support.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

// Local Prisma ids are cuids, Supabase ids are uuids — one permissive shape
// check covers both without letting junk through.
const SAFE_ID = /^[A-Za-z0-9_-]{8,40}$/;

export async function POST(req: NextRequest) {
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids = raw
    .filter((id): id is string => typeof id === "string" && SAFE_ID.test(id))
    .slice(0, 20);
  if (ids.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, total_amount, currency, created_at, items:order_items(name, price, quantity, image, product:products(product_type))")
      .in("id", ids)
      .is("user_id", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      orders: (data ?? []).map((o: any) => ({
        id: o.id,
        status: o.status,
        paymentStatus: o.payment_status ?? "pending",
        totalAmount: Number(o.total_amount),
        currency: o.currency,
        createdAt: o.created_at,
        items: (o.items ?? []).map((it: any) => ({
          name: it.name,
          price: Number(it.price),
          quantity: it.quantity,
          image: it.image,
          isDigital: it.product?.product_type === "digital",
        })),
      })),
    });
  }

  const orders = await (await getDb()).order.findMany({
    where: { id: { in: ids }, userId: null },
    include: { items: { include: { product: { select: { productType: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus ?? "pending",
      totalAmount: o.totalAmount,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((it) => ({
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image,
        isDigital: it.product.productType === "digital",
      })),
    })),
  });
}
