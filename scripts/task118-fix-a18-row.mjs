// Task 118 fix-up: restore the A18 DB row to its correct slug/published state
// (my first sync PUT omitted {slug, status} — the admin route re-derived the
// slug from the title and set the row to draft).
// Usage: node scripts/task118-fix-a18-row.mjs          (dry run)
//        COMMIT=1 node scripts/task118-fix-a18-row.mjs (apply)
import { readFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const COMMIT = process.env.COMMIT === "1";
const ROW_ID = "a2f63f2f-c678-49ee-b47c-a066bc1e9b30";
const SLUG = "samsung-galaxy-a18-price-in-somalia";

const src = readFileSync(new URL("../src/lib/blog-seo-posts.ts", import.meta.url), "utf8");
const start = src.indexOf('slug: "samsung-galaxy-a18-price-in-somalia"');
const seg = src.slice(start, start + 60000);
const title = JSON.parse(`"${seg.match(/title: "((?:[^"\\]|\\.)*)"/)[1]}"`);
const excerpt = JSON.parse(`"${seg.match(/excerpt:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)[1]}"`);
const contentStart = seg.indexOf("content: `");
const content = seg.slice(contentStart + 10, seg.indexOf("`,", contentStart));

const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const seedCookie = (seed.headers.get("set-cookie") || "").split(";")[0];
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json", cookie: seedCookie },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
const authCookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
if (!authCookie) throw new Error("login failed");

const list = await (await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } })).json();
const posts = list.posts ?? [];
const row = posts.find((p) => p.id === ROW_ID);
if (!row) throw new Error("ABORT: row a2f63f2f not found");
console.log("[state]", row.slug, "| status:", row.status, "| $145 x", (row.content.match(/\$145/g) ?? []).length);
if (row.status !== "draft" && row.slug === SLUG) {
  console.log("Already correct. Nothing to do.");
  process.exit(0);
}
const shippedOnSlug = posts.find((p) => p.slug === SLUG && p.source === "shipped");
console.log("[check] code post occupies the old slug (expected until we move the row):", !!shippedOnSlug);

if (!COMMIT) { console.log("DRY RUN"); process.exit(0); }

const put = await fetch(`${BASE}/api/admin/blog/${ROW_ID}`, {
  method: "PUT", headers: { "content-type": "application/json", cookie: authCookie },
  body: JSON.stringify({
    title, slug: SLUG, excerpt, content,
    coverImage: row.coverImage ?? null,
    authorName: row.authorName ?? "Hayaan Team",
    status: "published",
  }),
});
if (!put.ok) throw new Error(`PUT failed ${put.status}: ${(await put.text()).slice(0, 200)}`);

const after = (await (await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } })).json()).posts ?? [];
const fixed = after.find((p) => p.id === ROW_ID);
const a18rows = after.filter((p) => p.slug === SLUG && p.source === "db");
const ok = fixed?.slug === SLUG && fixed?.status === "published"
  && (fixed.content.match(/\$145/g) ?? []).length >= 3 && a18rows.length === 1;
console.log(`[verify] slug=${fixed?.slug} status=${fixed?.status} $145x${(fixed?.content.match(/\$145/g) ?? []).length} db-rows-on-slug=${a18rows.length}`);
console.log(ok ? "FIXED" : "STILL WRONG");
process.exit(ok ? 0 : 1);
