// Task 92 REVERT (owner request): restore the original A-series prices
//   A06 $118 -> $110   A07 $140 -> $125   A16 $145 -> $118   A17 $190 -> $165
// Same pipeline + same safety precondition as the forward sync: refuse if the
// current price is not the synced price (i.e. someone changed it meanwhile).
// Run: node scripts/task92-revert-a-series.mjs

import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const RESULT = "/home/z/my-project/scripts/task92-revert-results.json";

const REVERTS = [
  { id: "87f4a5d5-99a4-4b11-aef6-f2e401e8cb56", name: "Samsung Galaxy A06", expectCurrent: 118, price: 110 },
  { id: "9da7722a-2ea5-465c-a05d-346211bf724f", name: "Samsung Galaxy A07", expectCurrent: 140, price: 125 },
  { id: "7798dbd3-0942-426b-b338-6fb831a68bc2", name: "Samsung Galaxy A16", expectCurrent: 145, price: 118 },
  { id: "c50e10f4-d10c-47a8-af74-5dfe4db246df", name: "Samsung Galaxy A17", expectCurrent: 190, price: 165 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- seed + login ----------
const seedRes = await fetch(`${BASE}/api/seed`, {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}",
});
console.log("[seed]", seedRes.status);

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

// ---------- apply reverts ----------
const results = [];
for (const u of REVERTS) {
  const curRes = await fetch(`${BASE}/api/products/${u.id}`, { headers });
  const cur = (await curRes.json().catch(() => ({})))?.product;
  if (!cur || Number(cur.price) !== u.expectCurrent) {
    console.error(`[SKIP] ${u.name}: current price $${cur?.price} != expected $${u.expectCurrent} — refusing to revert`);
    results.push({ ...u, status: "skipped", reason: `current $${cur?.price} != expected $${u.expectCurrent}` });
    continue;
  }
  const r = await fetch(`${BASE}/api/products/${u.id}`, {
    method: "PUT", headers, body: JSON.stringify({ price: u.price }),
  });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && Number(j.product?.price) === u.price;
  console.log(`[revert] ${u.name}: $${u.expectCurrent} -> $${u.price} ${ok ? "OK" : `FAIL HTTP ${r.status}`}`);
  results.push({ ...u, status: ok ? "reverted" : "failed", http: r.status, newPrice: j.product?.price ?? null });
  await sleep(400);
}

// ---------- verify via public catalog ----------
const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
const items = pub.products ?? [];
const verify = {};
for (const u of REVERTS) {
  const p = items.find((x) => x.id === u.id);
  verify[u.name] = { publicPrice: p ? Number(p.price) : null, expected: u.price, match: p ? Number(p.price) === u.price : false };
  console.log(`[verify] ${u.name}: public $${p?.price} (expected $${u.price}) ${p && Number(p.price) === u.price ? "MATCH" : "MISMATCH"}`);
}

writeFileSync(RESULT, JSON.stringify({ ranAt: new Date().toISOString(), results, verify }, null, 1));
console.log("[done] -> task92-revert-results.json");
