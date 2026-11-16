// Task 156 Phase A — sync sanguni price changes onto the live Hayaan catalog.
// Pure data op (admin API PUT), no deploy needed. Guards: every PUT asserts
// the row's CURRENT price still equals the diff's `hayaan` snapshot; if it
// moved meanwhile the update is skipped and reported.
// Run:  node scripts/t156-sync-prices.mjs      (dry run)
//       APPLY=1 node scripts/t156-sync-prices.mjs
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";
const OUT = "/home/z/my-project/scripts/t156/price-sync-results.json";

const changes = JSON.parse(readFileSync("/home/z/my-project/scripts/t156/changes.json", "utf8"));
const updates = changes.price_updates ?? [];
if (!updates.length) { console.log("[diff] no price updates"); process.exit(0); }

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

const admin = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const rows = admin.products ?? [];
const byId = new Map(rows.map((r) => [r.id, r]));

const results = { ranAt: new Date().toISOString(), apply: APPLY, updates: [], verify: [] };
let fail = 0;

for (const u of updates) {
  const row = byId.get(u.id);
  if (!row) {
    console.error(`[SKIP] ${u.name}: row disappeared`);
    results.updates.push({ ...u, status: "missing-row" });
    fail++;
    continue;
  }
  const cur = Number(row.price);
  if (Math.abs(cur - u.hayaan) > 0.49) {
    console.error(`[GUARD] ${u.name}: expected ${u.hayaan}, live is ${cur} — skipping`);
    results.updates.push({ ...u, status: "guard-failed", live: cur });
    fail++;
    continue;
  }
  if (!APPLY) {
    console.log(`[dry] ${u.name}: ${u.hayaan} -> ${u.sanguni}`);
    results.updates.push({ ...u, status: "dry-run" });
    continue;
  }
  const r = await fetch(`${BASE}/api/products/${u.id}`, {
    method: "PUT", headers,
    body: JSON.stringify({ price: u.sanguni }),
  });
  const j = await r.json().catch(() => ({}));
  const newPrice = Number(j.product?.price ?? j.price ?? NaN);
  const ok = r.ok && Math.abs(newPrice - u.sanguni) < 0.005;
  console.log(`[put] ${u.name}: ${u.hayaan} -> ${u.sanguni} ${ok ? "OK" : `FAIL http ${r.status} got ${newPrice}`}`);
  results.updates.push({ ...u, status: ok ? "updated" : "failed", http: r.status, newPrice });
  if (!ok) fail++;
}

// ---------- verify ----------
if (APPLY && results.updates.some((u) => u.status === "updated")) {
  const after = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
  const afterRows = after.products ?? [];
  const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
  const pubRows = pub.products ?? [];
  for (const u of results.updates.filter((x) => x.status === "updated")) {
    const a = afterRows.find((x) => x.id === u.id);
    const p = pubRows.find((x) => x.slug === u.slug);
    const ok = a && Math.abs(Number(a.price) - u.sanguni) < 0.005 && p && Math.abs(Number(p.price) - u.sanguni) < 0.005;
    results.verify.push({ slug: u.slug, expected: u.sanguni, admin: a ? Number(a.price) : null, public: p ? Number(p.price) : null, ok });
    console.log(`[verify] ${u.slug}: admin ${a ? a.price : "?"} public ${p ? p.price : "?"} -> ${ok ? "MATCH" : "MISMATCH"}`);
    if (!ok) fail++;
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\n[done] APPLY=${APPLY} -> ${OUT} (failures: ${fail})`);
if (fail) process.exit(2);
