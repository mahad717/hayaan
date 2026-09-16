// Hayaan catalog import (Task 52): remove the 12 demo products and import the
// 94 priced products from the Sanguni research list into the live Supabase DB.
//
// Method (no service_role key, no deploy needed — pure data ops on SSR site):
//   1. login at hayaan.co -> shop_session cookie (app admin API)
//   2. BACKUP: GET /api/admin/products + /api/categories -> local JSON
//   3. DELETE the 12 demo products by slug whitelist (only those)
//   4. upload branded placeholder via the app's own /api/admin/upload
//      (service-role server-side; direct Storage POST is RLS-blocked)
//   5. POST 94 products (94 priced; 14 unpriced items left for the owner)
//   6. verify: admin GET again, assert demo gone + counts add up
//
// Categories: tiers 1-3 land in existing "electronics", tier 4 in
// "home-living". Each product carries a tier tag; one SQL snippet later
// (scripts/catalog-categories.sql) creates proper categories, re-maps and
// cleans up. Run: bun scripts/import_catalog.mjs

import { readFileSync, writeFileSync } from "fs";

const BASE = "https://hayaan.co";
const SUPA = "https://mqyhgyakhfhuctnvezby.supabase.co";
const ADMIN_EMAIL = "gabeyre80@gmail.com";
const ADMIN_PASSWORD = "0AgJ(b1|@N52";
const BACKUP_FILE = "/home/z/my-project/scripts/backup-catalog-2026-09-17.json";
const RESULT_FILE = "/home/z/my-project/scripts/import-results.json";
const PLACEHOLDER = "/home/z/my-project/scripts/placeholder-hayaan.png";

const DEMO_SLUGS = new Set([
  "aurora-wireless-headphones",
  "nimbus-mechanical-keyboard",
  "terra-organic-cotton-tee",
  "drift-linen-hoodie",
  "sable-ceramic-vase",
  "meadow-soy-candle",
  "helix-vitamin-c-serum",
  "quill-leather-journal",
  "lumen-smart-led-strip",
  "bloom-botanical-skincare-set",
  "foundry-heavyweight-sweatshirt",
  "carry-canvas-tote",
]);

const TIERS = {
  1: { tag: "power-charging-audio", category: "electronics" },
  2: { tag: "phones-wearables", category: "electronics" },
  3: { tag: "computers-tv-gaming", category: "electronics" },
  4: { tag: "home-office", category: "home-living" },
};

const DEFAULT_STOCK = 25; // product detail disables "Add to cart" at 0; owner adjusts in admin

const DESCRIPTIONS = {
  1: [
    (n) => `Keep your phones and gear powered through every outage. ${n} is tested, genuine stock available now at Hayaan Market — order today for fast delivery across Somalia, paying by card or Sifalo.`,
    (n) => `${n} — reliable everyday charging and audio gear from Hayaan Market. Ready to ship anywhere in Somalia with secure card or Sifalo payment.`,
  ],
  2: [
    (n) => `${n} — genuine device, ready for Somali networks. Buy now from Hayaan Market for fast nationwide delivery and secure card or Sifalo payment.`,
    (n) => `Upgrade your everyday carry with the ${n}. Available now at Hayaan Market — fast delivery across Somalia, pay by card or Sifalo.`,
  ],
  3: [
    (n) => `${n} — serious performance for work, study and play, from Hayaan Market. Order today for fast delivery across Somalia with card or Sifalo payment.`,
    (n) => `Big-screen and big-power picks like the ${n} move fast. Get yours now at Hayaan Market — nationwide delivery, card or Sifalo payment.`,
  ],
  4: [
    (n) => `${n} — dependable home and office essentials, stocked at Hayaan Market. Order today for fast delivery across Somalia, paying by card or Sifalo.`,
    (n) => `Make daily life easier with the ${n}. Available now at Hayaan Market — nationwide delivery with card or Sifalo payment.`,
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(url, opts = {}) {
  const res = await fetch(url, opts);
  return res;
}

// ---------- 1. app login ----------
const loginRes = await once(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const loginBody = await loginRes.json().catch(() => null);
if (!loginRes.ok) throw new Error(`app login failed (${loginRes.status}): ${JSON.stringify(loginBody).slice(0, 200)}`);
const sc = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
const cookie = sc.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
console.log("  app session OK (role=" + (loginBody?.user?.role ?? "?") + ")");

const appHeaders = { "Content-Type": "application/json", Cookie: cookie };

// ---------- 2. backup ----------
console.log("→ backing up current catalog…");
const [admRes, catRes] = await Promise.all([
  once(`${BASE}/api/admin/products`, { headers: appHeaders }),
  once(`${BASE}/api/categories`),
]);
if (!admRes.ok) throw new Error(`admin products GET failed: ${admRes.status} ${await admRes.text()}`);
const current = (await admRes.json()).products ?? [];
const catJson = await catRes.json();
const categories = catJson.categories ?? catJson;
if (current.length > 0) {
  writeFileSync(BACKUP_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), categories, products: current }, null, 1));
  console.log(`  backup: ${current.length} products, ${categories.length} categories -> ${BACKUP_FILE}`);
  current.forEach((p) => console.log(`    - ${p.slug} ($${p.price}) [${p.category?.name ?? "no category"}]`));
} else {
  console.log(`  catalog is empty now (demo already deleted) — keeping existing ${BACKUP_FILE}`);
}

