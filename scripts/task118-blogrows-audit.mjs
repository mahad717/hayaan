// Task 118: audit blog_posts DB rows that could shadow the code-shipped posts we
// just price-synced (Task 98/99 lesson: a published DB row WINS the slug collision).
// Output: scripts/task118-blogrows.json
import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL login", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

const r = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie } });
console.log("[admin blog] status", r.status);
const j = await r.json().catch(() => ({}));
const rows = j.posts ?? j.items ?? j ?? [];
const list = Array.isArray(rows) ? rows : [];
console.log("DB rows:", list.length);
for (const p of list) {
  const body = String(p.content ?? "");
  const hits = (body.match(/\$\d[\d,\.]*/g) ?? []).slice(0, 12);
  console.log(`- [${p.slug}] published=${p.published ?? "?"} updated=${p.updated_at ?? p.updatedAt ?? "?"} len=${body.length}`);
  console.log(`    prices in body: ${hits.join(" ") || "(none)"}`);
}
writeFileSync("/home/z/my-project/scripts/task118-blogrows.json", JSON.stringify(list, null, 1));
console.log("-> task118-blogrows.json");
