// Task 137: import Sanguni's new product (Samsung Galaxy Z Fold8 5G, $1499)
// + apply 3 supplier price increases with expected-old-price guards.
// Precondition: PDP-verified price 1499.00 (JSON-LD), image downloaded + verified.
// Run: node scripts/t137-import.mjs        (dry run)
//      APPLY=1 node scripts/t137-import.mjs
import { readFileSync, writeFileSync, statSync } from "node:fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";
const OUT = "/home/z/my-project/scripts/t137-import-results.json";
const PHONES_CAT = "90c6c2f0-40da-4a17-83b1-808bb8237e2e"; // phones-wearables

const NEW_PRODUCT = {
  name: "Samsung Galaxy Z Fold8 5G",
  price: 1499,
  supplierUrl: "https://sanguni.so/product/samsung-galaxy-z-fold8-5g/",
  imageUrl: "https://hayaan.co/images/products/samsung-galaxy-z-fold8-5g.jpg", // repo-hosted (PS5 precedent) — must be live before create
  description:
    "<p>Samsung Galaxy Z Fold8 5G — genuine stock available now at Hayaan Market.</p>" +
    "<ul>" +
    "<li><strong>Storage:</strong> 256GB</li>" +
    "<li><strong>RAM:</strong> 12GB</li>" +
    "<li><strong>Display:</strong> 7.6-inch foldable</li>" +
    "<li><strong>Main camera:</strong> 50 MP, f/1.8, 23mm (wide) + 50 MP, f/1.9, 13mm, 120&#730; (ultrawide)</li>" +
    "<li><strong>Selfie camera:</strong> 10 MP, f/2.2, 18mm (ultrawide)</li>" +
    "<li><strong>Video:</strong> 4K@30/60fps, 1080p@30/60fps, gyro-EIS</li>" +
    "</ul>" +
    "<p>Order today for fast delivery across Somalia — pay securely by card or Sifalo.</p>",
};

