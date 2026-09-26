import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { upsertProductCost, isMissingAccountingSchema, accountingUnavailableResponse } from "@/lib/accounting";
import { isMissingSupplierColumns } from "@/lib/supabase/missing-column";
import { sanitizeRichText } from "@/lib/rich-text";
import type { Product } from "@/lib/types";

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAt: row.compareAt != null ? Number(row.compareAt) : null,
    currency: row.currency ?? "USD",
    sku: row.sku ?? null,
    stock: row.stock,
    rating: row.rating,
    reviewCount: row.reviewCount,
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || "[]"),
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || "[]"),
    featured: row.featured,
    isActive: row.isActive ?? row.is_active,
    // Digital delivery (Task 82): public payload carries ONLY the type —
    // digitalUrl/digitalInstructions stay server-side (gated download API).
    // Pre-migration rows have no product_type → physical (safe default).
    productType: (row.productType ?? row.product_type ?? "physical") === "digital" ? "digital" : "physical",
    // Supabase rows are snake_case (category_id); Prisma rows are camelCase.
    // Without the fallback every product's categoryId came back undefined and
    // the storefront's category pills filtered EVERYTHING out ("No products
    // found" on any pill except All) while the DB data itself was intact.
    categoryId: row.categoryId ?? row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
      : undefined,
  };
}

/**
 * Admin-only create response — same shape plus the confidential supplier
 * sourcing fields and the digital delivery fields (the public GET uses plain
 * rowToProduct, which omits them).
 */
function adminRowToProduct(row: any): Product {
  return {
    ...rowToProduct(row),
    digitalUrl: row.digital_url ?? row.digitalUrl ?? null,
    digitalInstructions: row.digital_instructions ?? row.digitalInstructions ?? null,
    supplierUrl: row.supplier_url ?? row.supplierUrl ?? null,
    supplierSku: row.supplier_sku ?? row.supplierSku ?? null,
  };
}

/**
 * Slug from the product name with collision handling (Task 65): dropshipping
 * imports commonly produce same-named items, and a duplicate slug 500s on the
 * unique constraint. Appends -2, -3… (then a random tail) until free.
 * `exists(slug)` checks the ACTIVE store (Supabase or Prisma).
 */
