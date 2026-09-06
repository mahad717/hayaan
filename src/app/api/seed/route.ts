import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { SEED_ADMIN, SEED_CUSTOMER, SEED_CATEGORIES, SEED_PRODUCTS } from "@/lib/seed-data";
import type { SupabaseClient } from "@supabase/supabase-js";

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

interface DemoAccountSpec {
  email: string;
  password: string;
  name: string;
  role: "admin" | "customer";
  profile?: Partial<{ phone: string; address: string; city: string; zip: string; country: string }>;
}

// Both demo accounts: the store admin and a regular shopper with a saved
// shipping address pre-filled (so the profile page / checkout demo well).
const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  { ...SEED_ADMIN, role: "admin" },
  { ...SEED_CUSTOMER, role: "customer", profile: {
    phone: SEED_CUSTOMER.phone,
    address: SEED_CUSTOMER.address,
    city: SEED_CUSTOMER.city,
    zip: SEED_CUSTOMER.zip,
    country: SEED_CUSTOMER.country,
  } },
];

/**
 * Ensure both demo accounts exist in Supabase Auth + public.users.
 * Idempotent: existing users get their password/metadata re-asserted, and the
 * customer's saved address is only written when the profile row has none yet
 * (so a user-cleared address is not resurrected by a re-seed).
 */
async function ensureDemoUsers(supabase: SupabaseClient): Promise<ReturnType<typeof jsonError> | null> {
  for (const acc of DEMO_ACCOUNTS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email === acc.email);
    const userId = found
      ? (
        await supabase.auth.admin.updateUserById(found.id, {
          password: acc.password,
          email_confirm: true,
          user_metadata: { name: acc.name, role: acc.role },
        })
      ).data?.user?.id
      : (
        await supabase.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true,
          user_metadata: { name: acc.name, role: acc.role },
        })
      ).data?.user?.id;

    if (!userId) return jsonError(`Failed to create the ${acc.role} user ${acc.email}.`, 500);

    // Only fill the demo address when the profile row doesn't have one yet.
    let currentAddress: string | null = null;
    if (acc.profile) {
      const { data: row } = await supabase
        .from("users")
        .select("address")
        .eq("id", userId)
        .maybeSingle();
      currentAddress = (row as { address?: string | null } | null)?.address ?? null;
    }

    const { error: profileErr } = await supabase
      .from("users")
      .upsert(
        {
          id: userId,
          email: acc.email,
          name: acc.name,
          role: acc.role,
          ...(acc.profile && !currentAddress ? acc.profile : {}),
        },
        { onConflict: "id" },
      );
    if (profileErr) {
      return jsonError(`${acc.email}: auth user ready, but syncing the public.users profile failed: ${profileErr.message}`, 500);
    }
  }
  return null;
}

// Production (Supabase) bootstrap: seeds categories + demo products on an
// EMPTY catalog, and always ensures the demo accounts (admin + customer)
// exist. Re-running on a live catalog is safe: it does not touch products,
// it only (re-)asserts the demo credentials.
async function seedSupabase() {
  const supabase = createServiceClient();
  if (!supabase) return jsonError("Supabase is enabled but the service-role key is missing.", 500);

  // Schema sanity check — doubles as a "did you run schema.sql?" probe.
  const { count, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    return jsonError(
      `Cannot read the products table (${countErr.message}). If the error mentions a missing relation, run src/lib/supabase/schema.sql in the Supabase SQL editor first.`,
      500,
    );
  }

  let catalogState: "seeded" | "already-populated" = "seeded";

  if ((count ?? 0) === 0) {
    const { error: catErr } = await supabase
      .from("categories")
      .upsert(SEED_CATEGORIES, { onConflict: "slug" });
    if (catErr) return jsonError(`Failed to seed categories: ${catErr.message}`, 500);

    const { data: cats, error: catsFetchErr } = await supabase.from("categories").select("id, slug");
    if (catsFetchErr || !cats) return jsonError(`Failed to load categories: ${catsFetchErr?.message}`, 500);
    const slugToId = new Map(cats.map((c: { id: string; slug: string }) => [c.slug, c.id]));

    const rows = SEED_PRODUCTS.map(({ category_slug, ...p }) => ({
      ...p,
      currency: "USD",
      is_active: true,
      category_id: slugToId.get(category_slug) ?? null,
    }));
    const { error: prodErr } = await supabase.from("products").upsert(rows, { onConflict: "slug" });
    if (prodErr) return jsonError(`Failed to seed products: ${prodErr.message}`, 500);
  } else {
    catalogState = "already-populated";
  }

  const usersErr = await ensureDemoUsers(supabase);
  if (usersErr) return usersErr;

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    catalog: catalogState,
    ...(catalogState === "seeded" ? { seeded: SEED_PRODUCTS.length, categories: SEED_CATEGORIES.length } : {}),
    admin: { email: SEED_ADMIN.email, password: SEED_ADMIN.password },
    customer: { email: SEED_CUSTOMER.email, password: SEED_CUSTOMER.password },
  });
}

