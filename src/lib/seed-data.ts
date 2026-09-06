// Shared demo-catalog seed data, shaped for the Supabase `categories` and
// `products` tables (snake_case columns, category referenced by slug).
//
// Used by:
//   - POST /api/seed  (the storefront's "Seed now" bootstrap button, in
//     Supabase/production mode)
//   - scripts/seed-supabase.ts keeps its own standalone copy so it can run
//     outside Next.js with plain `bun`.
//
// Keep the demo credentials in sync with scripts/seed-supabase.ts:
//   admin@shop.demo / admin123  (role: admin)

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
}

export interface SeedProduct {
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

export const SEED_ADMIN = {
  email: "admin@shop.demo",
  password: "admin123",
  name: "Store Admin",
} as const;

// Regular shopper demo account — lets you try the customer side (profile,
// saved shipping address, checkout, orders) without touching the admin.
export const SEED_CUSTOMER = {
  email: "customer@shop.demo",
  password: "customer123",
  name: "Demo Customer",
  phone: "+252 61 234 5678",
  address: "Villa 12, Maka Al Mukarama Road",
  city: "Mogadishu",
  zip: "SH01",
  country: "Somalia",
} as const;

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: "Apparel", slug: "apparel", description: "T-shirts, hoodies, and accessories." },
  { name: "Electronics", slug: "electronics", description: "Headphones, gadgets, and gear." },
  { name: "Home & Living", slug: "home-living", description: "Decor, kitchenware, and furniture." },
  { name: "Beauty", slug: "beauty", description: "Skincare, haircare, and fragrances." },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "Aurora Wireless Headphones",
    slug: "aurora-wireless-headphones",
    description:
      "Studio-grade wireless headphones with active noise cancellation, 40-hour battery life, and plush memory-foam earcups. Tuned for warm lows and crystal-clear highs.",
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
    name: "Nimbus Mechanical Keyboard",
    slug: "nimbus-mechanical-keyboard",
    description:
      "Hot-swappable 75% mechanical keyboard with PBT keycaps, gasket mount, and per-key RGB. Perfect for coders and writers who want that satisfying tactile feedback.",
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
    name: "Terra Organic Cotton Tee",
    slug: "terra-organic-cotton-tee",
    description:
      "Soft 100% organic cotton T-shirt cut for everyday wear. Pre-shrunk, ethically sourced, and dyed with low-impact pigments. Available in three core colorways.",
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
    name: "Drift Linen Hoodie",
    slug: "drift-linen-hoodie",
    description:
      "Lightweight French terry hoodie with a relaxed fit, kangaroo pocket, and brushed metal drawcord tips. Designed for layering from spring to fall.",
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
    name: "Sable Ceramic Vase",
    slug: "sable-ceramic-vase",
    description:
      "Hand-thrown matte black ceramic vase. Each piece is unique — slight variations in glaze are intentional. Stands 22cm tall and pairs beautifully with dried botanicals.",
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
    name: "Meadow Soy Candle",
    slug: "meadow-soy-candle",
    description:
      "12oz soy wax candle with notes of fig, cedar, and white tea. Burns cleanly for 60+ hours. Hand-poured in a reusable glass vessel.",
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
    name: "Helix Vitamin C Serum",
    slug: "helix-vitamin-c-serum",
    description:
      "Brightening 15% vitamin C serum with ferulic acid and vitamin E. Smooths texture and evens out skin tone over 4-6 weeks. Fragrance-free and dermatologist-tested.",
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
    name: "Quill Leather Journal",
    slug: "quill-leather-journal",
    description:
      "A5 hardcover journal with 192 pages of 120gsm cream paper. Full-grain leather cover ages beautifully. Lay-flat binding for comfortable writing.",
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
    name: "Lumen Smart LED Strip",
    slug: "lumen-smart-led-strip",
    description:
      "16ft addressable RGB LED strip with app + voice control. Works with HomeKit, Alexa, and Google Home. Includes mounting clips and a Wi-Fi controller.",
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
    name: "Bloom Botanical Skincare Set",
    slug: "bloom-botanical-skincare-set",
    description:
      "Three-piece skincare ritual: cleanser, toner, and moisturizer. Plant-derived actives for sensitive skin. Comes in a reusable cotton drawstring bag.",
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
    name: "Foundry Heavyweight Sweatshirt",
    slug: "foundry-heavyweight-sweatshirt",
    description:
      "500gsm loopback cotton sweatshirt with a boxy fit and ribbed cuffs. Garment-dyed for a vintage hand-feel that softens with every wash.",
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
    name: "Carry Canvas Tote",
    slug: "carry-canvas-tote",
    description:
      "16oz waxed canvas tote with leather handles and an interior laptop sleeve. Built for daily commutes and weekend markets alike.",
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