async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "product";
  let candidate = root;
  for (let i = 2; ; i++) {
    if (!(await exists(candidate))) return candidate;
    candidate = i <= 4 ? `${root}-${i}` : `${root}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const sort = searchParams.get("sort") ?? "newest";
  const limit = Number(searchParams.get("limit") ?? 100);

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    let query = supabase.from("products").select("*, category:categories(*)").eq("is_active", true);
    if (q) query = query.ilike("name", `%${q}%`);
    if (category && category !== "all") query = query.eq("category_id", category);
    if (featured === "true") query = query.eq("featured", true);
    if (sort === "price-asc") query = query.order("price", { ascending: true });
    else if (sort === "price-desc") query = query.order("price", { ascending: false });
    else if (sort === "rating") query = query.order("rating", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    const { data, error } = await query.limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: (data ?? []).map(rowToProduct) });
  }

  const products = await (await getDb()).product.findMany({
    where: {
      isActive: true,
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
      ...(category && category !== "all" ? { categoryId: category } : {}),
      ...(featured === "true" ? { featured: true } : {}),
    },
    include: { category: true },
    orderBy:
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
          ? { price: "desc" }
          : sort === "rating"
            ? { rating: "desc" }
            : { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ products: products.map(rowToProduct) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json();
  // Task 69: descriptions may carry formatting HTML from the rich-text editor.
  // Allowlist-sanitize BEFORE persistence so nothing unsafe is ever stored.
  if (typeof body.description === "string") body.description = sanitizeRichText(body.description);
  const { name, description, price, compareAt, currency, sku, stock, images, tags, categoryId, featured, cost, supplierUrl, supplierSku, productType, digitalUrl, digitalInstructions } = body;
  if (!name || !description || !price || !categoryId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  // Digital delivery (Task 82): a digital product must have something to
  // deliver — an uploaded private-storage file ("sb://bucket/path") or an
  // external https link.
  const type = productType === "digital" ? "digital" : "physical";
  if (type === "digital" && !digitalUrl) {
    return NextResponse.json(
      { error: "A digital product needs a download link — upload the file or paste its URL first." },
      { status: 400 },
    );
  }
  // Confidential supplier cost (Task 49). Validated server-side: >= 0, and
  // stored in the RLS-locked product_costs side-car — never on the product
  // row that public queries read.
  let costValue: number | null = null;
  if (cost !== undefined && cost !== null && cost !== "") {
    costValue = Number(cost);
    if (!Number.isFinite(costValue) || costValue < 0) {
      return NextResponse.json({ error: "Product cost must be zero or greater." }, { status: 400 });
    }
  }
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const slug = await uniqueSlug(String(name), async (s) => {
      const { data } = await supabase.from("products").select("id").eq("slug", s).limit(1);
      return !!data && data.length > 0;
    });
    const digitalColumns = {
      product_type: type,
      ...(type === "digital" ? { digital_url: digitalUrl, digital_instructions: digitalInstructions ?? null } : {}),
    };
    let { data, error } = await supabase
      .from("products")
      .insert({
        name,
        slug,
        description,
        price,
        compare_at: compareAt ?? null,
        currency: currency ?? "USD",
        sku: sku ?? null,
        stock: stock ?? 0,
        images: images ?? [],
        tags: tags ?? [],
        featured: featured ?? false,
        category_id: categoryId,
        // Dropshipping sourcing (Task 65) — supplier-only fields on the product
        // row; the public GET maps a fixed field list, so these never leak.
        supplier_url: supplierUrl ?? null,
        supplier_sku: supplierSku ?? null,
        ...digitalColumns,
      })
      .select("*, category:categories(*)")
      .single();
    if (error && isMissingSupplierColumns(error)) {
      // Supplier columns not migrated yet — save the product without them
      // rather than failing the whole create.
      ({ data, error } = await supabase
        .from("products")
        .insert({
          name,
          slug,
          description,
          price,
          compare_at: compareAt ?? null,
          currency: currency ?? "USD",
          sku: sku ?? null,
          stock: stock ?? 0,
          images: images ?? [],
          tags: tags ?? [],
          featured: featured ?? false,
          category_id: categoryId,
          ...digitalColumns,
        })
        .select("*, category:categories(*)")
        .single());
    }
    if (error && isMissingDigitalColumns(error)) {
      // Digital columns not migrated yet (2026-09-21-digital-products.sql) —
      // save the product as physical instead of failing the whole create.
      ({ data, error } = await supabase
        .from("products")
        .insert({
          name,
          slug,
          description,
          price,
          compare_at: compareAt ?? null,
          currency: currency ?? "USD",
          sku: sku ?? null,
          stock: stock ?? 0,
          images: images ?? [],
          tags: tags ?? [],
          featured: featured ?? false,
          category_id: categoryId,
          supplier_url: supplierUrl ?? null,
          supplier_sku: supplierSku ?? null,
        })
        .select("*, category:categories(*)")
        .single());
      if (!error) {
        return NextResponse.json({
          product: adminRowToProduct(data),
          digitalDropped: true,
          hint: "Digital columns are not migrated yet — the product saved WITHOUT its digital fields. Run src/lib/supabase/migrations/2026-09-21-digital-products.sql in the Supabase SQL editor, then edit this product.",
        });
      }
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (costValue != null) {
      try {
        await upsertProductCost(data.id, costValue, user);
      } catch (err: any) {
        if (isMissingAccountingSchema(err)) {
          return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    return NextResponse.json({ product: adminRowToProduct(data) });
  }
  const product = await (await getDb()).product.create({
    data: {
      name,
      slug: await uniqueSlug(String(name), async (s) => {
        return !!(await (await getDb()).product.findUnique({ where: { slug: s }, select: { id: true } }));
      }),
      description,
      price,
      compareAt,
      currency: currency ?? "USD",
      sku,
      stock: stock ?? 0,
      images: JSON.stringify(images ?? []),
      tags: JSON.stringify(tags ?? []),
      featured: featured ?? false,
      categoryId,
      supplierUrl: supplierUrl ?? null,
      supplierSku: supplierSku ?? null,
      productType: type,
      ...(type === "digital" ? { digitalUrl, digitalInstructions: digitalInstructions ?? null } : {}),
    },
    include: { category: true },
  });
  if (costValue != null) {
    try {
      await upsertProductCost(product.id, costValue, user);
    } catch (err: any) {
      if (isMissingAccountingSchema(err)) {
        return NextResponse.json(accountingUnavailableResponse(), { status: 503 });
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }
  return NextResponse.json({ product: adminRowToProduct(product) });
}
