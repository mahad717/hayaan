// Server-side glue between Sifalo Pay and the order store (Supabase OR local
// Prisma). Shared by /api/payments/sifalo, /api/payments/sifalo/verify and the
// /payment/sifalo return page so all three behave identically.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { verifySifaloPayment, type SifaloVerifyResult } from "@/lib/sifalo";
import { computeShipping, computeCartShipping, hasPhysicalItems, type CartShippingItem } from "@/lib/shipping";
import {
  getProductCostMap,
  snapshotOrderItemCosts,
  insertPayment,
  applySaleAccounting,
  auditChange,
} from "@/lib/accounting";
import type { NextRequest } from "next/server";

export interface ShippingInput {
  name: string;
  phone?: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

/** Order-row placeholders for digital-only carts — nothing physical ships, so
 *  the address columns carry a clear marker instead of blocking checkout. */
export const DIGITAL_SHIPPING_PLACEHOLDER = {
  address: "Digital delivery — no shipping",
  city: "Digital",
  zip: "0000",
  country: "Somalia",
} as const;

/**
 * Mirror the checkout page's displayed total: product subtotal + district-based
 * shipping (Mogadishu districts from the owner's fee sheet, free over $75,
 * flat fee elsewhere). No tax/VAT — the total is exactly subtotal + shipping.
 * Charging exactly what the customer saw avoids "why was I charged less/more
 * than the screen showed" disputes.
 */
export function computeCheckoutTotal(subtotal: number, city?: string | null): { total: number; shipping: number; tax: number } {
  const shipping = computeShipping(subtotal, city);
  // tax stays in the shape (order rows record tax_amount) but is always 0 —
  // the store no longer charges VAT.
  return { total: Math.round((subtotal + shipping) * 100) / 100, shipping, tax: 0 };
}

/** Cart-aware variant (Task 82): shipping is computed on the PHYSICAL
 *  subtotal only — digital-only carts are charged exactly the subtotal. */
export function computeCartCheckoutTotal(
  items: CartShippingItem[],
  city?: string | null,
): { total: number; shipping: number; tax: number } {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const shipping = computeCartShipping(items, city);
  return { total: Math.round((subtotal + shipping) * 100) / 100, shipping, tax: 0 };
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

    // Digital-aware shipping (Task 82): the charge is computed on the
    // PHYSICAL subtotal only; a digital-only cart pays no delivery at all
    // and never needs an address.
    const shippingItems: CartShippingItem[] = items.map((it: any) => ({
      productType: it.product?.product_type ?? "physical",
      price: Number(it.product?.price ?? 0),
      quantity: it.quantity,
    }));
    const digitalOnly = !hasPhysicalItems(shippingItems);
    if (!digitalOnly && (!shipping.address?.trim() || !shipping.city?.trim() || !shipping.zip?.trim() || !shipping.country?.trim())) {
      return {
        error: "Please complete your shipping details so we know where to deliver.",
        status: 400,
      };
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

    const { total, shipping: shippingFee, tax: taxAmt } = computeCartCheckoutTotal(shippingItems, finalShipping.city);
    // Receipt-level accounting columns (Task 49): what the customer was
    // actually asked to pay. If the accounting migration has not been applied
    // yet the columns don't exist — retry without them so checkout NEVER
    // breaks (the amounts are recomputable from the total).
    const baseInsert = {
      user_id: userId,
      status: "pending",
      total_amount: total,
      currency: "USD",
      shipping_name: finalShipping.name,
      shipping_phone: finalShipping.phone?.trim() || null,
      shipping_address: finalShipping.address,
      shipping_city: finalShipping.city,
      shipping_zip: finalShipping.zip,
      shipping_country: finalShipping.country,
      payment_method: "sifalo",
      payment_status: "pending",
    };
    let order: any = null;
    let orderErr: any = null;
    {
      const res = await supabase
        .from("orders")
        .insert({ ...baseInsert, shipping_cost: shippingFee, tax_amount: taxAmt })
        .select("id")
        .single();
      order = res.data;
      orderErr = res.error;
      if (orderErr && /shipping_cost|tax_amount|column/i.test(orderErr.message ?? "")) {
        const retry = await supabase.from("orders").insert(baseInsert).select("id").single();
        order = retry.data;
        orderErr = retry.error;
      }
    }
    if (orderErr || !order) {
      const msg = orderErr?.message ?? "insert failed";
      const hint = /payment_status/.test(msg)
        ? " — run src/lib/supabase/migrations/2026-09-06-sifalo-payments.sql in the Supabase SQL editor."
        : "";
      return { error: msg + hint, status: 400 };
    }
    const insertedItems = await supabase
      .from("order_items")
      .insert(
        items.map((it) => ({
          order_id: order.id,
          product_id: it.product.id,
          name: it.product.name,
          price: it.product.price,
          quantity: it.quantity,
          image: it.product.images?.[0] ?? null,
        })),
      )
      .select("id, product_id, quantity");
    await supabase.from("cart_items").delete().eq("cart_id", cart.data.id);
    // Cost-at-sale snapshot (best-effort — checkout must never block on it).
    try {
      const costMap = await getProductCostMap(items.map((it) => it.product.id));
      await snapshotOrderItemCosts(
        (insertedItems.data ?? []).map((it: any) => ({
          orderItemId: it.id,
          productId: it.product_id,
          quantity: it.quantity,
        })),
        costMap,
      );
    } catch (acctErr) {
      console.error("[sifalo] cost snapshot skipped:", acctErr);
    }
    return { orderId: order.id, total };
  }

  // Local Prisma fallback
  const db = await getDb();
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) return { error: "Cart is empty.", status: 400 };

