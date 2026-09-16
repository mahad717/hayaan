// Task 53: apply real product images to the live Hayaan catalog.
// 1. login -> shop_session cookie (proven import_catalog.mjs pattern)
// 2. GET /api/admin/products -> name->id map + detect the placeholder URL
//    (the single most common images[0] across products)
// 3. for each manifest entry: upload scripts/product_images/<slug>.jpg via
//    POST /api/admin/upload, then PUT /api/products/<id> { images: [url] }
// 4. verify: reload admin products, count real vs placeholder images
//
// Run: node scripts/apply_images.mjs

import { readFileSync, writeFileSync, statSync } from "node:fs";

const BASE = "https://hayaan.co";
const ADMIN_EMAIL = "gabeyre80@gmail.com";
const ADMIN_PASSWORD = "0AgJ(b1|@N52";
const MANIFEST = "/home/z/my-project/scripts/image_manifest.json";
const RESULT = "/home/z/my-project/scripts/apply-images-results.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const flat = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!res.ok || !flat.includes("shop_session")) {
    throw new Error(`login failed: ${res.status} ${flat.slice(0, 60)}`);
  }
  return flat;
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const cookie = await login();
console.log("[apply] logged in");

// current catalog
let products = [];
{
  const res = await fetch(`${BASE}/api/admin/products`, { headers: { cookie } });
  const data = await res.json();
  products = Array.isArray(data) ? data : (data.products ?? data.data ?? []);
}
console.log(`[apply] live products: ${products.length}`);

// placeholder = most common images[0]
const counts = new Map();
for (const p of products) {
  const u = Array.isArray(p.images) ? p.images[0] : null;
  if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
}
const placeholder = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
console.log(`[apply] placeholder url: ${placeholder?.slice(-40)} (x${counts.get(placeholder)})`);

const byName = new Map(products.map((p) => [p.name, p]));
const results = [];
let updated = 0, skipped = 0, failed = 0;

async function uploadOne(file, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const buf = readFileSync(file);
      const form = new FormData();
      form.append("file", new Blob([buf], { type: "image/jpeg" }), `${file.split("/").pop()}`);
      const res = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) return data.url;
      console.error(`  [upload-err] ${file.split("/").pop()}: ${res.status} ${JSON.stringify(data).slice(0, 100)}`);
    } catch (e) { console.error(`  [upload-ex] ${String(e).slice(0, 100)}`); }
    await sleep(2000);
  }
  return null;
}

for (const m of manifest) {
  const p = byName.get(m.name);
  if (!p) { skipped++; results.push({ ...m, status: "no-product" }); continue; }
  const cur = Array.isArray(p.images) ? p.images[0] : null;
  if (cur && cur !== placeholder && cur.startsWith("http")) {
    skipped++;
    results.push({ ...m, status: "already-real", productId: p.id });
    continue;
  }
  if (!m.ok || !m.file || !statSync(m.file).size) {
    skipped++;
    results.push({ ...m, status: "no-image-file", productId: p.id });
    continue;
  }
  const url = await uploadOne(m.file);
  if (!url) { failed++; results.push({ ...m, status: "upload-failed", productId: p.id }); continue; }
  const res = await fetch(`${BASE}/api/products/${p.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ images: [url] }),
  });
  if (res.ok) {
    updated++;
    results.push({ ...m, status: "updated", productId: p.id, liveUrl: url });
    console.log(`[apply] ${updated} OK ${m.name} <- ${m.slug}`);
  } else {
    failed++;
    const err = await res.json().catch(() => ({}));
    results.push({ ...m, status: "put-failed", error: JSON.stringify(err).slice(0, 120) });
    console.error(`[apply] PUT fail ${m.name}: ${res.status}`);
  }
  await sleep(250);
}

writeFileSync(RESULT, JSON.stringify(results, null, 1));

// verify
{
  const res = await fetch(`${BASE}/api/admin/products`, { headers: { cookie } });
  const data = await res.json();
  const now = Array.isArray(data) ? data : (data.products ?? data.data ?? []);
  const real = now.filter((p) => Array.isArray(p.images) && p.images[0] && p.images[0] !== placeholder).length;
  const ph = now.filter((p) => Array.isArray(p.images) && p.images[0] === placeholder).length;
  console.log(`[apply] VERIFY total=${now.length} realImages=${real} stillPlaceholder=${ph}`);
}
console.log(`[apply] DONE updated=${updated} skipped=${skipped} failed=${failed}`);
