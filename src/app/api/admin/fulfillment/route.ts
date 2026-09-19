// GET /api/admin/fulfillment — dropshipping worklist (Task 65).
// Returns paid/shipped orders with, per item, the supplier listing URL +
// supplier SKU + unit cost, so the owner can place the supplier order
// (AliExpress / Alibaba) and track what still needs shipping. Admin-gated;
// supplier data and costs never reach the storefront.
//
// The companion POST /api/admin/accounting/order-status moves orders
// paid -> shipped -> delivered; the UI pairs with it.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { requireAdminUser, getProductCostMap } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const STATUSES = ["paid", "shipped"];

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, total_amount, currency, created_at, " +
          "shipping_name, shipping_phone, shipping_address, shipping_city, shipping_zip, shipping_country, " +
          "items:order_items(id, name, quantity, price, product_id, " +
          "product:products(supplier_url, supplier_sku))",
      )
      .in("status", STATUSES)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    // Unit costs for margin display (best-effort — accounting may be unmigrated).
    const productIds = [...new Set(rows.flatMap((o: any) => (o.items ?? []).map((it: any) => it.product_id).filter(Boolean)))];
    let costMap = new Map<string, number>();
    if (productIds.length > 0) {
      try {
        costMap = await getProductCostMap(productIds);
      } catch {
        // costs unavailable — fulfillment still works, margin shows —
      }
    }
    return NextResponse.json({
      orders: rows.map((o: any) => ({
        id: o.id,
        status: o.status,
        paymentStatus: o.payment_status ?? null,
        createdAt: o.created_at,
        total: Number(o.total_amount),
        currency: o.currency ?? "USD",
        customer: {
          name: o.shipping_name ?? null,
          phone: o.shipping_phone ?? null,
          address: o.shipping_address ?? null,
          city: o.shipping_city ?? null,
          zip: o.shipping_zip ?? null,
          country: o.shipping_country ?? null,
        },
        items: (o.items ?? []).map((it: any) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: Number(it.price),
          supplierUrl: it.product?.supplier_url ?? null,
          supplierSku: it.product?.supplier_sku ?? null,
          cost: it.product_id != null && costMap.has(it.product_id) ? costMap.get(it.product_id) ?? null : null,
        })),
      })),
    });
  }

  // Local Prisma fallback
  const orders = await (await getDb()).order.findMany({
    where: { status: { in: STATUSES } },
    include: { items: { include: { product: { select: { supplierUrl: true, supplierSku: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((it) => it.productId).filter(Boolean)))];
  let costMap = new Map<string, number>();
  if (productIds.length > 0) {
    try {
      costMap = await getProductCostMap(productIds);
    } catch {
      // best-effort
    }
  }
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus ?? null,
      createdAt: o.createdAt,
      total: o.totalAmount,
      currency: o.currency ?? "USD",
      customer: {
        name: o.shippingName ?? null,
        phone: o.shippingPhone ?? null,
        address: o.shippingAddress ?? null,
        city: o.shippingCity ?? null,
        zip: o.shippingZip ?? null,
        country: o.shippingCountry ?? null,
      },
      items: o.items.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        supplierUrl: it.product?.supplierUrl ?? null,
        supplierSku: it.product?.supplierSku ?? null,
        cost: it.productId != null && costMap.has(it.productId) ? costMap.get(it.productId) ?? null : null,
      })),
    })),
  });
}
