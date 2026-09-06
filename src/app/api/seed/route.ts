import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { SEED_ADMIN, SEED_CATEGORIES, SEED_PRODUCTS } from "@/lib/seed-data";

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Production (Supabase) bootstrap: seeds categories + demo products and
// creates the admin account via the service-role client. Only runs while the
// catalog is empty, so it can't be abused to overwrite live data later.
async function seedSupabase(email: string, name: string, password: string) {
  const supabase = createServiceClient();
  if (!supabase) return jsonError("Supabase is enabled but the service-role key is missing.", 500);

  // Bootstrap-only guard — also doubles as a "did you run schema.sql?" check.
  const { count, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    return jsonError(
      `Cannot read the products table (${countErr.message}). If the error mentions a missing relation, run src/lib/supabase/schema.sql in the Supabase SQL editor first.`,
      500,
    );
  }
  if ((count ?? 0) > 0) {
    return jsonError(
      "The catalog already has products — this bootstrap seeder only runs on an empty database. Manage products from the admin dashboard instead.",
      409,
    );
  }

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

  // Admin account: user_metadata.role is what the /admin guard reads from
  // the Supabase JWT.
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  const userId = found
    ? (
      await supabase.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
        user_metadata: { name, role: "admin" },
      })
    ).data?.user?.id
    : (
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "admin" },
      })
    ).data?.user?.id;

  if (!userId) return jsonError(`Failed to create the admin user ${email}.`, 500);

  const { error: profileErr } = await supabase
    .from("users")
    .upsert({ id: userId, email, name, role: "admin" }, { onConflict: "id" });
  if (profileErr) return jsonError(`Admin auth user created, but syncing the public.users profile failed: ${profileErr.message}`, 500);

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    seeded: rows.length,
    categories: SEED_CATEGORIES.length,
    admin: { email, password },
  });
}

interface SeedBody {
  email?: string;
  name?: string;
  password?: string;
}

// Seeds a handful of demo products + categories and an admin user.
// POST body: { email, name, password } — defaults to admin@shop.demo / admin123.
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
    return seedSupabase(email, name, password);
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
      images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1595044426077-d36d4d0c9e3c?w=800&auto=format&fit=crop"],
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
      images: ["https://images.unsplash.com/photo-1612196808214-b8d6cd6b1fde?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1606744824163-985d376605aa?w=800&auto=format&fit=crop"],
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
      images: ["https://images.unsplash.com/photo-1602874801006-094b8a3b3c6f?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop"],
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
      images: ["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1593726852644-9c4ae90db05a?w=800&auto=format&fit=crop"],
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
      images: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop", "https://images.unsplash.com/photo-1564422170194-896b89b98b4a?w=800&auto=format&fit=crop"],
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

  // --- Admin user ---
  // bcrypt is dynamically imported — seed route only works under Node.js
  // (local dev). On Cloudflare, use the dedicated `scripts/seed-supabase.ts`
  // script which talks to Supabase directly via the service-role key.
  const { default: bcrypt } = await import("bcryptjs");
  const db = await getDb();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (!existingUser) {
    const hashed = await bcrypt.hash(password, 10);
    await db.user.create({
      data: { email, name, password: hashed, role: "admin" },
    });
  } else if (existingUser.role !== "admin") {
    await (await getDb()).user.update({ where: { email }, data: { role: "admin" } });
  }

  return NextResponse.json({
    ok: true,
    seeded: products.length,
    categories: categoryRecords.length,
    admin: { email, password },
  });
}
