// Seed the live Supabase database with the same demo data the local Prisma
// seed route uses. Run with: bun run /home/z/my-project/scripts/seed-supabase.ts
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (already configured).

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(process.cwd(), ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = "admin@shop.demo";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Store Admin";

// Demo customer — ships with a saved shipping address so the profile page
// and checkout prefill have data to show.
const CUSTOMER_EMAIL = "customer@shop.demo";
const CUSTOMER_PASSWORD = "customer123";
const CUSTOMER_NAME = "Demo Customer";
const CUSTOMER_PHONE = "+252 61 234 5678";
const CUSTOMER_ADDRESS = "Villa 12, Maka Al Mukarama Road";
const CUSTOMER_CITY = "Mogadishu";
const CUSTOMER_ZIP = "SH01";
const CUSTOMER_COUNTRY = "Somalia";

const CATEGORIES = [
  { name: "Apparel", slug: "apparel", description: "T-shirts, hoodies, and accessories." },
  { name: "Electronics", slug: "electronics", description: "Headphones, gadgets, and gear." },
  { name: "Home & Living", slug: "home-living", description: "Decor, kitchenware, and furniture." },
  { name: "Beauty", slug: "beauty", description: "Skincare, haircare, and fragrances." },
];

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at: number | null;
  sku: string;
  stock: number;
  rating: number;
  review_count: number;
  images: string[];
  tags: string[];
  featured: boolean;
  category_slug: string;
}

