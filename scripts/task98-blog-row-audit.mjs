// Task 98 phase 1: audit the Supabase blog_posts rows that shadow code-shipped
// SEO guides. The live A18 post is DB-served (no FAQPage/HowTo/quickAnswer in
// the HTML, dateModified 2026-10-12T18:22Z = a Supabase save), so a
// blog_posts row with slug samsung-galaxy-a18-price-in-somalia exists and wins
// the slug collision (src/lib/blog.ts: "DB wins on slug collision").
// This script: seed -> login -> GET /api/admin/blog -> inventory every
// source:"db" row -> back up the A18 row -> verdict verbatim-stale vs custom.
// Run: node scripts/task98-blog-row-audit.mjs

import { writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const SLUG = "samsung-galaxy-a18-price-in-somalia";
const BACKUP = "/home/z/my-project/scripts/task98-a18-dbrow-backup.json";

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

// ---------- inventory ----------
const listRes = await fetch(`${BASE}/api/admin/blog`, { headers });
if (!listRes.ok) { console.error("FATAL: admin blog list failed", listRes.status, await listRes.text()); process.exit(1); }
const { posts, tableMissing } = await listRes.json();
console.log("[list] tableMissing:", tableMissing, "total posts:", posts.length);

const dbRows = posts.filter((p) => p.source === "db");
console.log("\n== DB rows (shadow shipped guides or owner-authored) ==");
for (const p of dbRows) {
  console.log(`- ${p.slug} | id=${p.id} | status=${p.status} | updated=${p.updatedAt}`);
}
if (dbRows.length === 0) console.log("(none)");

// ---------- A18 row backup + verdict ----------
const a18 = posts.find((p) => p.slug === SLUG);
if (!a18) { console.log("\nNo post found for slug", SLUG); process.exit(2); }
console.log("\n== A18 post entry ==");
console.log("source:", a18.source, "| id:", a18.id, "| status:", a18.status, "| updatedAt:", a18.updatedAt);
console.log("has quickAnswer field:", "quickAnswer" in a18, "| has faqs field:", "faqs" in a18);

if (a18.source === "db") {
  writeFileSync(BACKUP, JSON.stringify({ backedUpAt: new Date().toISOString(), row: a18 }, null, 1));
  console.log("[backup] full DB row ->", BACKUP);

  const c = a18.content ?? "";
  const checks = {
    "256GB": /256\s?GB/i.test(c),
    "double the storage": /double the storage/i.test(c),
    "same 128GB": /same 128GB/i.test(c),
    "128GB storage, expandable": /128GB storage, expandable/i.test(c),
    "free shipping over $75": /free.{0,40}\$75|\$75.{0,40}free/i.test(c),
    contentLength: c.length,
    excerptLength: (a18.excerpt ?? "").length,
  };
  console.log("verdict checks:", JSON.stringify(checks, null, 1));
  const verbatimStale = checks["256GB"] && checks["double the storage"] && !checks["same 128GB"];
  console.log("VERDICT:", verbatimStale ? "VERBATIM-STALE (safe to delete; shipped guide is richer)" : "CUSTOM/UNKNOWN (do not delete blindly — merge 128GB into this row instead)");
} else {
  console.log("A18 is served from code (source=shipped) — no DB action needed.");
}
