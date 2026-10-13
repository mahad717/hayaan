// Task 98 phase 2: diff the two DB-shadowed blog rows against the PRE-Task-97
// code (git blob 5f63461:src/lib/blog-seo-posts.ts). If a row's content is
// byte-equivalent (modulo whitespace/escaping) to the old code's post content,
// it is a stale admin-panel snapshot — safe to delete so the richer, updated
// shipped guide serves again. Any diff beyond whitespace = owner customization
// -> do NOT delete; merge the shipping/storage fixes into the row instead.
// Run: node scripts/task98-verify-verbatim.mjs

import { readFileSync, writeFileSync } from "node:fs";

const OLD_SRC = readFileSync("/tmp/task98-pre97-posts.ts", "utf8");
const a18Row = JSON.parse(readFileSync("/home/z/my-project/scripts/task98-a18-dbrow-backup.json", "utf8")).row;

// ---------- fetch + back up the how-it-works row ----------
const BASE = "https://hayaan.co";
const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const posts = (await (await fetch(`${BASE}/api/admin/blog`, { headers: { "content-type": "application/json", cookie } })).json()).posts;
const hiwRow = posts.find((p) => p.slug === "online-shopping-in-somalia-how-it-works");
if (!hiwRow || hiwRow.source !== "db") { console.error("FATAL: how-it-works DB row not found", hiwRow?.source); process.exit(1); }
writeFileSync("/home/z/my-project/scripts/task98-hiw-dbrow-backup.json", JSON.stringify({ backedUpAt: new Date().toISOString(), row: hiwRow }, null, 1));
console.log("[backup] how-it-works DB row -> scripts/task98-hiw-dbrow-backup.json");

// ---------- extract a post's `content` template literal from the old TS ----------
function extractOldContent(slug) {
  const i = OLD_SRC.indexOf(`slug: "${slug}"`);
  if (i < 0) return null;
  const cStart = OLD_SRC.indexOf("content: `", i);
  if (cStart < 0) return null;
  const bodyStart = cStart + "content: `".length;
  const bodyEnd = OLD_SRC.indexOf("`,", bodyStart);
  if (bodyEnd < 0) return null;
  return OLD_SRC.slice(bodyStart, bodyEnd);
}

const norm = (s) => (s ?? "")
  .replace(/\r\n/g, "\n")
  .replace(/\\"/g, '"')
  .replace(/\\n/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{2,}/g, "\n")
  .trim();

function diffReport(label, rowContent, oldContent) {
  const a = norm(rowContent), b = norm(oldContent ?? "");
  const eq = a === b;
  console.log(`\n== ${label} ==`);
  console.log("row length:", rowContent?.length, "| old-code length:", oldContent?.length, "| normalized equal:", eq);
  if (!eq) {
    // locate first divergence for eyeballing
    let k = 0; while (k < Math.min(a.length, b.length) && a[k] === b[k]) k++;
    console.log("first divergence at", k);
    console.log("  row :", JSON.stringify(a.slice(Math.max(0, k - 60), k + 90)));
    console.log("  code:", JSON.stringify(b.slice(Math.max(0, k - 60), k + 90)));
    const rowHas75 = /\$75/.test(rowContent ?? "");
    const oldHas75 = /\$75/.test(oldContent ?? "");
    console.log("  row has $75:", rowHas75, "| old code has $75:", oldHas75);
  }
  return eq;
}

const a18Eq = diffReport("A18 row vs PRE-Task-97 code post16", a18Row.content, extractOldContent("samsung-galaxy-a18-price-in-somalia"));
const hiwEq = diffReport("how-it-works row vs PRE-Task-97 code post5", hiwRow.content, extractOldContent("online-shopping-in-somalia-how-it-works"));

console.log("\nSUMMARY:");
console.log("  A18 row verbatim-old:", a18Eq);
console.log("  how-it-works row verbatim-old:", hiwEq);
console.log(a18Eq ? "  A18 -> DELETE row (code serves 128GB + FAQ/HowTo/quickAnswer)" : "  A18 -> UPDATE row instead");
console.log(hiwEq ? "  how-it-works -> DELETE row (code serves Task-97 fee text + AEO)" : "  how-it-works -> UPDATE row instead");
