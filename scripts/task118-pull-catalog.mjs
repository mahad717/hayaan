// Task 118: pull the full live catalog from hayaan.co as the price-sync baseline.
// Pipeline (Task 92 pattern): POST /api/seed -> login admin@hayaan.demo -> GET products.
// Output: scripts/task118-catalog-baseline.json

import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/scripts/task118-catalog-baseline.json";

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

const r = await fetch(`${BASE}/api/products?limit=500`, { headers: { cookie } });
const j = await r.json();
const items = j.products ?? [];
console.log("[catalog]", items.length, "products");

const slim = items.map((p) => ({
  id: p.id, name: p.name, slug: p.slug, sku: p.sku, price: Number(p.price),
  compareAt: p.compareAt == null ? null : Number(p.compareAt),
  stock: p.stock, categoryId: p.categoryId, supplierUrl: p.supplierUrl ?? null,
  images: Array.isArray(p.images) ? p.images.length : 0,
}));
slim.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), count: slim.length, products: slim }, null, 1));
console.log("[done] -> task118-catalog-baseline.json");
const byCat = {};
for (const p of slim) byCat[p.categoryId] = (byCat[p.categoryId] ?? 0) + 1;
console.log("[by category]", JSON.stringify(byCat));
const withUrl = slim.filter((p) => p.supplierUrl).length;
console.log("[supplierUrl]", withUrl, "of", slim.length);
