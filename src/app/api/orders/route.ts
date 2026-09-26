import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { DIGITAL_SHIPPING_PLACEHOLDER } from "@/lib/sifalo-server";
import { hasPhysicalItems } from "@/lib/shipping";
import {
  getProductCostMap,
  snapshotOrderItemCosts,
  insertPayment,
  applySaleAccounting,
  toCents,
} from "@/lib/accounting";
import type { Order } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ orders: [] });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*, product:products(product_type, digital_instructions))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      orders: (data ?? []).map((o: any) => ({
        ...o,
        totalAmount: Number(o.total_amount),
        paymentStatus: o.payment_status ?? "pending",
        shippingPhone: o.shipping_phone ?? null,
        items: (o.items ?? []).map((it: any) => ({
          id: it.id,
          productId: it.product_id,
          name: it.name,
          price: Number(it.price),
          quantity: it.quantity,
          image: it.image,
          // Digital delivery (Task 82): type + buyer instructions only —
          // the download URL itself stays server-side (gated endpoint).
          isDigital: it.product?.product_type === "digital",
          digitalInstructions: it.product?.digital_instructions ?? null,
        })),
        createdAt: o.created_at,
      })),
    });
  }
  const orders = await (await getDb()).order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: { select: { productType: true, digitalInstructions: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const out: Order[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    status: o.status as Order["status"],
    totalAmount: o.totalAmount,
    currency: o.currency,
    shippingName: o.shippingName,
    shippingPhone: o.shippingPhone,
    shippingAddress: o.shippingAddress,
    shippingCity: o.shippingCity,
    shippingZip: o.shippingZip,
    shippingCountry: o.shippingCountry,
    paymentMethod: o.paymentMethod,
    paymentRef: o.paymentRef,
    paymentStatus: o.paymentStatus,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      image: it.image,
      isDigital: it.product.productType === "digital",
      digitalInstructions: it.product.digitalInstructions ?? null,
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
    shipping: { name: string; phone?: string; address: string; city: string; zip: string; country: string };
    paymentMethod?: string;
  };
  if (!shipping?.name?.trim()) {
    return NextResponse.json({ error: "Please add your full name so we can record the order." }, { status: 400 });
  }
  // Address requirements are cart-dependent (Task 82) and enforced inside the
  // branches below once the cart contents are known: digital-only carts need
  // no delivery address, physical carts do.

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const cart = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!cart.data) return NextResponse.json({ error: "We couldn't find your cart — please refresh and try again." }, { status: 400 });
    const { data: items } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(*)")
      .eq("cart_id", cart.data.id);
    if (!items || items.length === 0) return NextResponse.json({ error: "Your cart is empty — add an item before checking out." }, { status: 400 });
    // Digital-aware shipping fields (Task 82) — same rules as the Sifalo path.
    const shippingItems = items.map((it: any) => ({
      productType: it.product?.product_type ?? "physical",
      price: Number(it.product?.price ?? 0),
      quantity: it.quantity,
    }));
    const digitalOnly = !hasPhysicalItems(shippingItems);
    if (!digitalOnly && (!shipping.address?.trim() || !shipping.city?.trim() || !shipping.zip?.trim() || !shipping.country?.trim())) {
      return NextResponse.json({ error: "Please complete your shipping details so we know where to deliver." }, { status: 400 });
    }
    const finalShipping = digitalOnly
      ? {
          ...shipping,
          address: shipping.address?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.address,
          city: shipping.city?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.city,
          zip: shipping.zip?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.zip,
          country: shipping.country?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.country,
        }
      : shipping;
    const total = items.reduce((sum, it) => sum + Number(it.product.price) * it.quantity, 0);
    // Demo captures settle instantly — make the reference collision-proof so
    // the payments table's unique (provider, transaction_ref) index holds.
    const demoRef = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "paid",
        total_amount: total,
        currency: "USD",
        shipping_name: finalShipping.name,
        shipping_phone: finalShipping.phone?.trim() || null,
        shipping_address: finalShipping.address,
        shipping_city: finalShipping.city,
        shipping_zip: finalShipping.zip,
        shipping_country: finalShipping.country,
        payment_method: paymentMethod,
        payment_ref: demoRef,
      })
      .select("id")
      .single();
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 });
    const itemRows = items.map((it) => ({
      order_id: order!.id,
      product_id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
      image: it.product.images?.[0] ?? null,
    }));
    const inserted = await supabase
      .from("order_items")
      .insert(itemRows)
      .select("id, product_id, quantity");
    await supabase.from("cart_items").delete().eq("cart_id", cart.data.id);

    // --- Accounting (best-effort: a missing/failed accounting schema must
    // never block checkout; the admin UI surfaces the migration banner) ---
    try {
      const costMap = await getProductCostMap(items.map((it) => it.product.id));
      await snapshotOrderItemCosts(
        (inserted.data ?? []).map((it: any) => ({
          orderItemId: it.id,
          productId: it.product_id,
          quantity: it.quantity,
        })),
        costMap,
      );
      await insertPayment({
        orderId: order!.id,
        provider: "demo",
        method: paymentMethod,
        transactionRef: demoRef,
        amount: total,
        status: "paid",
      });
      await applySaleAccounting({
        orderId: order!.id,
        lines: items.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
          unitCost: costMap.get(it.product.id) ?? null,
          isDigital: (it.product?.product_type ?? "physical") === "digital",
        })),
        subtotalCents: toCents(total),
        discountCents: 0,
        shippingCents: 0,
        taxCents: 0,
      });
    } catch (acctErr) {
      console.error("[orders] accounting skipped:", acctErr);
    }
    return NextResponse.json({ orderId: order!.id, total });
  }

  const cart = await (await getDb()).cart.findUnique({
    where: { userId: user.id },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty — add an item before checking out." }, { status: 400 });
  }
  // Digital-aware shipping fields (Task 82) — same rules as the Sifalo path.
  const shippingItems = cart.items.map((it) => ({
    productType: it.product.productType,
    price: it.product.price,
    quantity: it.quantity,
  }));
  const digitalOnly = !hasPhysicalItems(shippingItems);
  if (!digitalOnly && (!shipping.address?.trim() || !shipping.city?.trim() || !shipping.zip?.trim() || !shipping.country?.trim())) {
    return NextResponse.json({ error: "Please complete your shipping details so we know where to deliver." }, { status: 400 });
  }
  const finalShipping = digitalOnly
    ? {
        ...shipping,
        address: shipping.address?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.address,
        city: shipping.city?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.city,
        zip: shipping.zip?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.zip,
        country: shipping.country?.trim() || DIGITAL_SHIPPING_PLACEHOLDER.country,
      }
    : shipping;
  const total = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const demoRef = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const order = await (await getDb()).order.create({
    data: {
      userId: user.id,
      status: "paid",
      totalAmount: total,
      currency: "USD",
      shippingName: finalShipping.name,
      shippingPhone: finalShipping.phone?.trim() || null,
      shippingAddress: finalShipping.address,
      shippingCity: finalShipping.city,
      shippingZip: finalShipping.zip,
      shippingCountry: finalShipping.country,
      paymentMethod,
      paymentRef: demoRef,
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
    include: { items: { select: { id: true, productId: true, quantity: true } } },
  });
  await (await getDb()).cartItem.deleteMany({ where: { cartId: cart.id } });

  // --- Accounting (best-effort; see the Supabase branch) ---
  try {
    const costMap = await getProductCostMap(cart.items.map((it) => it.productId));
    await snapshotOrderItemCosts(
      order.items.map((it) => ({ orderItemId: it.id, productId: it.productId, quantity: it.quantity })),
      costMap,
    );
    await insertPayment({
      orderId: order.id,
      provider: "demo",
      method: paymentMethod,
      transactionRef: demoRef,
      amount: total,
      status: "paid",
    });
    await applySaleAccounting({
      orderId: order.id,
      lines: order.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitCost: costMap.get(it.productId) ?? null,
        isDigital: it.product.productType === "digital",
      })),
      subtotalCents: toCents(total),
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
    });
  } catch (acctErr) {
    console.error("[orders] accounting skipped:", acctErr);
  }
  return NextResponse.json({ orderId: order.id, total });
}
