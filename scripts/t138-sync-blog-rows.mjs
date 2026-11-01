// Task 138 — re-sync DB blog rows to the freshly patched shipped posts.
// Same protocol as Task 99/118: rows are owner-derived (kept, not deleted);
// this PUT aligns content byte-for-byte with the current code post and bumps
// updated_at (fresh dateModified). AEO fields (quickAnswer/faqs/howtoSteps)
// always come from code via withShippedAeo(), so only title/excerpt/content
// need the sync. Patched posts this round:
//   • how-to-buy-phones-online-in-somalia  (tier list: A17 family $170–$240,
//     A37 $320→$330, tier-2 renamed $170–$450)
//   • samsung-galaxy-a18-price-in-somalia  (ladder $145–$240, A17 — $170 with
//     3 variants, A56 $370→$375, bottom line "A17 family from $170")
// Usage: node scripts/t138-sync-blog-rows.mjs          (dry run)
//        COMMIT=1 node scripts/t138-sync-blog-rows.mjs (apply)
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const COMMIT = process.env.COMMIT === "1";

const POSTS = [
  {
    slug: "how-to-buy-phones-online-in-somalia",
    stale: ["and the Galaxy A17 at $165", "Galaxy A37 5G at $320", "$180–$450"],
    fresh: ["family from $170 (4GB/128GB) up to the 8GB/256GB at $240", "Galaxy A37 5G at $330", "$170–$450"],
  },
  {
    slug: "samsung-galaxy-a18-price-in-somalia",
    stale: ["The $145–$190 ladder", "Galaxy A17 — $165", "Galaxy A56 5G at $370", "A17 at $165"],
    fresh: ["The $145–$240 ladder", "Galaxy A17 — $170", "Galaxy A56 5G at $375", "A17 family from $170"],
  },
];

// --- extract shipped post fields from source (current, Task-138-patched) ---
const src = readFileSync(new URL("../src/lib/blog-seo-posts.ts", import.meta.url), "utf8");
const shipped = POSTS.map((p) => {
  const start = src.indexOf(`slug: "${p.slug}"`);
  if (start < 0) throw new Error(`ABORT: slug ${p.slug} not in source`);
  const seg = src.slice(start, start + 60000);
  const title = JSON.parse(`"${seg.match(/title: "((?:[^"\\]|\\.)*)"/)[1]}"`);
  const excerpt = JSON.parse(`"${seg.match(/excerpt:\s*\n?\s*"((?:[^"\\]|\\.)*)"/)[1]}"`);
  const contentStart = seg.indexOf("content: `");
  const content = seg.slice(contentStart + 10, seg.indexOf("`,", contentStart));
  for (const f of p.fresh) {
    if (!content.includes(f)) throw new Error(`ABORT: shipped ${p.slug} missing fresh marker: ${f}`);
  }
  for (const f of p.stale) {
    if (content.includes(f)) throw new Error(`ABORT: shipped ${p.slug} still carries stale marker: ${f}`);
  }
  return { ...p, title, excerpt, content };
});
console.log("[source] all shipped posts carry the Task 138 markers, none carry the stale ones");

// --- auth ---
const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const seedCookie = (seed.headers.get("set-cookie") || "").split(";")[0];
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json", cookie: seedCookie },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
const authCookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
if (!authCookie) throw new Error("login failed");

const list = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } });
const posts = (await list.json()).posts ?? [];
console.log("[blog] admin rows:", posts.length);

let failures = 0;
const backup = {};
for (const p of shipped) {
  const row = posts.find((x) => x.slug === p.slug && x.source === "db");
  if (!row) {
    console.log(`[${p.slug}] no DB shadow row — page serves the code post directly, nothing to sync`);
    continue;
  }
  const c = row.content || "";
  const staleHits = p.stale.filter((s) => c.includes(s));
  if (c.trim() === p.content.trim()) {
    console.log(`[${p.slug}] already synced (byte-identical)`);
    continue;
  }
  if (staleHits.length === 0) {
    console.error(`[${p.slug}] ABORT: row differs from shipped but carries NONE of the expected stale markers — state unknown`);
    failures++;
    continue;
  }
  console.log(`[${p.slug}] row is stale — stale markers present: ${staleHits.length}/${p.stale.length}`);
  backup[p.slug] = row;
  writeFileSync(new URL("./t138-blog-rows-before-sync.json", import.meta.url), JSON.stringify(backup, null, 2));

  if (!COMMIT) {
    console.log(`[${p.slug}] DRY RUN — would PUT title/excerpt/content`);
    continue;
  }
  const put = await fetch(`${BASE}/api/admin/blog/${row.id}`, {
    method: "PUT", headers: { "content-type": "application/json", cookie: authCookie },
    body: JSON.stringify({ title: p.title, excerpt: p.excerpt, content: p.content }),
  });
  if (!put.ok) {
    console.error(`[${p.slug}] PUT failed ${put.status}: ${(await put.text()).slice(0, 200)}`);
    failures++;
    continue;
  }
  const after = (await (await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } })).json()).posts ?? [];
  const row2 = after.find((x) => x.id === row.id);
  const ok = row2 && row2.content?.trim() === p.content.trim() && p.fresh.every((f) => row2.content.includes(f));
  console.log(`[${p.slug}] sync ${ok ? "OK — row byte-identical, fresh markers present" : "MISMATCH after PUT"}`);
  if (!ok) failures++;
}
console.log(`\n[done] COMMIT=${COMMIT} failures=${failures}`);
process.exit(failures ? 1 : 0);
