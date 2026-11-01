// Task 138: import Sanguni's two new Galaxy A17 variants + SEO-enrich the
// base A17 listing (owner: "add both of them and make all of them seo and
// AEO optimized"). Supplier-factual data (PDP JSON-LD, fetched 2026-11-01):
//   a17-2 -> Samsung Galaxy A17 (8GB/256GB)  $240  sku 31172  OOS upstream
//   a17-3 -> Samsung Galaxy A17 (6GB/128GB)  $220  sku 31175  OOS upstream
// Base A17 (4GB/128GB, $170) already live — gets a spec-list description PUT.
// Slugs follow the A57 variant convention: samsung-galaxy-a17-8gb256gb /
// samsung-galaxy-a17-6gb128gb. Images are repo-hosted (PS5/Fold8 precedent)
// and must be deployed + HEAD-checked BEFORE create. pdp-seo.ts overrides for
// all three slugs ship in the same deploy.
// Run: node scripts/t138-import.mjs        (dry run)
//      APPLY=1 node scripts/t138-import.mjs
import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";
const OUT = "/home/z/my-project/scripts/t138-import-results.json";
const PHONES_CAT = "90c6c2f0-40da-4a17-83b1-808bb8237e2e"; // phones-wearables

// Task 91 description pattern (A57/Fold8 precedent): Hayaan wrapper +
// supplier's PDP spec list + delivery/Sifalo line. Specs are verbatim from
// sanguni's A17 PDPs (battery 5000mAh is listed on the 8GB/256GB PDP and is
// the shared A17 spec).
const specList = (ram, storage, battery = true) =>
  "<ul>" +
  `<li><strong>Storage:</strong> ${storage}</li>` +
  `<li><strong>RAM:</strong> ${ram}</li>` +
  (battery ? "<li><strong>Battery:</strong> 5000mAh</li>" : "") +
  "<li><strong>Display:</strong> 6.7-inch</li>" +
  "<li><strong>Main camera:</strong> 50 MP, f/1.8, (wide) + 5 MP, f/2.2, (ultrawide) + 2 MP, f/2.4, (macro)</li>" +
  "<li><strong>Selfie camera:</strong> 13 MP, f/2.0, (wide)</li>" +
  "<li><strong>Video:</strong> 1080p@30fps</li>" +
  "</ul>" +
  "<p>Order today for fast delivery across Somalia — pay securely by card or Sifalo.</p>";

const NEW_PRODUCTS = [
  {
    name: "Samsung Galaxy A17 (8GB/256GB)",
    price: 240,
    slug: "samsung-galaxy-a17-8gb256gb",
    supplierUrl: "https://sanguni.so/product/samsung-galaxy-a17-2/",
    supplierSku: "31172",
    imageUrl: "https://hayaan.co/images/products/samsung-galaxy-a17-8gb256gb.jpg",
    description:
      "<p>Samsung Galaxy A17 (8GB/256GB) — genuine stock available now at Hayaan Market.</p>" +
      specList("8GB", "256GB"),
  },
  {
    name: "Samsung Galaxy A17 (6GB/128GB)",
    price: 220,
    slug: "samsung-galaxy-a17-6gb128gb",
    supplierUrl: "https://sanguni.so/product/samsung-galaxy-a17-3/",
    supplierSku: "31175",
    imageUrl: "https://hayaan.co/images/products/samsung-galaxy-a17-6gb128gb.jpg",
    description:
      "<p>Samsung Galaxy A17 (6GB/128GB) — genuine stock available now at Hayaan Market.</p>" +
      specList("6GB", "128GB"),
  },
];

// Base A17 enrichment: replace the import-era one-liner (template #3) with
// the same spec-list pattern the variants get. Guarded on the exact old text.
const BASE_A17_SLUG = "samsung-galaxy-a17";
const BASE_A17_OLD_DESC =
  "Samsung Galaxy A17 — genuine device, ready for Somali networks. Buy now from Hayaan Market for fast nationwide delivery and secure card or Sifalo payment.";
const BASE_A17_NEW_DESC =
  "<p>Samsung Galaxy A17 — genuine stock available now at Hayaan Market.</p>" +
  specList("4GB", "128GB");

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

// ---------- current catalog (admin list covers inactive rows) ----------
const adminBefore = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const before = adminBefore.products ?? [];
const existingNames = new Set(before.map((p) => p.name.trim().toLowerCase()));
const existingSlugs = new Set(before.map((p) => p.slug));
const existingSkus = new Set(before.map((p) => p.sku).filter(Boolean));
console.log("[catalog]", before.length, "products");
const mobNums = [...existingSkus]
  .map((s) => (s.match(/^HAY-MOB-(\d+)$/) || [])[1])
  .filter(Boolean)
  .map(Number);
let nextSku = Math.max(200, ...mobNums) + 1;
console.log("[sku] next HAY-MOB =", nextSku);

const results = { ranAt: new Date().toISOString(), apply: APPLY, creates: [], baseEnrich: null, verify: {} };

