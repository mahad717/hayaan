// Task 91: create the 44 new sanguni mobiles on hayaan.co.
// 1. POST /api/seed (re-asserts demo admin) -> login admin@hayaan.demo
// 2. backup current admin products
// 3. for each payload item: upload clean image via /api/admin/upload,
//    POST /api/products (phones-wearables category)
// 4. verify: re-GET admin products, count created
// Run: node scripts/task91-create-products.mjs

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const PAYLOAD = "/home/z/my-project/scripts/task91-payload.json";
const BACKUP = "/home/z/my-project/scripts/task91-backup-pre-import.json";
const RESULT = "/home/z/my-project/scripts/task91-import-results.json";
const CATEGORY_ID = "90c6c2f0-40da-4a17-83b1-808bb8237e2e"; // phones-wearables

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---------- backup ----------
const before = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const beforeProducts = before.products ?? [];
writeFileSync(BACKUP, JSON.stringify({ fetchedAt: new Date().toISOString(), products: beforeProducts }, null, 1));
console.log(`[backup] ${beforeProducts.length} products -> task91-backup-pre-import.json`);
const existingNames = new Set(beforeProducts.map((p) => p.name.trim().toLowerCase()));
const existingSkus = new Set(beforeProducts.map((p) => p.sku).filter(Boolean));

// ---------- import ----------
const items = JSON.parse(readFileSync(PAYLOAD, "utf8"));
const created = [], failed = [], skipped = [];
let skuN = 100;
for (const [idx, it] of items.entries()) {
  skuN++;
  if (existingNames.has(it.name.trim().toLowerCase())) {
    skipped.push({ slug: it.slug, reason: "name already exists" });
    console.log(`  [${idx + 1}/${items.length}] SKIP ${it.slug} (name exists)`);
    continue;
  }
  let sku = `HAY-MOB-${skuN}`;
  while (existingSkus.has(sku)) { skuN++; sku = `HAY-MOB-${skuN}`; }
  try {
    // upload image
    const imgPath = `/home/z/my-project/scripts/task91-img-clean/${it.slug}.jpg`;
    const buf = readFileSync(imgPath);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "image/jpeg" }), `${it.slug}.jpg`);
    const upRes = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
    const upJson = await upRes.json().catch(() => ({}));
    if (!upRes.ok || !upJson.url) throw new Error(`upload ${upRes.status}: ${JSON.stringify(upJson).slice(0, 140)}`);

    // create product
    const body = {
      name: it.name,
      description: it.description,
      price: it.price,
      currency: "USD",
      sku,
      stock: 25,
      images: [upJson.url],
      tags: [],
      categoryId: CATEGORY_ID,
      featured: false,
      isActive: true,
      productType: "physical",
      supplierUrl: it.supplierUrl,
    };
    const res = await fetch(`${BASE}/api/products`, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      created.push({ slug: it.slug, id: json.product?.id, productSlug: json.product?.slug, sku, price: it.price });
      existingSkus.add(sku);
      console.log(`  [${idx + 1}/${items.length}] OK ${it.name} ($${it.price}) -> ${json.product?.slug}`);
    } else {
      failed.push({ slug: it.slug, status: res.status, error: json.error ?? (await res.text()).slice(0, 140) });
      console.log(`  [${idx + 1}/${items.length}] FAIL ${it.slug}: ${res.status}`);
    }
  } catch (e) {
    failed.push({ slug: it.slug, error: String(e).slice(0, 160) });
    console.log(`  [${idx + 1}/${items.length}] FAIL ${it.slug}: ${String(e).slice(0, 120)}`);
  }
  await sleep(300);
}

// ---------- verify ----------
const after = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const afterProducts = after.products ?? [];
const report = {
  ranAt: new Date().toISOString(),
  before: beforeProducts.length,
  after: afterProducts.length,
  createdCount: created.length,
  failedCount: failed.length,
  skippedCount: skipped.length,
  created, failed, skipped,
};
writeFileSync(RESULT, JSON.stringify(report, null, 1));
console.log(`\nDONE created=${created.length} failed=${failed.length} skipped=${skipped.length} (${beforeProducts.length} -> ${afterProducts.length})`);
if (failed.length) process.exit(2);
