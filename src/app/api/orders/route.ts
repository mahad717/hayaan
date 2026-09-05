import { NextRequest, NextResponse } from "next/server";

// Required by Cloudflare Pages — all API routes must run on the Edge Runtime.
export const runtime = "edge";
import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import type { Order } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ orders: [] });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      orders: (data ?? []).map((o) => ({
        ...o,
        totalAmount: Number(o.total_amount),
        items: (o.items ?? []).map((it: any) => ({ ...it, price: Number(it.price) })),
        createdAt: o.created_at,
      })),
    });
  }
  const orders = await (await getDb()).order.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  const out: Order[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    status: o.status as Order["status"],
    totalAmount: o.totalAmount,
    currency: o.currency,
    shippingName: o.shippingName,
    shippingAddress: o.shippingAddress,
    shippingCity: o.shippingCity,
    shippingZip: o.shippingZip,
    shippingCountry: o.shippingCountry,
    paymentMethod: o.paymentMethod,
    paymentRef: o.paymentRef,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      image: it.image,
    })),
    createdAt: o.createdAt.toISOString(),
  }));
  return NextResponse.json({ orders: out });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in to place an order." }, { status: 401 });

  const body = await req.json();
  const { shipping, paymentMethod = "card" } = body as {
    shipping: { name: string; address: string; city: string; zip: string; country: string };
    paymentMethod?: string;
  };
  if (!shipping?.name || !shipping?.address || !shipping?.city || !shipping?.zip || !shipping?.country) {
    return NextResponse.json({ error: "Shipping information is incomplete." }, { status: 400 });
  }

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const cart = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!cart.data) return NextResponse.json({ error: "Cart not found." }, { status: 400 });
    const { data: items } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(*)")
      .eq("cart_id", cart.data.id);
    if (!items || items.length === 0) return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    const total = items.reduce((sum, it) => sum + Number(it.product.price) * it.quantity, 0);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "paid",
        total_amount: total,
        currency: "USD",
        shipping_name: shipping.name,
        shipping_address: shipping.address,
        shipping_city: shipping.city,
        shipping_zip: shipping.zip,
        shipping_country: shipping.country,
        payment_method: paymentMethod,
        payment_ref: `DEMO-${Date.now()}`,
      })
      .select("id")
      .single();
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 });
    const rows = items.map((it) => ({
      order_id: order!.id,
      product_id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
      image: it.product.images?.[0] ?? null,
    }));
    await supabase.from("order_items").insert(rows);
    await supabase.from("cart_items").delete().eq("cart_id", cart.data.id);
    return NextResponse.json({ orderId: order!.id, total });
  }

  const cart = await (await getDb()).cart.findUnique({
    where: { userId: user.id },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }
  const total = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const order = await (await getDb()).order.create({
    data: {
      userId: user.id,
      status: "paid",
      totalAmount: total,
      currency: "USD",
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingZip: shipping.zip,
      shippingCountry: shipping.country,
      paymentMethod,
      paymentRef: `DEMO-${Date.now()}`,
      items: {
        create: cart.items.map((it) => ({
          productId: it.productId,
          name: it.product.name,
          price: it.product.price,
          quantity: it.quantity,
          image: it.product.images ? JSON.parse(it.product.images)[0] ?? null : null,
        })),
      },
    },
  });
  await (await getDb()).cartItem.deleteMany({ where: { cartId: cart.id } });
  return NextResponse.json({ orderId: order.id, total });
}
