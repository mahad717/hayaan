// Task 95-b: swap the A18 PDP image to the 1:1 square version.
// Reason: PDP uses aspect-square + object-cover; the 784x952 portrait image was center-cropped
// (~21% vertically) and the phone's top/bottom got clipped on mobile. A 952x952 square crops to zero.
// Run: node scripts/task95-swap-square-image.mjs

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const PRODUCT_ID = "0f2a1e38-b52c-460a-a928-8359cd2de199"; // Samsung Galaxy A18
const IMG = "/home/z/my-project/scripts/task95-img/samsung-galaxy-a18-square.jpg";
const RESULT = "/home/z/my-project/scripts/task95-swap-results.json";

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
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const headers = { "content-type": "application/json", cookie };

// ---------- backup current row ----------
const cur = await (await fetch(`${BASE}/api/admin/products`, { headers })).json();
const row = (cur.products ?? []).find((p) => p.id === PRODUCT_ID);
if (!row) { console.error("FATAL: product not found"); process.exit(1); }
writeFileSync("/home/z/my-project/scripts/task95-backup-before-swap.json", JSON.stringify(row, null, 1));
console.log("[backup] current images:", JSON.stringify(row.images));

// ---------- upload square image ----------
const buf = readFileSync(IMG);
const form = new FormData();
form.append("file", new Blob([buf], { type: "image/jpeg" }), "samsung-galaxy-a18-square.jpg");
const upRes = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
const upJson = await upRes.json().catch(() => ({}));
if (!upRes.ok || !upJson.url) { console.error(`FATAL: upload ${upRes.status}`, JSON.stringify(upJson).slice(0, 200)); process.exit(1); }
console.log("[upload] ok:", upJson.url);

// ---------- swap ----------
const res = await fetch(`${BASE}/api/products/${PRODUCT_ID}`, {
  method: "PUT", headers, body: JSON.stringify({ images: [upJson.url] }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`FATAL: update ${res.status}`, JSON.stringify(json).slice(0, 300)); process.exit(1); }
console.log("[update] ok");

// ---------- verify ----------
const pub = await (await fetch(`${BASE}/api/products?limit=500`)).json();
const mine = (pub.products ?? pub.items ?? pub).find((p) => p.id === PRODUCT_ID);
const ok = mine && mine.images?.[0] === upJson.url;
const report = { ranAt: new Date().toISOString(), newImage: upJson.url, verified: !!ok };
writeFileSync(RESULT, JSON.stringify(report, null, 1));
console.log("[verify]", ok ? "public API serves the square image" : "MISMATCH: " + JSON.stringify(mine?.images));
if (!ok) process.exit(2);