// ---------- create the two variants ----------
for (const np of NEW_PRODUCTS) {
  if (existingNames.has(np.name.toLowerCase()) || existingSlugs.has(np.slug)) {
    console.log(`[create] SKIP — ${np.name} already exists`);
    results.creates.push({ name: np.name, status: "skipped-exists" });
    continue;
  }
  let sku = `HAY-MOB-${nextSku++}`;
  while (existingSkus.has(sku)) sku = `HAY-MOB-${nextSku++}`;
  existingSkus.add(sku);
  if (!APPLY) {
    console.log(`[dry] would create ${np.name} @ $${np.price} sku ${sku}`);
    results.creates.push({ name: np.name, status: "dry-run", sku });
    continue;
  }
  // image is repo-hosted: verify it's live before referencing it
  const head = await fetch(np.imageUrl, { method: "HEAD" });
  if (!head.ok) { console.error(`FATAL: image not live yet (${head.status}) ${np.imageUrl} — deploy first`); process.exit(1); }
  console.log("[image]", head.status, np.imageUrl);

  const body = {
    name: np.name,
    description: np.description,
    price: np.price,
    currency: "USD",
    sku,
    stock: 25,
    images: [np.imageUrl],
    tags: [],
    categoryId: PHONES_CAT,
    featured: false,
    isActive: true,
    productType: "physical",
    supplierUrl: np.supplierUrl,
    supplierSku: np.supplierSku,
  };
  const res = await fetch(`${BASE}/api/products`, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`[create] OK ${np.name} $${np.price} -> ${j.product?.slug} (id ${j.product?.id})`);
    results.creates.push({ name: np.name, status: "created", id: j.product?.id, slug: j.product?.slug, sku, price: np.price });
  } else {
    console.error(`[create] FAIL ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
    results.creates.push({ name: np.name, status: "failed", http: res.status, error: j.error ?? "" });
    writeFileSync(OUT, JSON.stringify(results, null, 1));
    process.exit(2);
  }
  await sleep(500);
}

// ---------- base A17 description enrichment (guarded PUT) ----------
const base = before.find((x) => x.slug === BASE_A17_SLUG);
if (!base) {
  console.error("[MISS] base A17 row not found");
  results.baseEnrich = { status: "missing" };
} else if ((base.description ?? "").trim() !== BASE_A17_OLD_DESC) {
  console.error(`[SKIP] base A17 description changed since snapshot — refusing (len ${(base.description ?? "").length})`);
  results.baseEnrich = { status: "skipped-desc-changed" };
} else if (!APPLY) {
  console.log("[dry] would enrich base A17 description (spec list)");
  results.baseEnrich = { status: "dry-run", id: base.id };
} else {
  const r = await fetch(`${BASE}/api/products/${base.id}`, { method: "PUT", headers, body: JSON.stringify({ description: BASE_A17_NEW_DESC }) });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && (j.product?.description ?? "").includes("50 MP");
  console.log(`[put] base A17 description enrich ${ok ? "OK" : `FAIL ${r.status}`}`);
  results.baseEnrich = { status: ok ? "updated" : "failed", id: base.id, http: r.status };
}

// ---------- verify ----------
if (APPLY) {
  await sleep(1500);
  const adminAfter = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
  const afterItems = adminAfter.products ?? [];
  const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
  const pubItems = pub.products ?? [];
  results.verify.count = afterItems.length;
  results.verify.publicCount = pubItems.length;
  results.verify.products = [];
  for (const np of NEW_PRODUCTS) {
    const row = afterItems.find((x) => x.slug === np.slug);
    const pubRow = pubItems.find((x) => x.slug === np.slug);
    const rec = {
      slug: np.slug,
      expectedPrice: np.price,
      adminPrice: row ? Number(row.price) : null,
      publicPrice: pubRow ? Number(pubRow.price) : null,
      hasImage: row ? (row.images ?? []).length > 0 : false,
      imageIsRepo: row ? String((row.images ?? [])[0] ?? "").includes("/images/products/") : false,
      supplierUrl: row?.supplierUrl ?? row?.supplier_url ?? null,
    };
    rec.match = rec.adminPrice === np.price && rec.publicPrice === np.price && rec.hasImage && rec.imageIsRepo;
    results.verify.products.push(rec);
  }
  const baseAfter = afterItems.find((x) => x.slug === BASE_A17_SLUG);
  results.verify.baseA17 = baseAfter
    ? { price: Number(baseAfter.price), descHasSpecs: (baseAfter.description ?? "").includes("50 MP"), active: baseAfter.isActive ?? baseAfter.is_active }
    : null;
  console.log("\n[verify] admin count:", results.verify.count, "public:", results.verify.publicCount);
  for (const v of results.verify.products) console.log(`[verify] ${v.slug}: admin $${v.adminPrice} public $${v.publicPrice} repoImage ${v.imageIsRepo} supplierUrl ${v.supplierUrl ? "set" : "MISSING"} -> ${v.match ? "MATCH" : "MISMATCH"}`);
  console.log("[verify] baseA17:", JSON.stringify(results.verify.baseA17));
}

writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n[done] APPLY=${APPLY} -> t138-import-results.json`);
const bad =
  results.creates.some((r) => r.status === "failed") ||
  (results.baseEnrich && ["failed", "missing"].includes(results.baseEnrich.status)) ||
  (APPLY && results.verify.products?.some((v) => !v.match)) ||
  (APPLY && !(results.verify.baseA17?.price === 170 && results.verify.baseA17?.descHasSpecs && results.verify.baseA17?.active));
if (APPLY && bad) process.exit(2);
