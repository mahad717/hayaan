// Task 118: apply the 13 owner-requested price updates (sanguni.so sync, PDP-verified).
// Safety: refuses to touch a product whose current price != expected old price.
// Output: scripts/task118-apply-results.json (backup rows + results included)
// Run: node scripts/task118-apply-prices.mjs        (dry run: no PUTs)
//      APPLY=1 node scripts/task118-apply-prices.mjs

import { writeFileSync, readFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";
const OUT = "/home/z/my-project/scripts/task118-apply-results.json";

// from task118-diff-final.json + task118-pdp-verify.json (13/13 PDP-confirmed)
const UPDATES = [
  { slug: "hp-toner-cartridge-651a-original-set", name: "HP Toner Cartridge 651A Original Set", old: 277, price: 1580 },
  { slug: "macbook-pro-m5", name: "MacBook Pro M5", old: 1900, price: 2150 },
  { slug: "sony-playstation-5-digital-edition-slim", name: "Sony PlayStation 5 Digital Edition (Slim)", old: 720, price: 850 },
  { slug: "microphone-dji-mic-mini-2", name: "Microphone DJI Mic Mini 2", old: 33.3, price: 125 },
  { slug: "hp-printer-laser-107a", name: "HP Printer Laser 107A", old: 75, price: 165 },
  { slug: "anker-boom-3i-outdoor-bluetooth-speaker", name: "Anker Boom 3i Outdoor Bluetooth Speaker", old: 16.7, price: 95 },
  { slug: "hp-printer-laser-mfp-135a", name: "HP Printer Laser MFP 135A", old: 165, price: 224.9 },
  { slug: "digital-voltage-stabilizer-lightwave", name: "Digital Voltage Stabilizer Lightwave", old: 11.5, price: 65 },
  { slug: "hp-elitebook-840-g9-intel-core-i7-12gen", name: "Refurbished HP EliteBook 840 G9 Intel Core i7-12Gen", old: 950, price: 990 },
  { slug: "samsung-galaxy-a16", name: "Samsung Galaxy A16", old: 118, price: 145 },
  { slug: "samsung-galaxy-a07", name: "Samsung Galaxy A07", old: 125, price: 140 },
  { slug: "samsung-galaxy-a06", name: "Samsung Galaxy A06", old: 110, price: 118 },
  { slug: "power-bank-aston-magsafe-10,000mah", name: "Power Bank Aston MagSafe 10,000mAh", old: 22, price: 26 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- login ----------
const seedRes = await fetch(`${BASE}/api/seed`, {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}",
});
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const headers = { "content-type": "application/json", cookie };
console.log("[login] ok, APPLY =", APPLY);

// ---------- current catalog (fresh, for guards + ids) ----------
const cat = await (await fetch(`${BASE}/api/products?limit=500`, { headers })).json();
const items = cat.products ?? [];
console.log("[catalog]", items.length);

// ---------- backup + guard + apply ----------
const results = [];
for (const u of UPDATES) {
  const cur = items.find((x) => x.slug === u.slug);
  if (!cur) {
    console.error(`[MISS] ${u.slug} not in catalog`);
    results.push({ ...u, status: "missing" });
    continue;
  }
  const curPrice = Number(cur.price);
  if (Math.abs(curPrice - u.old) > 0.005) {
    console.error(`[SKIP] ${u.name}: current $${curPrice} != expected $${u.old} — refusing`);
    results.push({ ...u, id: cur.id, status: "skipped", currentPrice: curPrice });
    continue;
  }
  if (!APPLY) {
    console.log(`[dry] ${u.name}: $${curPrice} -> $${u.price} (id ${cur.id})`);
    results.push({ ...u, id: cur.id, status: "dry-run" });
    continue;
  }
  const r = await fetch(`${BASE}/api/products/${cur.id}`, {
    method: "PUT", headers, body: JSON.stringify({ price: u.price }),
  });
  const j = await r.json().catch(() => ({}));
  const ok = r.ok && Number(j.product?.price) === u.price;
  console.log(`[put] ${u.name}: $${u.old} -> $${u.price} ${ok ? "OK" : `FAIL ${r.status} ${JSON.stringify(j).slice(0, 100)}`}`);
  results.push({ ...u, id: cur.id, status: ok ? "updated" : "failed", http: r.status });
  await sleep(400);
}

// ---------- verify via public API ----------
const verify = [];
if (APPLY) {
  await sleep(1500);
  const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
  const pubItems = pub.products ?? [];
  for (const u of UPDATES) {
    const p = pubItems.find((x) => x.slug === u.slug);
    const got = p ? Number(p.price) : null;
    verify.push({ slug: u.slug, expected: u.price, public: got, match: got === u.price });
    console.log(`[verify] ${u.slug}: public $${got} (expected $${u.price}) ${got === u.price ? "MATCH" : "MISMATCH"}`);
  }
}

writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), apply: APPLY, results, verify }, null, 1));
console.log(`[done] APPLY=${APPLY} -> task118-apply-results.json`);
