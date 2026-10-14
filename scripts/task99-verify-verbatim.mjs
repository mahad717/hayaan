// Task 99 — verbatim check: is the re-created A18 blog DB row a pure snapshot
// of the currently-shipped code post (Task 98 playbook: if byte-equal after
// normalization, the row carries zero owner customization and can be deleted
// so the canonical code post serves with fresh dates + AEO mesh)?
// Usage: node scripts/task99-verify-verbatim.mjs
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const EMAIL = process.env.ADMIN_EMAIL || "admin@hayaan.demo";
const PASS = process.env.ADMIN_PASS || "admin123";
const SLUG = "samsung-galaxy-a18-price-in-somalia";

const norm = (s) =>
  (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

// --- 1. Extract post16 fields from the TS source ---
const src = readFileSync(new URL("../src/lib/blog-seo-posts.ts", import.meta.url), "utf8");
const start = src.indexOf('slug: "samsung-galaxy-a18-price-in-somalia"');
if (start < 0) throw new Error("post16 not found in source");
const seg = src.slice(start, src.indexOf("\nconst post17", start) > 0 ? src.indexOf("\nconst post17", start) : start + 60000);

const titleM = seg.match(/title: "((?:[^"\\]|\\.)*)"/);
const excerptM = seg.match(/excerpt:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
const contentStart = seg.indexOf("content: `");
const contentEnd = seg.indexOf("`,", contentStart);
if (!titleM || !excerptM || contentStart < 0 || contentEnd < 0) throw new Error("post16 field extraction failed");
const codeTitle = JSON.parse(`"${titleM[1]}"`);
const codeExcerpt = JSON.parse(`"${excerptM[1]}"`);
const codeContent = seg.slice(contentStart + "content: `".length, contentEnd);

// --- 2. Fetch the DB row via admin API ---
const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const seedCookie = (seed.headers.get("set-cookie") || "").split(";")[0];
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: seedCookie },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
const authCookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
if (!authCookie) throw new Error("login failed");

const list = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } });
const payload = await list.json();
const posts = payload.posts ?? [];
// The admin list merges rows (source:"db") with shipped posts — keep only rows.
const row = posts.find((p) => p.slug === SLUG && p.source === "db");
if (!row) {
  console.log("NO DB ROW for slug — nothing to diff (already clean).");
  process.exit(0);
}

// --- 3. Compare (admin list cannot carry AEO fields — compare visible fields) ---
const cmp = [
  ["title", norm(row.title) === norm(codeTitle), row.title, codeTitle],
  ["excerpt", norm(row.excerpt) === norm(codeExcerpt), row.excerpt, codeExcerpt],
  ["content", norm(row.content) === norm(codeContent), null, null],
];
console.log("row id:", row.id, "| updatedAt:", row.updatedAt);
for (const [name, equal, rowVal, codeVal] of cmp) {
  console.log(`${name}: ${equal ? "IDENTICAL" : "DIFFERS"}`);
  if (!equal && rowVal !== null) {
    console.log("  row :", JSON.stringify(rowVal).slice(0, 300));
    console.log("  code:", JSON.stringify(codeVal).slice(0, 300));
  }
}
if (!cmp[2][1]) {
  const rc = norm(row.content), cc = norm(codeContent);
  let i = 0;
  while (i < Math.min(rc.length, cc.length) && rc[i] === cc[i]) i++;
  console.log("content first divergence at", i, ":");
  console.log("  row :", JSON.stringify(rc.slice(Math.max(0, i - 60), i + 120)));
  console.log("  code:", JSON.stringify(cc.slice(Math.max(0, i - 60), i + 120)));
}

const allEqual = cmp.every((c) => c[1]);
console.log(allEqual ? "VERDICT: PURE SNAPSHOT — safe to delete (backup first)." : "VERDICT: OWNER-CUSTOMIZED — do NOT delete; enrichment will restore the AEO mesh.");
writeFileSync(new URL("./task99-verbatim-result.json", import.meta.url), JSON.stringify({ rowId: row.id, allEqual, comparedAt: new Date().toISOString() }, null, 2));
