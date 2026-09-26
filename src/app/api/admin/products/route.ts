// Admin-only product listing WITH confidential supplier cost (Task 49).
//
// This endpoint is the ONLY place the storefront's product data is joined
// with product_costs. It requires a verified admin session (server-side),
// and in Supabase mode the cost table is additionally RLS-locked to the
// service role — customers can neither reach this route nor the table.

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { requireAdminUser, isMissingAccountingSchema, accountingUnavailableResponse } from "@/lib/accounting";

/** Supplier sourcing (Task 65) + digital delivery (Task 82) fields — admin-only, same confidentiality as cost. */
function supplierFields(row: {
  supplier_url?: string | null; supplier_sku?: string | null; supplierUrl?: string | null; supplierSku?: string | null;
  digital_url?: string | null; digital_instructions?: string | null; digitalUrl?: string | null; digitalInstructions?: string | null;
}) {
  return {
    supplierUrl: row.supplier_url ?? row.supplierUrl ?? null,
    supplierSku: row.supplier_sku ?? row.supplierSku ?? null,
    digitalUrl: row.digital_url ?? row.digitalUrl ?? null,
    digitalInstructions: row.digital_instructions ?? row.digitalInstructions ?? null,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const [prodRes, costRes] = await Promise.all([
      supabase.from("products").select("*, category:categories(*)").order("created_at", { ascending: false }),
      supabase.from("product_costs").select("product_id, unit_cost"),
    ]);
    const prodErr = prodRes.error;
    if (prodErr) {
      if (isMissingAccountingSchema(prodErr)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }
    const costs = new Map<string, number>();
    if (costRes.error) {
      if (isMissingAccountingSchema(costRes.error)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: costRes.error.message }, { status: 500 });
    }
    for (const row of costRes.data ?? []) costs.set(row.product_id, Number(row.unit_cost));
    return NextResponse.json({
      products: (prodRes.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: Number(row.price),
        compareAt: row.compare_at != null ? Number(row.compare_at) : null,
        currency: row.currency ?? "USD",
        sku: row.sku ?? null,
        stock: row.stock,
        rating: Number(row.rating ?? 0),
        reviewCount: row.review_count ?? 0,
        images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || "[]"),
        tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || "[]"),
        featured: row.featured,
        isActive: row.is_active,
        productType: (row.product_type ?? "physical") === "digital" ? "digital" : "physical",
        categoryId: row.category_id,
        category: row.category
          ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
          : undefined,
        // Confidential — admin only, never present on public payloads.
        cost: costs.has(row.id) ? costs.get(row.id) ?? null : null,
        ...supplierFields(row),
      })),
    });
  }

  const [products, costs] = await Promise.all([
    (await getDb()).product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
    (await getDb()).productCost.findMany({ select: { productId: true, unitCost: true } }),
  ]);
  const costMap = new Map(costs.map((c) => [c.productId, c.unitCost]));
  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      compareAt: p.compareAt,
      currency: p.currency,
      sku: p.sku ?? null,
      stock: p.stock,
      rating: p.rating,
      reviewCount: p.reviewCount,
      images: p.images ? JSON.parse(p.images) : [],
      tags: p.tags ? JSON.parse(p.tags) : [],
      featured: p.featured,
      isActive: p.isActive,
      productType: p.productType === "digital" ? "digital" : "physical",
      categoryId: p.categoryId,
      category: p.category
        ? { id: p.category.id, name: p.category.name, slug: p.category.slug, description: p.category.description ?? null }
        : undefined,
      cost: costMap.has(p.id) ? costMap.get(p.id) ?? null : null,
      ...supplierFields(p),
    })),
  });
}
