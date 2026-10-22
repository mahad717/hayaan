// Task 118 — re-sync the owner's A18 blog DB row to the freshly price-synced
// shipped post (A16 $118 -> $145 in the ladder/FAQ/bottom line).
// Same protocol as Task 99: the row is owner-derived (kept, not deleted); this
// PUT aligns content byte-for-byte with the current code post and bumps
// updated_at (fresh dateModified). AEO fields come from code via withShippedAeo().
// Usage: node scripts/task118-sync-a18-row.mjs          (dry run)
//        COMMIT=1 node scripts/task118-sync-a18-row.mjs (apply)
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const COMMIT = process.env.COMMIT === "1";
const EXPECTED_ID = "a2f63f2f-c678-49ee-b47c-a066bc1e9b30";
const SLUG = "samsung-galaxy-a18-price-in-somalia";

// --- extract shipped post fields from source (current, Task-118-patched) ---
const src = readFileSync(new URL("../src/lib/blog-seo-posts.ts", import.meta.url), "utf8");
const start = src.indexOf('slug: "samsung-galaxy-a18-price-in-somalia"');
const seg = src.slice(start, start + 60000);
const title = JSON.parse(`"${seg.match(/title: "((?:[^"\\]|\\.)*)"/)[1]}"`);
const excerpt = JSON.parse(`"${seg.match(/excerpt:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)[1]}"`);
const contentStart = seg.indexOf("content: `");
const content = seg.slice(contentStart + 10, seg.indexOf("`,", contentStart));
if (!content.includes("$145") || content.includes("A16 — $118")) {
  throw new Error("ABORT: shipped post does not carry the Task 118 edits — check the patch");
}

// --- auth ---
const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const seedCookie = (seed.headers.get("set-cookie") || "").split(";")[0];
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json", cookie: seedCookie },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
const authCookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
if (!authCookie) throw new Error("login failed");

// --- fetch + guards ---
const list = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } });
const posts = (await list.json()).posts ?? [];
const row = posts.find((p) => p.slug === SLUG && p.source === "db");
if (!row) throw new Error("ABORT: no DB row for slug (nothing to sync)");
if (row.id !== EXPECTED_ID) throw new Error(`ABORT: unexpected row id ${row.id}`);

const c = row.content || "";
const guards = [
  ["row has no $187", !/\$187/.test(c)],
  ["row has $190 x7", (c.match(/\$190/g) || []).length === 7],
  ["row has no 256GB", !/256GB/i.test(c)],
  ["row has the Task 99 anchor", c.includes("[Samsung Galaxy A18](https://hayaan.co/product/samsung-galaxy-a18) sells at Hayaan Market")],
  ["row still carries pre-118 A16 $118 x3", (c.match(/\$118/g) || []).length === 3],
  ["row has no $145 yet", !c.includes("$145")],
  ["row content differs from shipped content", c.trim() !== content.trim()],
];
for (const [name, ok] of guards) {
  console.log(`${ok ? "OK  " : "FAIL"} guard: ${name}`);
  if (!ok) {
    if (name.startsWith("row still carries") === false && name.includes("differs")) {
      console.log("Already synced. Exiting.");
      process.exit(0);
    }
    throw new Error("ABORT: guard failed — row state changed, re-verify before writing");
  }
}

writeFileSync(new URL("./task118-a18-row-before-sync.json", import.meta.url), JSON.stringify(row, null, 2));
console.log("backed up row -> scripts/task118-a18-row-before-sync.json");

if (!COMMIT) {
  console.log("DRY RUN — re-run with COMMIT=1 to apply the PUT.");
  process.exit(0);
}

const put = await fetch(`${BASE}/api/admin/blog/${row.id}`, {
  method: "PUT", headers: { "content-type": "application/json", cookie: authCookie },
  body: JSON.stringify({ title, excerpt, content }),
});
if (!put.ok) throw new Error(`PUT failed ${put.status}: ${(await put.text()).slice(0, 200)}`);
const after = await (await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } })).json();
const row2 = (after.posts ?? []).find((p) => p.id === row.id);
const okSync = row2 && row2.content?.trim() === content.trim() && (row2.content.match(/\$145/g) || []).length >= 3;
console.log(`[sync] ${okSync ? "OK — row now byte-identical to shipped post, $145 present" : "MISMATCH after PUT"}`);
process.exit(okSync ? 0 : 1);
