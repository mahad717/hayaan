// Server-side glue between Sifalo Pay and the order store (Supabase OR local
// Prisma). Shared by /api/payments/sifalo, /api/payments/sifalo/verify and the
// /payment/sifalo return page so all three behave identically.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { verifySifaloPayment, type SifaloVerifyResult } from "@/lib/sifalo";
import type { NextRequest } from "next/server";

export interface ShippingInput {
  name: string;
  phone?: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

/**
 * Mirror the checkout page's displayed total: product subtotal + flat shipping
 * (free over $75) + 8% tax. Charging exactly what the customer saw avoids
 * "why was I charged less/more than the screen showed" disputes.
 */
export function computeCheckoutTotal(subtotal: number): number {
  const shipping = subtotal >= 75 ? 0 : 6.95;
  const tax = subtotal * 0.08;
  return Math.round((subtotal + shipping + tax) * 100) / 100;
}

export interface CreatedOrder {
  orderId: string;
  total: number;
}

/**
 * Create a PENDING order from the user's server-side cart and clear the cart
 * (same lifecycle as the demo /api/orders route — prevents duplicate orders
 * if the customer re-submits checkout while the payment tab is open).
 */
export async function createPendingSifaloOrder(
  userId: string,
  shipping: ShippingInput,
): Promise<CreatedOrder | { error: string; status: number }> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const cart = await supabase.from("carts").select("id").eq("user_id", userId).limit(1).single();
    if (!cart.data) return { error: "Cart not found.", status: 400 };
    const { data: items } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(*)")
      .eq("cart_id", cart.data.id);
    if (!items || items.length === 0) return { error: "Cart is empty.", status: 400 };

    const subtotal = items.reduce((sum, it) => sum + Number(it.product.price) * it.quantity, 0);
    const total = computeCheckoutTotal(subtotal);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        total_amount: total,
        currency: "USD",
        shipping_name: shipping.name,
        shipping_phone: shipping.phone?.trim() || null,
        shipping_address: shipping.address,
        shipping_city: shipping.city,
        shipping_zip: shipping.zip,
        shipping_country: shipping.country,
        payment_method: "sifalo",
        payment_status: "pending",
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      const msg = orderErr?.message ?? "insert failed";
      const hint = /payment_status/.test(msg)
        ? " — run src/lib/supabase/migrations/2026-09-06-sifalo-payments.sql in the Supabase SQL editor."
        : "";
      return { error: msg + hint, status: 400 };
    }
    await supabase.from("order_items").insert(
      items.map((it) => ({
        order_id: order.id,
        product_id: it.product.id,
        name: it.product.name,
        price: it.product.price,
        quantity: it.quantity,
        image: it.product.images?.[0] ?? null,
      })),
    );
    await supabase.from("cart_items").delete().eq("cart_id", cart.data.id);
    return { orderId: order.id, total };
  }

  // Local Prisma fallback
  const db = await getDb();
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) return { error: "Cart is empty.", status: 400 };

  const subtotal = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const total = computeCheckoutTotal(subtotal);
  const order = await db.order.create({
    data: {
      userId,
      status: "pending",
      totalAmount: total,
      currency: "USD",
      shippingName: shipping.name,
      shippingPhone: shipping.phone?.trim() || null,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingZip: shipping.zip,
      shippingCountry: shipping.country,
      paymentMethod: "sifalo",
      paymentStatus: "pending",
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
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  return { orderId: order.id, total };
}

export interface OwnedOrder {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentRef: string | null;
  totalAmount: number;
  currency: string;
}

/** Fetch an order and confirm it belongs to `userId`. */
export async function getOwnedOrder(userId: string, orderId: string): Promise<OwnedOrder | null> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data } = await supabase
      .from("orders")
      .select("id, status, payment_method, payment_status, payment_ref, total_amount, currency")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      status: data.status,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status ?? "pending",
      paymentRef: data.payment_ref ?? null,
      totalAmount: Number(data.total_amount),
      currency: data.currency,
    };
  }
  const db = await getDb();
  const o = await db.order.findUnique({ where: { id: orderId } });
  if (!o || o.userId !== userId) return null;
  return {
    id: o.id,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentRef: o.paymentRef,
    totalAmount: o.totalAmount,
    currency: o.currency,
  };
}

export interface AppliedVerification {
  applied: boolean;
  order: OwnedOrder | null;
  result: SifaloVerifyResult;
}

/**
 * Verify a Sifalo transaction (by sid or order id) and persist the outcome on
 * the order. "unknown" states leave the order untouched.
 */
export async function verifyAndApplyToOrder(
  userId: string,
  orderId: string,
  sid: string | null,
): Promise<AppliedVerification | { error: string; status: number }> {
  const order = await getOwnedOrder(userId, orderId);
  if (!order) return { error: "Order not found.", status: 404 };

  const result = await verifySifaloPayment(sid, orderId);
  let updated = order;

  if (result.state === "paid") {
    const ref = result.sid ?? order.paymentRef;
    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      await supabase
        .from("orders")
        .update({ status: "paid", payment_status: "paid", payment_ref: ref, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    } else {
      await (await getDb()).order.update({
        where: { id: orderId },
        data: { status: "paid", paymentStatus: "paid", paymentRef: ref },
      });
    }
    updated = { ...order, status: "paid", paymentStatus: "paid", paymentRef: ref };
  } else if (result.state === "failed") {
    const ref = result.sid ?? order.paymentRef;
    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      await supabase
        .from("orders")
        .update({ payment_status: "failed", payment_ref: ref, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    } else {
      await (await getDb()).order.update({
        where: { id: orderId },
        data: { paymentStatus: "failed", paymentRef: ref },
      });
    }
    updated = { ...order, paymentStatus: "failed", paymentRef: ref };
  } else if (result.state === "pending" && result.sid && !order.paymentRef) {
    if (isSupabaseServerEnabled) {
      const supabase = createServiceClient()!;
      await supabase
        .from("orders")
        .update({ payment_ref: result.sid, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    } else {
      await (await getDb()).order.update({ where: { id: orderId }, data: { paymentRef: result.sid } });
    }
    updated = { ...order, paymentRef: result.sid };
  }

  return { applied: result.state !== "unknown", order: updated, result };
}

/** Resolve the signed-in user for API routes (null → 401). */
export async function requireUser(req: NextRequest) {
  return getCurrentUser(req);
}
