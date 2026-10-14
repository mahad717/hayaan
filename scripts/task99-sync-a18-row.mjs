// Task 99 — sync the owner's A18 blog DB row to the shipped post content.
//
// Why: the owner re-created this row via the admin editor and synced prices to
// $190 (legit owner action — row NOT deleted). The row matches the shipped
// post except it predates the exact-match "Samsung Galaxy A18" internal
// anchor. This PUT aligns content byte-for-byte with the code post and bumps
// updated_at (fresh dateModified for SEO). AEO fields (quick answer/faqs/
// howto) come from code via withShippedAeo() — no columns exist for them.
//
// Guards: aborts unless the target row's id AND slug match the verified
// values, and unless row content still matches the verified owner state
// (no $187, has $190, no 256GB). Backs up the row first.
// Usage: node scripts/task99-sync-a18-row.mjs          (dry run)
//        COMMIT=1 node scripts/task99-sync-a18-row.mjs (apply)
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const EMAIL = process.env.ADMIN_EMAIL || "admin@hayaan.demo";
const PASS = process.env.ADMIN_PASS || "admin123";
const COMMIT = process.env.COMMIT === "1";
const EXPECTED_ID = "a2f63f2f-c678-49ee-b47c-a066bc1e9b30";
const SLUG = "samsung-galaxy-a18-price-in-somalia";

// --- extract shipped post fields from source ---
const src = readFileSync(new URL("../src/lib/blog-seo-posts.ts", import.meta.url), "utf8");
const start = src.indexOf('slug: "samsung-galaxy-a18-price-in-somalia"');
const seg = src.slice(start, start + 60000);
const title = JSON.parse(`"${seg.match(/title: "((?:[^"\\]|\\.)*)"/)[1]}"`);
const excerpt = JSON.parse(`"${seg.match(/excerpt:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)[1]}"`);
const contentStart = seg.indexOf("content: `");
const content = seg.slice(contentStart + 10, seg.indexOf("`,", contentStart));

// --- auth ---
const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const seedCookie = (seed.headers.get("set-cookie") || "").split(";")[0];
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: seedCookie },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
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
  ["row has $190", (c.match(/\$190/g) || []).length >= 7],
  ["row has no 256GB", !/256GB/i.test(c)],
  ["row lacks the shipped anchor (sync is meaningful)", !c.includes("[Samsung Galaxy A18](https://hayaan.co/product/samsung-galaxy-a18) sells at Hayaan Market")],
  ["row content differs from shipped content", c.trim() !== content.trim()],
];
for (const [name, ok] of guards) {
  console.log(`${ok ? "OK  " : "FAIL"} guard: ${name}`);
  if (!ok && name.startsWith("row lacks")) { /* already synced — exit clean */ console.log("Already synced. Exiting."); process.exit(0); }
  if (!ok) throw new Error("ABORT: guard failed — row state changed, re-verify before writing");
}

writeFileSync(new URL("./task99-a18-row-before-sync.json", import.meta.url), JSON.stringify(row, null, 2));
console.log("backed up row -> scripts/task99-a18-row-before-sync.json");

if (!COMMIT) {
  console.log("DRY RUN — re-run with COMMIT=1 to apply the PUT.");
  process.exit(0);
}

const put = await fetch(`${BASE}/api/admin/blog/${row.id}`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie: authCookie },
  body: JSON.stringify({
    title,
    slug: SLUG,
    excerpt,
    content,
    coverImage: row.coverImage ?? null,
    authorName: row.authorName ?? "Hayaan Team",
    status: "published",
  }),
});
const res = await put.json();
if (!put.ok) throw new Error(`PUT failed: ${JSON.stringify(res)}`);
console.log("PUT ok — updatedAt now:", res.post?.updatedAt);

// --- verify ---
const check = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } });
const after = ((await check.json()).posts ?? []).find((p) => p.slug === SLUG && p.source === "db");
console.log("post-sync content === shipped:", (after?.content || "").trim() === content.trim());
console.log("post-sync title === shipped:", after?.title === title);