interface SeedBody {
  email?: string;
  name?: string;
  password?: string;
}

// Seeds demo products + categories and BOTH demo accounts
// (admin@shop.demo / admin123 and customer@shop.demo / customer123).
// Safe to call on an already-populated catalog — product seeding is skipped
// and only the demo accounts are (re-)asserted.
export async function POST(req: Request) {
  let body: SeedBody = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK — we use defaults.
  }

  const email = body.email?.trim() || SEED_ADMIN.email;
  const name = body.name?.trim() || SEED_ADMIN.name;
  const password = body.password || SEED_ADMIN.password;

  // Production path (Cloudflare Workers + Supabase): the Prisma/SQLite engine
  // below cannot run on the Workers runtime, so bootstrap through Supabase.
  if (isSupabaseServerEnabled) {
    return seedSupabase();
  }

  // --- Categories ---
  const categories = [
    { name: "Apparel", slug: "apparel", description: "T-shirts, hoodies, and accessories." },
    { name: "Electronics", slug: "electronics", description: "Headphones, gadgets, and gear." },
    { name: "Home & Living", slug: "home-living", description: "Decor, kitchenware, and furniture." },
    { name: "Beauty", slug: "beauty", description: "Skincare, haircare, and fragrances." },
  ];
  const categoryRecords: { id: string; name: string; slug: string; description: string | null }[] = [];
  for (const c of categories) {
    const rec = await (await getDb()).category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryRecords.push(rec);
  }
  const [apparel, electronics, home, beauty] = categoryRecords;

  // --- Products ---
  const products = [
    {
      name: "Aurora Wireless Headphones",
      slug: "aurora-wireless-headphones",
      description: "Studio-grade wireless headphones with active noise cancellation, 40-hour battery life, and plush memory-foam earcups. Tuned for warm lows and crystal-clear highs.",
      price: 199.0,
      compareAt: 249.0,
      currency: "USD",
      sku: "AUR-WH-001",
      stock: 48,
      rating: 4.8,
      reviewCount: 312,
      images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop"],
      tags: ["audio", "wireless", "noise-cancelling"],
      featured: true,
      categoryId: electronics.id,
    },
    {
      name: "Nimbus Mechanical Keyboard",
      slug: "nimbus-mechanical-keyboard",
      description: "Hot-swappable 75% mechanical keyboard with PBT keycaps, gasket mount, and per-key RGB. Perfect for coders and writers who want that satisfying tactile feedback.",
      price: 129.0,
      compareAt: null,
      currency: "USD",
      sku: "NIM-KB-002",
      stock: 30,
      rating: 4.6,
      reviewCount: 87,
      images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop", "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725485555-21878fec-add1-4c8f-a1c1-ca2d376fa768.jpg"],
      tags: ["keyboard", "gaming", "productivity"],
      featured: true,
      categoryId: electronics.id,
    },
    {
      name: "Terra Organic Cotton Tee",
      slug: "terra-organic-cotton-tee",
      description: "Soft 100% organic cotton T-shirt cut for everyday wear. Pre-shrunk, ethically sourced, and dyed with low-impact pigments. Available in three core colorways.",
      price: 32.0,
      compareAt: 40.0,
      currency: "USD",
      sku: "TER-TS-003",
      stock: 220,
      rating: 4.5,
      reviewCount: 156,
      images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop"],
      tags: ["organic", "apparel", "unisex"],
      featured: false,
      categoryId: apparel.id,
    },
    {
      name: "Drift Linen Hoodie",
      slug: "drift-linen-hoodie",
      description: "Lightweight French terry hoodie with a relaxed fit, kangaroo pocket, and brushed metal drawcord tips. Designed for layering from spring to fall.",
      price: 78.0,
      compareAt: null,
      currency: "USD",
      sku: "DRI-HD-004",
      stock: 64,
      rating: 4.7,
      reviewCount: 92,
      images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop"],
      tags: ["hoodie", "apparel"],
      featured: true,
      categoryId: apparel.id,
    },
    {
      name: "Sable Ceramic Vase",
      slug: "sable-ceramic-vase",
      description: "Hand-thrown matte black ceramic vase. Each piece is unique — slight variations in glaze are intentional. Stands 22cm tall and pairs beautifully with dried botanicals.",
      price: 54.0,
      compareAt: 68.0,
      currency: "USD",
      sku: "SAB-VS-005",
      stock: 36,
      rating: 4.9,
      reviewCount: 41,
      images: ["https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725484435-41dd6a71-ae1e-46f7-a413-a46102279bae.jpg"],
      tags: ["decor", "ceramic", "handmade"],
      featured: false,
      categoryId: home.id,
    },
    {
      name: "Meadow Soy Candle",
      slug: "meadow-soy-candle",
      description: "12oz soy wax candle with notes of fig, cedar, and white tea. Burns cleanly for 60+ hours. Hand-poured in a reusable glass vessel.",
      price: 28.0,
      compareAt: null,
      currency: "USD",
      sku: "MEA-CD-006",
      stock: 140,
      rating: 4.4,
      reviewCount: 203,
      images: ["https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725483330-085f6bde-b327-4b93-8b76-ab85e8af903b.png"],
      tags: ["candle", "home", "fragrance"],
      featured: true,
      categoryId: home.id,
    },
    {
      name: "Helix Vitamin C Serum",
      slug: "helix-vitamin-c-serum",
      description: "Brightening 15% vitamin C serum with ferulic acid and vitamin E. Smooths texture and evens out skin tone over 4-6 weeks. Fragrance-free and dermatologist-tested.",
      price: 42.0,
      compareAt: 52.0,
      currency: "USD",
      sku: "HEL-SR-007",
      stock: 80,
      rating: 4.6,
      reviewCount: 178,
      images: ["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop"],
      tags: ["skincare", "beauty"],
      featured: false,
      categoryId: beauty.id,
    },
    {
      name: "Quill Leather Journal",
      slug: "quill-leather-journal",
      description: "A5 hardcover journal with 192 pages of 120gsm cream paper. Full-grain leather cover ages beautifully. Lay-flat binding for comfortable writing.",
      price: 38.0,
      compareAt: null,
      currency: "USD",
      sku: "QUI-JN-008",
      stock: 95,
      rating: 4.7,
      reviewCount: 64,
      images: ["https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop"],
      tags: ["stationery", "journal", "gift"],
      featured: false,
      categoryId: home.id,
    },
    {
      name: "Lumen Smart LED Strip",
      slug: "lumen-smart-led-strip",
      description: "16ft addressable RGB LED strip with app + voice control. Works with HomeKit, Alexa, and Google Home. Includes mounting clips and a Wi-Fi controller.",
      price: 46.0,
      compareAt: 59.0,
      currency: "USD",
      sku: "LUM-LS-009",
      stock: 120,
      rating: 4.3,
      reviewCount: 234,
      images: ["https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop"],
      tags: ["smart-home", "lighting"],
      featured: true,
      categoryId: electronics.id,
    },
    {
      name: "Bloom Botanical Skincare Set",
      slug: "bloom-botanical-skincare-set",
      description: "Three-piece skincare ritual: cleanser, toner, and moisturizer. Plant-derived actives for sensitive skin. Comes in a reusable cotton drawstring bag.",
      price: 89.0,
      compareAt: 110.0,
      currency: "USD",
      sku: "BLO-SK-010",
      stock: 42,
      rating: 4.8,
      reviewCount: 78,
      images: ["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop"],
      tags: ["skincare", "gift-set", "beauty"],
      featured: false,
      categoryId: beauty.id,
    },
    {
      name: "Foundry Heavyweight Sweatshirt",
      slug: "foundry-heavyweight-sweatshirt",
      description: "500gsm loopback cotton sweatshirt with a boxy fit and ribbed cuffs. Garment-dyed for a vintage hand-feel that softens with every wash.",
      price: 96.0,
      compareAt: null,
      currency: "USD",
      sku: "FOU-SW-011",
      stock: 58,
      rating: 4.7,
      reviewCount: 49,
      images: ["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop", "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725481334-42782eff-9837-4cf2-bb56-70377b7f2df7.jpg"],
      tags: ["apparel", "heavyweight"],
      featured: false,
      categoryId: apparel.id,
    },
    {
      name: "Carry Canvas Tote",
      slug: "carry-canvas-tote",
      description: "16oz waxed canvas tote with leather handles and an interior laptop sleeve. Built for daily commutes and weekend markets alike.",
      price: 64.0,
      compareAt: 80.0,
      currency: "USD",
      sku: "CAR-TT-012",
      stock: 73,
      rating: 4.6,
      reviewCount: 110,
      images: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop", "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725479980-edf1bed4-2099-4ee3-9c0c-14a4eeca2bfa.jpg"],
      tags: ["bag", "accessories", "apparel"],
      featured: true,
      categoryId: apparel.id,
    },
  ];

  for (const p of products) {
    const existing = await (await getDb()).product.findUnique({ where: { slug: p.slug } });
    if (existing) continue;
    await (await getDb()).product.create({
      data: {
        ...p,
        images: JSON.stringify(p.images),
        tags: JSON.stringify(p.tags),
      },
    });
  }

  // --- Demo users ---
  // bcrypt is dynamically imported — seed route only works under Node.js
  // (local dev). On Cloudflare, use the dedicated `scripts/seed-supabase.ts`
  // script which talks to Supabase directly via the service-role key.
  const { default: bcrypt } = await import("bcryptjs");
  const db = await getDb();

  // Admin (custom body credentials honored).
  const existingUser = await db.user.findUnique({ where: { email } });
  if (!existingUser) {
    const hashed = await bcrypt.hash(password, 10);
    await db.user.create({
      data: { email, name, password: hashed, role: "admin" },
    });
  } else if (existingUser.role !== "admin") {
    await db.user.update({ where: { email }, data: { role: "admin" } });
  }

  // Demo customer with a saved shipping address (only pre-filled when the
  // profile has no address yet, so a user-cleared address isn't resurrected).
  const existingCustomer = await db.user.findUnique({ where: { email: SEED_CUSTOMER.email } });
  if (!existingCustomer) {
    const hashed = await bcrypt.hash(SEED_CUSTOMER.password, 10);
    await db.user.create({
      data: {
        email: SEED_CUSTOMER.email,
        name: SEED_CUSTOMER.name,
        password: hashed,
        role: "customer",
        phone: SEED_CUSTOMER.phone,
        address: SEED_CUSTOMER.address,
        city: SEED_CUSTOMER.city,
        zip: SEED_CUSTOMER.zip,
        country: SEED_CUSTOMER.country,
      },
    });
  } else if (!existingCustomer.address) {
    await db.user.update({
      where: { email: SEED_CUSTOMER.email },
      data: {
        phone: SEED_CUSTOMER.phone,
        address: SEED_CUSTOMER.address,
        city: SEED_CUSTOMER.city,
        zip: SEED_CUSTOMER.zip,
        country: SEED_CUSTOMER.country,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    seeded: products.length,
    categories: categoryRecords.length,
    admin: { email, password },
    customer: { email: SEED_CUSTOMER.email, password: SEED_CUSTOMER.password },
  });
}