const PRODUCTS: SeedProduct[] = [
  {
    name: "Aurora Wireless Headphones — immersive sound, no wires",
    slug: "aurora-wireless-headphones",
    description:
      "Noise fades out; your music comes forward. Aurora pairs active noise cancellation with a 40-hour battery and plush memory-foam earcups, so long listening sessions stay comfortable. Tuned for warm lows and crystal-clear highs — with no wires to get in the way.",
    price: 199.0,
    compare_at: 249.0,
    sku: "AUR-WH-001",
    stock: 48,
    rating: 4.8,
    review_count: 312,
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop",
    ],
    tags: ["audio", "wireless", "noise-cancelling"],
    featured: true,
    category_slug: "electronics",
  },
  {
    name: "Nimbus Mechanical Keyboard — satisfying, responsive typing",
    slug: "nimbus-mechanical-keyboard",
    description:
      "Typing that feels as good as it sounds. Nimbus is a compact 75% mechanical keyboard with hot-swappable switches, durable PBT keycaps, and per-key RGB — built for coders and writers who live on their keyboards.",
    price: 129.0,
    compare_at: null,
    sku: "NIM-KB-002",
    stock: 30,
    rating: 4.6,
    review_count: 87,
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
      "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725485555-21878fec-add1-4c8f-a1c1-ca2d376fa768.jpg",
    ],
    tags: ["keyboard", "gaming", "productivity"],
    featured: true,
    category_slug: "electronics",
  },
  {
    name: "Terra Organic Cotton Tee — an easy everyday essential",
    slug: "terra-organic-cotton-tee",
    description:
      "The tee you'll reach for again and again. Cut from soft 100% organic cotton that's pre-shrunk and dyed with low-impact pigments, in three easy colorways that pair with everything.",
    price: 32.0,
    compare_at: 40.0,
    sku: "TER-TS-003",
    stock: 220,
    rating: 4.5,
    review_count: 156,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop",
    ],
    tags: ["organic", "apparel", "unisex"],
    featured: false,
    category_slug: "apparel",
  },
  {
    name: "Drift Linen Hoodie — easy layering for in-between days",
    slug: "drift-linen-hoodie",
    description:
      "Light enough for spring, cozy enough for fall. Drift is a relaxed French terry hoodie with a kangaroo pocket and brushed-metal drawcord tips — your grab-and-go layer for unpredictable days.",
    price: 78.0,
    compare_at: null,
    sku: "DRI-HD-004",
    stock: 64,
    rating: 4.7,
    review_count: 92,
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop",
    ],
    tags: ["hoodie", "apparel"],
    featured: true,
    category_slug: "apparel",
  },
  {
    name: "Sable Ceramic Vase — an effortless accent for any room",
    slug: "sable-ceramic-vase",
    description:
      "Warm up a shelf, table, or entryway in seconds. Each Sable vase is hand-thrown matte black ceramic — no two glazes alike — standing 22cm tall and pairing beautifully with fresh stems or dried botanicals.",
    price: 54.0,
    compare_at: 68.0,
    sku: "SAB-VS-005",
    stock: 36,
    rating: 4.9,
    review_count: 41,
    images: [
      "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725484435-41dd6a71-ae1e-46f7-a413-a46102279bae.jpg",
    ],
    tags: ["decor", "ceramic", "handmade"],
    featured: false,
    category_slug: "home-living",
  },
  {
    name: "Meadow Soy Candle — a softer atmosphere, for hours",
    slug: "meadow-soy-candle",
    description:
      "Fig, cedar, and white tea — a calm, welcoming scent that fills the room without overpowering it. Hand-poured soy wax burns cleanly for 60+ hours in a reusable glass vessel.",
    price: 28.0,
    compare_at: null,
    sku: "MEA-CD-006",
    stock: 140,
    rating: 4.4,
    review_count: 203,
    images: [
      "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725483330-085f6bde-b327-4b93-8b76-ab85e8af903b.png",
    ],
    tags: ["candle", "home", "fragrance"],
    featured: true,
    category_slug: "home-living",
  },
  {
    name: "Helix Vitamin C Serum — brighter, more even-looking skin",
    slug: "helix-vitamin-c-serum",
    description:
      "A brighter, more even look, one drop at a time. Helix blends 15% vitamin C with ferulic acid and vitamin E to smooth texture and even out skin tone over 4–6 weeks. Fragrance-free and dermatologist-tested.",
    price: 42.0,
    compare_at: 52.0,
    sku: "HEL-SR-007",
    stock: 80,
    rating: 4.6,
    review_count: 178,
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&auto=format&fit=crop",
    ],
    tags: ["skincare", "beauty"],
    featured: false,
    category_slug: "beauty",
  },
  {
    name: "Quill Leather Journal — a timeless home for your ideas",
    slug: "quill-leather-journal",
    description:
      "Ideas deserve a good place to live. Quill wraps 192 pages of smooth 120gsm cream paper in full-grain leather that ages beautifully, with lay-flat binding for comfortable writing anywhere.",
    price: 38.0,
    compare_at: null,
    sku: "QUI-JN-008",
    stock: 95,
    rating: 4.7,
    review_count: 64,
    images: [
      "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop",
    ],
    tags: ["stationery", "journal", "gift"],
    featured: false,
    category_slug: "home-living",
  },
  {
    name: "Lumen Smart LED Strip — set any mood in seconds",
    slug: "lumen-smart-led-strip",
    description:
      "Change the whole feel of a room from your phone or your voice. This 16ft addressable LED strip works with HomeKit, Alexa, and Google Home, and comes with mounting clips and a Wi-Fi controller for a quick setup.",
    price: 46.0,
    compare_at: 59.0,
    sku: "LUM-LS-009",
    stock: 120,
    rating: 4.3,
    review_count: 234,
    images: [
      "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop",
    ],
    tags: ["smart-home", "lighting"],
    featured: true,
    category_slug: "electronics",
  },
  {
    name: "Bloom Botanical Skincare Set — a simple three-step routine",
    slug: "bloom-botanical-skincare-set",
    description:
      "Cleanse, tone, moisturize — that's the whole routine. Bloom pairs plant-derived actives with gentle formulas made for sensitive skin, all in a reusable cotton drawstring bag that travels well.",
    price: 89.0,
    compare_at: 110.0,
    sku: "BLO-SK-010",
    stock: 42,
    rating: 4.8,
    review_count: 78,
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop",
    ],
    tags: ["skincare", "gift-set", "beauty"],
    featured: false,
    category_slug: "beauty",
  },
  {
    name: "Foundry Heavyweight Sweatshirt — substantial comfort for cool days",
    slug: "foundry-heavyweight-sweatshirt",
    description:
      "Substantial in the best way. Foundry is a 500gsm loopback cotton sweatshirt with a boxy fit and ribbed cuffs, garment-dyed for a vintage hand-feel that only gets softer with every wash.",
    price: 96.0,
    compare_at: null,
    sku: "FOU-SW-011",
    stock: 58,
    rating: 4.7,
    review_count: 49,
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop",
      "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725481334-42782eff-9837-4cf2-bb56-70377b7f2df7.jpg",
    ],
    tags: ["apparel", "heavyweight"],
    featured: false,
    category_slug: "apparel",
  },
  {
    name: "Carry Canvas Tote — built to haul your whole day",
    slug: "carry-canvas-tote",
    description:
      "Commute, gym, market run — Carry handles it all. Waxed 16oz canvas with leather handles and an interior laptop sleeve keeps everything organized and ages into its own character.",
    price: 64.0,
    compare_at: 80.0,
    sku: "CAR-TT-012",
    stock: 73,
    rating: 4.6,
    review_count: 110,
    images: [
      "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop",
      "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725479980-edf1bed4-2099-4ee3-9c0c-14a4eeca2bfa.jpg",
    ],
    tags: ["bag", "accessories", "apparel"],
    featured: true,
    category_slug: "apparel",
  },
];

