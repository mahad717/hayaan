// Task 92: sync Hayaan's A-series Samsung prices UP to sanguni.so's current
// prices (owner approved "yes" after Task 91 flagged the drift).
//   A06 $110 -> $118   A07 $125 -> $140   A16 $118 -> $145   A17 $165 -> $190
// Pipeline (same as Task 91): POST /api/seed -> login admin@hayaan.demo ->
// backup the 4 rows -> PUT /api/products/:id { price } -> verify.
// Run: node scripts/task92-update-a-series.mjs

import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const RESULT = "/home/z/my-project/scripts/task92-price-sync-results.json";

// product ids pulled from the live catalog on 2026-10-12 (Task 91 import record)
const UPDATES = [
  { id: "87f4a5d5-99a4-4b11-aef6-f2e401e8cb56", name: "Samsung Galaxy A06", old: 110, price: 118, sanguni: "samsung-galaxy-a06" },
  { id: "9da7722a-2ea5-465c-a05d-346211bf724f", name: "Samsung Galaxy A07", old: 125, price: 140, sanguni: "samsung-galaxy-a07" },
  { id: "7798dbd3-0942-426b-b338-6fb831a68bc2", name: "Samsung Galaxy A16", old: 118, price: 145, sanguni: "samsung-galaxy-a16" },
  { id: "c50e10f4-d10c-47a8-af74-5dfe4db246df", name: "Samsung Galaxy A17", old: 165, price: 190, sanguni: "samsung-galaxy-a17-3 (lowest raised listing; -2 variant is $240)" },
];

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

// ---------- backup the 4 rows ----------
const backup = {};
for (const u of UPDATES) {
  const r = await fetch(`${BASE}/api/products/${u.id}`, { headers });
  const j = await r.json().catch(() => ({}));
  backup[u.name] = r.ok ? j.product : { error: r.status };
  console.log("[backup]", u.name, r.ok ? `$${j.product.price}` : `HTTP ${r.status}`);
  await sleep(300);
}
writeFileSync(RESULT.replace("-results.json", "-backup.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), backup }, null, 1));

// ---------- apply price updates ----------
const results = [];
for (const u of UPDATES) {
  const cur = backup[u.name];
  if (!cur || cur.error || Number(cur.price) !== u.old) {
    console.error(`[SKIP] ${u.name}: current price $${cur?.price} != expected $${u.old} — refusing to update`);
    results.push({ ...u, status: "skipped", reason: `current price $${cur?.price} != expected $${u.old}` });
    continue;
  }
  const r = await fetch(`${BASE}/api/products/${u.id}`, {
    method: "PUT", headers, body: JSON.stringify({ price: u.price }),
  });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && Number(j.product?.price) === u.price;
  console.log(`[put] ${u.name}: $${u.old} -> $${u.price} ${ok ? "OK" : `FAIL HTTP ${r.status} ${JSON.stringify(j).slice(0, 120)}`}`);
  results.push({ ...u, status: ok ? "updated" : "failed", http: r.status, newPrice: j.product?.price ?? null });
  await sleep(400);
}

// ---------- verify via public catalog ----------
const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
const items = pub.products ?? [];
const verify = {};
for (const u of UPDATES) {
  const p = items.find((x) => x.id === u.id);
  verify[u.name] = { publicPrice: p ? Number(p.price) : null, expected: u.price, match: p ? Number(p.price) === u.price : false };
  console.log(`[verify] ${u.name}: public $${p?.price} (expected $${u.price}) ${p && Number(p.price) === u.price ? "MATCH" : "MISMATCH"}`);
}

writeFileSync(RESULT, JSON.stringify({ ranAt: new Date().toISOString(), results, verify }, null, 1));
console.log("[done] -> task92-price-sync-results.json");
