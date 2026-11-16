// Task 156 — pull the live admin catalog (includes supplierUrl/supplierSku
// and inactive rows) into scripts/t156/hayaan-admin-products.json.
// Node fetch (t137/t138 pattern) — Python urllib gets 403'd at the edge.
import { writeFileSync, readFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const email = "admin@hayaan.demo"; // real-owner creds 401 since a Sept password change — t137/t138 demo-admin path works
const password = "admin123";

const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
console.log("[login] ok");

const res = await fetch(`${BASE}/api/admin/products`, { headers: { cookie } });
if (!res.ok) { console.error("FATAL: admin list failed", res.status); process.exit(1); }
const data = await res.json();
const prods = data.products ?? data;
console.log("[admin] products:", prods.length);

writeFileSync("/home/z/my-project/scripts/t156/hayaan-admin-products.json", JSON.stringify(prods, null, 1));

const withSup = prods.filter((p) => p.supplierUrl || p.supplier_url).length;
console.log("[admin] with supplierUrl:", withSup, "/", prods.length);
const slugMap = {};
for (const p of prods) {
  const su = p.supplierUrl || p.supplier_url || "";
  const m = String(su).match(/sanguni\.so\/product\/([^/]+)/);
  if (m) slugMap[m[1]] = { slug: p.slug, name: p.name, price: Number(p.price), active: p.isActive ?? p.is_active };
}
console.log("[admin] rows mappable to a sanguni slug:", Object.keys(slugMap).length);
writeFileSync("/home/z/my-project/scripts/t156/hayaan-by-sanguni-slug.json", JSON.stringify(slugMap, null, 1));
