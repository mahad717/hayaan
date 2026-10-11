// Task 95: add Samsung Galaxy A18 (Black, 256GB) at $187 — owner request.
// Same admin-API pipeline as Task 91: seed -> login -> upload image -> POST /api/products.
// Guards: refuse if the name already exists or if the image file is missing.
// Run: node scripts/task95-add-galaxy-a18.mjs

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const IMG = "/home/z/my-project/scripts/task95-img/samsung-galaxy-a18.jpg";
const RESULT = "/home/z/my-project/scripts/task95-add-results.json";
const CATEGORY_ID = "90c6c2f0-40da-4a17-83b1-808bb8237e2e"; // phones-wearables
const SKU = "HAY-MOB-145";

const PRODUCT = {
  name: "Samsung Galaxy A18",
  description:
    "<p>Samsung Galaxy A18 (256GB, Black) — genuine stock available now at Hayaan Market.</p>" +
    "<ul>" +
    "<li><strong>Storage:</strong> 256GB, expandable with microSD</li>" +
    "<li><strong>RAM:</strong> 4GB</li>" +
    "<li><strong>Display:</strong> 6.7-inch Super AMOLED, 90Hz</li>" +
    "<li><strong>Chipset:</strong> Exynos 1610 (4G LTE)</li>" +
    "<li><strong>Main camera:</strong> 50 MP (f/1.8) + Ultra Wide + Macro triple camera, 4K video</li>" +
    "<li><strong>Battery:</strong> 5000MAH, 25W Super Fast Charging</li>" +
    "<li><strong>Build:</strong> IP64 dust and water resistance, stereo speakers, 7.7mm slim frame (196g)</li>" +
    "<li><strong>Software:</strong> Android 17 (One UI), up to 6 major OS upgrades</li>" +
    "</ul>" +
    "<p>Order today for fast delivery across Somalia — pay securely by card or Sifalo. Free delivery nationwide on orders over $75; Mogadishu districts from $1.50.</p>",
  price: 187,
  currency: "USD",
  stock: 25,
  productType: "physical",
  featured: false,
  supplierUrl:
    "https://www.samsung.com/ae/business/smartphones/galaxy-a/galaxy-a18-black-256gb-sm-a185gzknmea/buy/",
};

// ---------- seed + login ----------
const seedRes = await fetch(`${BASE}/api/seed`, {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}",
});
console.log("[seed]", seedRes.status, (await seedRes.text()).slice(0, 120));

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookies = loginRes.headers.getSetCookie?.() ?? [];
const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
console.log("[login] ok, role:", (await loginRes.json())?.user?.role);

const headers = { "content-type": "application/json", cookie };

// ---------- guards ----------
const before = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const beforeProducts = before.products ?? [];
writeFileSync("/home/z/my-project/scripts/task95-backup-pre-add.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), count: beforeProducts.length }, null, 1));
console.log(`[before] ${beforeProducts.length} products`);

const existingNames = new Set(beforeProducts.map((p) => p.name.trim().toLowerCase()));
const existingSkus = new Set(beforeProducts.map((p) => p.sku).filter(Boolean));
if (existingNames.has(PRODUCT.name.trim().toLowerCase())) {
  console.error("FATAL: product name already exists — nothing added.");
  process.exit(1);
}
if (existingSkus.has(SKU)) {
  console.error(`FATAL: SKU ${SKU} already exists — nothing added.`);
  process.exit(1);
}

// ---------- upload image ----------
const buf = readFileSync(IMG);
const form = new FormData();
form.append("file", new Blob([buf], { type: "image/jpeg" }), "samsung-galaxy-a18.jpg");
const upRes = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
const upJson = await upRes.json().catch(() => ({}));
if (!upRes.ok || !upJson.url) {
  console.error(`FATAL: upload ${upRes.status}:`, JSON.stringify(upJson).slice(0, 200));
  process.exit(1);
}
console.log("[upload] ok:", upJson.url);

// ---------- create ----------
const body = {
  ...PRODUCT,
  sku: SKU,
  images: [upJson.url],
  tags: [],
  categoryId: CATEGORY_ID,
  isActive: true,
};
const res = await fetch(`${BASE}/api/products`, { method: "POST", headers, body: JSON.stringify(body) });
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`FATAL: create ${res.status}:`, JSON.stringify(json).slice(0, 300));
  process.exit(1);
}
const created = { id: json.product?.id, slug: json.product?.slug, sku: SKU, price: PRODUCT.price, image: upJson.url };
console.log("[created]", JSON.stringify(created));

// ---------- verify ----------
const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
const pubItems = pub.products ?? pub.items ?? pub;
const mine = pubItems.find((p) => p.id === created.id);
const afterCount = pubItems.length;
const report = {
  ranAt: new Date().toISOString(),
  before: beforeProducts.length,
  after: afterCount,
  created,
  publicVerification: mine
    ? { name: mine.name, price: mine.price, slug: mine.slug, sku: mine.sku, images: mine.images }
    : null,
};
writeFileSync(RESULT, JSON.stringify(report, null, 1));
console.log(`[verify] public API: ${mine ? `FOUND ${mine.name} $${mine.price}` : "NOT FOUND"} (catalog ${beforeProducts.length} -> ${afterCount})`);
if (!mine) process.exit(2);
