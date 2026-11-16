// Task 156 Phase B — import the curated new products (genuinely-new sanguni
// additions + the owner-requested microphones) onto the live catalog.
// PRECONDITION: image files are repo-hosted (public/images/products/) and
// DEPLOYED — every create HEAD-checks https://hayaan.co/images/products/...
// before POSTing, so a stale deploy aborts before any damage.
// Category mapping: microphones -> power-charging-audio (audio family;
// headphones/speakers already live there — no category-create API exists).
// Run:  node scripts/t156-import-new.mjs        (dry run)
//       APPLY=1 node scripts/t156-import-new.mjs
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";
const OUT = "/home/z/my-project/scripts/t156/import-new-results.json";

const list = JSON.parse(readFileSync("/home/z/my-project/scripts/t156/import-list.json", "utf8"));
const saleRegulars = JSON.parse(readFileSync("/home/z/my-project/scripts/t156/sale-regulars.json", "utf8"));

const CAT_IDS = {}; // filled from live /api/categories: slug -> id
const CAT_BY_SANGUNI = (p) => {
  const cats = p.cats ?? [];
  if (cats.some((c) => /mic/.test(c))) return "power-charging-audio"; // owner: "also microphones"
  const top = (cats.find((c) => !c.includes("/")) ?? cats[0] ?? "").split("/")[0];
  return {
    "mobile-accessories": "phones-wearables",
    "computer-accessories": "computers-tv-gaming",
    "camera-accessories": "computers-tv-gaming",
    "home-appliances": "home-office",
    "printer-ink": "computers-tv-gaming",
    "stationary": "home-office",
  }[top] ?? "computers-tv-gaming";
};

const desc = (name, isMic) =>
  `<p>${name} — ${isMic ? "crisp, tested audio gear" : "genuine stock"} available now at Hayaan Market.</p>` +
  `<p>Order today for fast delivery across Somalia — pay securely by card or Sifalo.</p>`;

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

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

// ---------- live state ----------
const catsRes = await (await fetch(`${BASE}/api/categories`)).json();
for (const c of catsRes.categories ?? catsRes) CAT_IDS[c.slug] = c.id;
console.log("[cats]", Object.keys(CAT_IDS).join(", "));

const adminBefore = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const before = adminBefore.products ?? [];
const existingNames = new Set(before.map((p) => p.name.trim().toLowerCase()));
const existingSlugs = new Set(before.map((p) => p.slug));
const existingSkus = new Set(before.map((p) => p.sku).filter(Boolean));
console.log("[catalog]", before.length, "products");

// sku counters per prefix, continuing past the highest existing number
const nextSku = { MIC: 101, ELE: 201 };
for (const s of existingSkus) {
  const m = s.match(/^HAY-(MIC|ELE)-(\d+)$/);
  if (m) nextSku[m[1]] = Math.max(nextSku[m[1]], Number(m[2]) + 1);
}

const results = { ranAt: new Date().toISOString(), apply: APPLY, creates: [], verify: {} };
let fail = 0;

for (const p of list) {
  const name = p.name;
  const isMic = (p.cats ?? []).some((c) => /mic/.test(c));
  let slug = p.hayaanSlug || slugify(name);
  while (existingSlugs.has(slug)) slug = `${slug}-x`;
  if (existingNames.has(name.trim().toLowerCase())) {
    console.log(`[create] SKIP — ${name} already exists`);
    results.creates.push({ name, status: "skipped-exists" });
    continue;
  }
  const catSlug = CAT_BY_SANGUNI(p);
  const catId = CAT_IDS[catSlug];
  if (!catId) { console.error(`[SKIP] ${name}: category ${catSlug} missing`); fail++; continue; }
  let prefix = isMic ? "MIC" : "ELE";
  let sku = `HAY-${prefix}-${nextSku[prefix]++}`;
  while (existingSkus.has(sku)) sku = `HAY-${prefix}-${nextSku[prefix]++}`;
  existingSkus.add(sku);
  existingSlugs.add(slug);

  const imgPath = p.imageRepoPath; // e.g. images/products/<slug>.jpg
  const imgLive = `https://hayaan.co/${imgPath}`;
  if (!APPLY) {
    console.log(`[dry] ${name} @ $${p.price} [${catSlug}] sku ${sku} img ${imgPath}`);
    results.creates.push({ name, status: "dry-run", slug, sku, catSlug, price: p.price });
    continue;
  }
  const head = await fetch(imgLive, { method: "HEAD" });
  if (!head.ok) {
    console.error(`[FATAL] image not live (${head.status}) ${imgLive} — deploy first, aborting before any create`);
    results.creates.push({ name, status: "image-not-live", imgLive });
    writeFileSync(OUT, JSON.stringify(results, null, 1));
    process.exit(3);
  }
  const body = {
    name,
    description: desc(name, isMic),
    price: p.price,
    ...(p.compareAt ? { compareAt: p.compareAt } : {}),
    currency: "USD",
    sku,
    stock: 25,
    images: [imgLive],
    tags: [],
    categoryId: catId,
    featured: false,
    isActive: true,
    productType: "physical",
    supplierUrl: p.url,
    supplierSku: p.supplierSku ?? null,
  };
  const res = await fetch(`${BASE}/api/products`, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`[create] OK ${name} $${p.price} -> ${j.product?.slug} (id ${j.product?.id})`);
    results.creates.push({ name, status: "created", id: j.product?.id, slug: j.product?.slug, sku, price: p.price });
  } else {
    console.error(`[create] FAIL ${res.status}: ${JSON.stringify(j).slice(0, 160)}`);
    results.creates.push({ name, status: "failed", http: res.status, error: j.error ?? "" });
    fail++;
  }
  await new Promise((r) => setTimeout(r, 400));
}

// ---------- verify ----------
if (APPLY && results.creates.some((c) => c.status === "created")) {
  await new Promise((r) => setTimeout(r, 1500));
  const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
  const pubRows = pub.products ?? [];
  const adminAfter = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
  const afterRows = adminAfter.products ?? [];
  results.verify = { adminCount: afterRows.length, publicCount: pubRows.length, rows: [] };
  for (const c of results.creates.filter((x) => x.status === "created")) {
    const a = afterRows.find((x) => x.slug === c.slug);
    const pb = pubRows.find((x) => x.slug === c.slug);
    const ok =
      a && pb &&
      Math.abs(Number(a.price) - c.price) < 0.005 &&
      Math.abs(Number(pb.price) - c.price) < 0.005 &&
      (pb.images ?? []).length > 0 &&
      String((pb.images ?? [])[0] ?? "").includes("/images/products/");
    results.verify.rows.push({ slug: c.slug, expected: c.price, admin: a ? Number(a.price) : null, public: pb ? Number(pb.price) : null, ok });
    console.log(`[verify] ${c.slug}: admin ${a?.price} public ${pb?.price} -> ${ok ? "MATCH" : "MISMATCH"}`);
    if (!ok) fail++;
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n[done] APPLY=${APPLY} -> ${OUT} (failures: ${fail})`);
if (fail) process.exit(2);
