// Task 137: baseline prod catalog + diff against fresh sanguni crawl.
// NO writes — read-only admin GET + offline matching.
// Output: scripts/t137-baseline.json, t137-categories.json, t137-diff.json
import { writeFileSync, readFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/scripts";

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
console.log("[login] role:", (await loginRes.json())?.user?.role);

// ---------- baseline ----------
const admin = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const products = admin.products ?? [];
console.log("[admin products]", products.length, "fields:", Object.keys(products[0] ?? {}).join(","));
writeFileSync(`${OUT}/t137-baseline.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), products }, null, 1));

const cats = await (await fetch(`${BASE}/api/categories`)).json();
writeFileSync(`${OUT}/t137-categories.json`, JSON.stringify(cats, null, 1));
console.log("[categories]", (cats.categories ?? cats).map((c) => c.slug).join(", "));

// ---------- sanguni ----------
const sang = JSON.parse(readFileSync(`${OUT}/t137-sanguni-catalog.json`, "utf8"));
console.log("[sanguni]", Object.keys(sang).length);

// ---------- legacy maps ----------
const t118rows = JSON.parse(readFileSync(`${OUT}/task118-diff-final.json`, "utf8")).rows ?? [];
const t118map = {}; // our slug -> sanguni slug
for (const r of t118rows) if (r.sanguni_slug) t118map[r.slug] = r.sanguni_slug;
const t91 = JSON.parse(readFileSync(`${OUT}/task91-import-results.json`, "utf8"));
const t91map = {}; // our productSlug -> sanguni slug
for (const c of t91.created ?? []) t91map[c.productSlug] = c.slug;
const map2 = JSON.parse(readFileSync(`${OUT}/task118-map2.json`, "utf8")); // our slug -> candidates
const imgTargets = JSON.parse(readFileSync(`${OUT}/image_targets.json`, "utf8"));
const imgMap = {}; // our slug -> sanguni slug
for (const t of imgTargets) {
  const m = String(t.sanguni_url || "").match(/product\/([a-z0-9-]+)\/?/) || String(t.sanguni_url || "").match(/uploads\/[\d/]+\/([a-z0-9-]+)/);
  if (m) imgMap[t.slug] = m[1];
}

// ---------- matching ----------
const norm = (s) => (s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/^(refurbished|used)\s+/, "");

const bySupplier = {}, bySlug = {}, byName = {};
for (const [sslug, it] of Object.entries(sang)) {
  bySlug[sslug] = it;
  byName[norm(it.name)] = it;
  if (it.url) bySupplier[it.url.replace(/\/$/, "")] = it;
}

const matched = new Map(); // ourSlug -> {sang, method}
const usedSang = new Set();
function match(p, sslug, method) {
  if (!sslug || !sang[sslug] || usedSang.has(sslug)) return false;
  matched.set(p.slug, { sang: sang[sslug], method });
  usedSang.add(sslug);
  return true;
}
for (const p of products) {
  if (match(p, String(p.supplierUrl || "").replace(/\/$/, "").split("/product/")[1], "supplierUrl")) continue;
  if (match(p, t118map[p.slug], "t118")) continue;
  if (match(p, t91map[p.slug], "t91")) continue;
  if (match(p, p.slug, "slug")) continue;
  if (match(p, imgMap[p.slug], "imgTarget")) continue;
  const cand = map2[p.slug]?.candidates?.[0];
  if (cand && match(p, cand.slug, "map2")) continue;
  if (match(p, Object.keys(byName).includes(norm(p.name)) ? norm(p.name) : null, "name")) continue;
}

const priceChanges = [], oosChanges = [], inSync = [];
for (const p of products) {
  const m = matched.get(p.slug);
  if (!m) continue;
  const { sang: s, method } = m;
  const delta = +(s.price - Number(p.price)).toFixed(2);
  const row = { slug: p.slug, name: p.name, ours: Number(p.price), sanguni: s.price, delta, method, active: p.isActive, sOOS: !s.in_stock, sUrl: s.url };
  if (p.name.includes("Galaxy A18")) { row.note = "A18 owner-priced — excluded"; inSync.push(row); continue; }
  if (Math.abs(delta) > 0.005) priceChanges.push(row);
  else inSync.push(row);
  if (!s.in_stock && p.isActive !== false) oosChanges.push(row);
}

const news = Object.keys(sang).filter((k) => !usedSang.has(k)).map((k) => sang[k]);
const oursOnly = products.filter((p) => !matched.has(p.slug)).map((p) => ({ slug: p.slug, name: p.name, price: p.price, active: p.isActive }));

const diff = { ranAt: new Date().toISOString(), oursTotal: products.length, sanguniTotal: Object.keys(sang).length, matched: matched.size, newCount: news.length, priceChangeCount: priceChanges.length, oosChangeCount: oosChanges.length, news, priceChanges, oosChanges, oursOnly };
writeFileSync(`${OUT}/t137-diff.json`, JSON.stringify(diff, null, 1));

console.log(`\n=== DIFF SUMMARY ===`);
console.log(`ours ${products.length} | sanguni ${Object.keys(sang).length} | matched ${matched.size}`);
console.log(`NEW: ${news.length} | PRICE CHANGES: ${priceChanges.length} | OOS: ${oosChanges.length} | ours-only: ${oursOnly.length}`);
console.log("\nNEW (first 25):");
for (const n of news.slice(0, 25)) console.log(`  [${n.topcat}] ${n.name} — $${n.price}${n.in_stock ? "" : " (OOS)"}`);
console.log("\nPRICE CHANGES:");
for (const r of priceChanges) console.log(`  ${r.name}: $${r.ours} -> $${r.sanguni} (${r.method})`);
console.log("\nOOS upstream (active on ours):");
for (const r of oosChanges) console.log(`  ${r.name} ($${r.ours})`);