  const shippingItems: CartShippingItem[] = cart.items.map((it) => ({
    productType: it.product.productType,
    price: it.product.price,
    quantity: it.quantity,
  }));
  const digitalOnly = !hasPhysicalItems(shippingItems);
  if (!digitalOnly && (!shipping.address?.trim() || !shipping.city?.trim() || !shipping.zip?.trim() || !shipping.country?.trim())) {
    return { error: "Please complete your shipping details so we know where to deliver.", status: 400 };
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

  const { total, shipping: shippingFee, tax: taxAmt } = computeCartCheckoutTotal(shippingItems, finalShipping.city);
  const order = await db.order.create({
    data: {
      userId,
      status: "pending",
      totalAmount: total,
      currency: "USD",
      shippingName: finalShipping.name,
      shippingPhone: finalShipping.phone?.trim() || null,
      shippingAddress: finalShipping.address,
      shippingCity: finalShipping.city,
      shippingZip: finalShipping.zip,
      shippingCountry: finalShipping.country,
      paymentMethod: "sifalo",
      paymentStatus: "pending",
      shippingCost: shippingFee,
      taxAmount: taxAmt,
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
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  // Cost-at-sale snapshot (best-effort).
  try {
    const costMap = await getProductCostMap(cart.items.map((it) => it.productId));
    await snapshotOrderItemCosts(
      order.items.map((it) => ({ orderItemId: it.id, productId: it.productId, quantity: it.quantity })),
      costMap,
    );
  } catch (acctErr) {
    console.error("[sifalo] cost snapshot skipped:", acctErr);
  }
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
 *
 * Task 49: every terminal state also lands in the accounting layer —
 *   paid   → payments row (deduped by transaction ref) + sale accounting
 *            (stock decrement, COGS ledger) exactly once
 *   failed → payments row with status failed (reconciliation shows Failed)
 *   any    → payment_status changes are audited
 * Accounting is best-effort: an unmigrated/failed accounting layer never
 * breaks the payment flow.
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
    // --- Accounting (best-effort) ---
    try {
      await auditChange({
        actor: null,
        entity: "order",
        entityId: orderId,
        field: "payment_status",
        oldValue: order.paymentStatus,
        newValue: "paid",
      });
      const paid = await insertPayment({
        orderId,
        provider: "sifalo",
        method: result.paymentType ?? "sifalo",
        transactionRef: ref ?? `sifalo-order-${orderId}`,
        amount: result.amount != null ? Number(result.amount) : order.totalAmount,
        status: "paid",
      });
      if (!paid.duplicate) {
        const { buildSaleLines } = await import("@/lib/accounting");
        const { lines, subtotalCents } = await buildSaleLines(orderId);
        await applySaleAccounting({
          orderId,
          lines,
          subtotalCents,
          discountCents: 0,
          // Sifalo orders record shipping/tax on the order row (receipt).
          shippingCents: 0,
          taxCents: 0,
        });
      }
    } catch (acctErr) {
      console.error("[sifalo] sale accounting skipped:", acctErr);
    }
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
    // --- Accounting (best-effort): record the failed attempt ---
    try {
      await auditChange({
        actor: null,
        entity: "order",
        entityId: orderId,
        field: "payment_status",
        oldValue: order.paymentStatus,
        newValue: "failed",
      });
      await insertPayment({
        orderId,
        provider: "sifalo",
        method: result.paymentType ?? "sifalo",
        transactionRef: ref ?? null,
        amount: result.amount != null ? Number(result.amount) : null,
        status: "failed",
      });
    } catch (acctErr) {
      console.error("[sifalo] failed-payment record skipped:", acctErr);
    }
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