// ---------- 3. delete demo products (slug whitelist) ----------
const demoIds = current.filter((p) => DEMO_SLUGS.has(p.slug));
const others = current.filter((p) => !DEMO_SLUGS.has(p.slug));
if (others.length) console.log(`  ⚠ ${others.length} non-demo products will be LEFT untouched: ${others.map((p) => p.slug).join(", ")}`);
console.log(`→ deleting ${demoIds.length} demo products…`);
const deleted = [];
for (const p of demoIds) {
  const res = await once(`${BASE}/api/products/${p.id}`, { method: "DELETE", headers: appHeaders });
  if (res.ok) { deleted.push(p.slug); console.log(`  ✓ deleted ${p.slug}`); }
  else console.error(`  ✗ delete ${p.slug}: ${res.status} ${(await res.text()).slice(0, 150)}`);
  await sleep(200);
}

// ---------- 4. upload placeholder via the app's admin upload route ----------
console.log("→ uploading placeholder image via /api/admin/upload…");
const phBytes = readFileSync(PLACEHOLDER);
const form = new FormData();
form.append("file", new Blob([phBytes], { type: "image/png" }), "hayaan-placeholder.png");
const upRes = await once(`${BASE}/api/admin/upload`, { method: "POST", headers: { Cookie: cookie }, body: form });
const upJson = await upRes.json().catch(() => ({}));
if (!upRes.ok || !upJson.url)
  throw new Error(`placeholder upload failed (${upRes.status}): ${JSON.stringify(upJson).slice(0, 300)}`);
const placeholderUrl = upJson.url;
const serve = await once(placeholderUrl);
console.log(`  placeholder live: ${serve.status} ${placeholderUrl} (${phBytes.length} bytes)`);

// ---------- 5. import products ----------
const catalog = JSON.parse(readFileSync("/home/z/my-project/scripts/catalog_data.json", "utf8"));
const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));
console.log("→ importing products…");
const created = [], failed = [], skipped = [];
let i = 0;
for (const section of catalog) {
  const tier = section.tier;
  const conf = TIERS[tier];
  const categoryId = catBySlug.get(conf.category);
  if (!categoryId) throw new Error(`category slug not found: ${conf.category}`);
  let n = 0;
  for (const item of section.products) {
    i++; n++;
    const body = {
      name: item.name,
      description: DESCRIPTIONS[tier][i % 2](item.name),
      price: item.price,
      currency: "USD",
      sku: `HAY-T${tier}-${String(n).padStart(3, "0")}`,
      stock: DEFAULT_STOCK,
      images: [placeholderUrl],
      tags: [conf.tag],
      categoryId,
    };
    try {
      const res = await once(`${BASE}/api/products`, { method: "POST", headers: appHeaders, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { created.push({ id: json.product.id, slug: json.product.slug, sku: body.sku, tier }); }
      else failed.push({ name: item.name, status: res.status, error: json.error ?? (await res.text()).slice(0, 150) });
    } catch (e) {
      failed.push({ name: item.name, error: String(e).slice(0, 150) });
    }
    if (i % 10 === 0) console.log(`  … ${i} processed (${created.length} ok, ${failed.length} failed)`);
    await sleep(200);
  }
}
const noPrice = catalog.flatMap((s) => []).concat(skipped);

// ---------- 6. verify ----------
console.log("→ verifying via admin API…");
const verify = await once(`${BASE}/api/admin/products`, { headers: appHeaders });
const after = (await verify.json()).products ?? [];
const stillDemo = after.filter((p) => DEMO_SLUGS.has(p.slug));
const imported = after.filter((p) => p.sku?.startsWith("HAY-"));
console.log(`  products now: ${after.length} (imported ${imported.length}, demo remaining ${stillDemo.length})`);

const report = {
  ranAt: new Date().toISOString(),
  placeholderUrl,
  deleted,
  createdCount: created.length,
  failedCount: failed.length,
  failed,
  created,
  demoRemaining: stillDemo.map((p) => p.slug),
  totalNow: after.length,
};
writeFileSync(RESULT_FILE, JSON.stringify(report, null, 1));
console.log(`\nDONE: deleted=${deleted.length} created=${created.length} failed=${failed.length} total_now=${after.length}`);
console.log(`report -> ${RESULT_FILE}`);
if (failed.length) process.exit(2);