const PRICE_UPDATES = [
  { slug: "samsung-galaxy-a56-5g", name: "Samsung Galaxy A56 5G", old: 370, price: 375 },
  { slug: "samsung-galaxy-a37-5g", name: "Samsung Galaxy A37 5G", old: 320, price: 330 },
  { slug: "samsung-galaxy-a17", name: "Samsung Galaxy A17", old: 165, price: 170 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- seed + login ----------
const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const headers = { "content-type": "application/json", cookie };
console.log("[login] ok, APPLY =", APPLY);

// ---------- current catalog for guards/dedup ----------
const adminBefore = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const before = adminBefore.products ?? [];
const existingNames = new Set(before.map((p) => p.name.trim().toLowerCase()));
const existingSkus = new Set(before.map((p) => p.sku).filter(Boolean));
console.log("[catalog]", before.length, "products");

const results = { ranAt: new Date().toISOString(), apply: APPLY, create: null, priceUpdates: [], verify: {} };

// ---------- create ----------
if (existingNames.has(NEW_PRODUCT.name.toLowerCase())) {
  console.log("[create] SKIP — name already exists");
  results.create = { status: "skipped-exists" };
} else {
  let sku = "HAY-MOB-200";
  while (existingSkus.has(sku)) sku = `HAY-MOB-${Math.floor(200 + Math.random() * 800)}`;
  if (!APPLY) {
    console.log(`[dry] would create ${NEW_PRODUCT.name} @ $${NEW_PRODUCT.price} sku ${sku}`);
    results.create = { status: "dry-run", sku };
  } else {
    // image is repo-hosted: verify it's live before referencing it
    const head = await fetch(NEW_PRODUCT.imageUrl, { method: "HEAD" });
    if (!head.ok) { console.error(`FATAL: image not live yet (${head.status}) — deploy first`); process.exit(1); }
    console.log("[image]", head.status, NEW_PRODUCT.imageUrl);

    const body = {
      name: NEW_PRODUCT.name,
      description: NEW_PRODUCT.description,
      price: NEW_PRODUCT.price,
      currency: "USD",
      sku,
      stock: 25,
      images: [NEW_PRODUCT.imageUrl],
      tags: [],
      categoryId: PHONES_CAT,
      featured: false,
      isActive: true,
      productType: "physical",
      supplierUrl: NEW_PRODUCT.supplierUrl,
    };
    const res = await fetch(`${BASE}/api/products`, { method: "POST", headers, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`[create] OK ${NEW_PRODUCT.name} $${NEW_PRODUCT.price} -> ${j.product?.slug} (id ${j.product?.id})`);
      results.create = { status: "created", id: j.product?.id, slug: j.product?.slug, sku, price: NEW_PRODUCT.price, image: NEW_PRODUCT.imageUrl };
    } else {
      console.error(`[create] FAIL ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      results.create = { status: "failed", http: res.status, error: j.error ?? "" };
      writeFileSync(OUT, JSON.stringify(results, null, 1));
      process.exit(2);
    }
    await sleep(500);
  }
}

// ---------- price updates (guarded; admin list covers inactive rows too) ----------
const cat = await (await fetch(`${BASE}/api/products?limit=500`, { headers })).json();
const items = cat.products ?? [];
for (const u of PRICE_UPDATES) {
  const cur = items.find((x) => x.slug === u.slug) ?? before.find((x) => x.slug === u.slug);
  if (!cur) { console.error(`[MISS] ${u.slug}`); results.priceUpdates.push({ ...u, status: "missing" }); continue; }
  const curPrice = Number(cur.price);
  if (Math.abs(curPrice - u.old) > 0.005) {
    console.error(`[SKIP] ${u.name}: current $${curPrice} != expected $${u.old} — refusing`);
    results.priceUpdates.push({ ...u, status: "skipped", currentPrice: curPrice });
    continue;
  }
  if (!APPLY) {
    console.log(`[dry] ${u.name}: $${curPrice} -> $${u.price}`);
    results.priceUpdates.push({ ...u, id: cur.id, status: "dry-run" });
    continue;
  }
  const r = await fetch(`${BASE}/api/products/${cur.id}`, { method: "PUT", headers, body: JSON.stringify({ price: u.price }) });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && Number(j.product?.price) === u.price;
  console.log(`[put] ${u.name}: $${u.old} -> $${u.price} ${ok ? "OK" : `FAIL ${r.status}`}`);
  results.priceUpdates.push({ ...u, id: cur.id, status: ok ? "updated" : "failed", http: r.status });
  await sleep(400);
}

// ---------- verify (admin re-GET covers inactive rows; public API for active) ----------
if (APPLY) {
  await sleep(1500);
  const adminAfter = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
  const afterItems = adminAfter.products ?? [];
  const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
  const pubItems = pub.products ?? [];
  const np = pubItems.find((x) => x.slug === (results.create?.slug ?? "") || x.name === NEW_PRODUCT.name);
  results.verify.newProduct = np ? { slug: np.slug, price: Number(np.price), hasImage: (np.images ?? []).length > 0, match: Number(np.price) === NEW_PRODUCT.price } : null;
  results.verify.priceChecks = [];
  for (const u of PRICE_UPDATES) {
    const p = afterItems.find((x) => x.slug === u.slug);
    const got = p ? Number(p.price) : null;
    const pubP = pubItems.find((x) => x.slug === u.slug);
    results.verify.priceChecks.push({ slug: u.slug, expected: u.price, admin: got, publicActive: pubP ? Number(pubP.price) : null, match: got === u.price });
  }
  results.verify.count = afterItems.length;
  console.log("\n[verify] admin catalog count:", afterItems.length);
  console.log("[verify] new product:", JSON.stringify(results.verify.newProduct));
  for (const v of results.verify.priceChecks) console.log(`[verify] ${v.slug}: admin $${v.admin} public $${v.publicActive} (expected $${v.expected}) ${v.match ? "MATCH" : "MISMATCH"}`);
}

writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n[done] APPLY=${APPLY} -> t137-import-results.json`);
const bad = results.create?.status === "failed" || results.priceUpdates.some((r) => r.status === "failed" || r.status === "skipped" || r.status === "missing");
if (APPLY && bad) process.exit(2);