async function seedCategories() {
  console.log("→ Upserting categories…");
  for (const c of CATEGORIES) {
    const { error } = await supabase.from("categories").upsert(c, { onConflict: "slug" });
    if (error) console.error(`  ✗ ${c.name}:`, error.message);
    else console.log(`  ✓ ${c.name}`);
  }
}

async function seedProducts() {
  console.log("→ Upserting products…");
  const { data: cats, error: catErr } = await supabase.from("categories").select("id, slug");
  if (catErr || !cats) {
    console.error("✗ Failed to fetch categories:", catErr?.message);
    return;
  }
  const slugToId = new Map(cats.map((c: any) => [c.slug, c.id]));

  let count = 0;
  for (const p of PRODUCTS) {
    const categoryId = slugToId.get(p.category_slug);
    if (!categoryId) {
      console.error(`  ✗ ${p.name}: category ${p.category_slug} not found`);
      continue;
    }
    const { error } = await supabase
      .from("products")
      .upsert(
        {
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          compare_at: p.compare_at,
          currency: "USD",
          sku: p.sku,
          stock: p.stock,
          rating: p.rating,
          review_count: p.review_count,
          images: p.images,
          tags: p.tags,
          featured: p.featured,
          is_active: true,
          category_id: categoryId,
        },
        { onConflict: "slug" },
      );
    if (error) console.error(`  ✗ ${p.name}:`, error.message);
    else {
      console.log(`  ✓ ${p.name}`);
      count++;
    }
  }
  console.log(`Seeded ${count} products.`);
}

async function ensureUser(spec: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "customer";
  profile?: Partial<{ phone: string; address: string; city: string; zip: string; country: string }>;
}) {
  console.log(`→ Upserting ${spec.role} user (${spec.email})…`);
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === spec.email);

  let userId: string;
  if (found) {
    const { data, error } = await supabase.auth.admin.updateUserById(found.id, {
      password: spec.password,
      user_metadata: { name: spec.name, role: spec.role },
      email_confirm: true,
    });
    if (error) {
      console.error(`  ✗ Failed to update ${spec.role}:`, error.message);
      return;
    }
    userId = data.user.id;
    console.log(`  ✓ Updated existing user ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { name: spec.name, role: spec.role },
    });
    if (error) {
      console.error(`  ✗ Failed to create ${spec.role}:`, error.message);
      return;
    }
    userId = data.user.id;
    console.log(`  ✓ Created new user ${userId}`);
  }

  // For the demo customer, only pre-fill the sample address when the profile
  // row doesn't have one yet (don't resurrect a user-cleared address).
  let profilePatch = {} as Record<string, string>;
  if (spec.profile) {
    const { data: row } = await supabase
      .from("users")
      .select("address")
      .eq("id", userId)
      .maybeSingle();
    if (!row?.address) profilePatch = spec.profile;
  }

  const { error: profileErr } = await supabase
    .from("users")
    .upsert(
      { id: userId, email: spec.email, name: spec.name, role: spec.role, ...profilePatch },
      { onConflict: "id" },
    );
  if (profileErr) console.error("  ✗ Failed to upsert public.users row:", profileErr.message);
  else console.log("  ✓ Synced public.users profile");
}

async function main() {
  console.log(`Seeding Supabase at ${url}…\n`);
  await seedCategories();
  await seedProducts();
  await ensureUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: ADMIN_NAME,
    role: "admin",
  });
  await ensureUser({
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD,
    name: CUSTOMER_NAME,
    role: "customer",
    profile: {
      phone: CUSTOMER_PHONE,
      address: CUSTOMER_ADDRESS,
      city: CUSTOMER_CITY,
      zip: CUSTOMER_ZIP,
      country: CUSTOMER_COUNTRY,
    },
  });
  console.log("\n✓ Done. Visit /api/products to verify.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
