// Task 98 phase 3: delete the two verbatim admin-panel snapshot rows that
// shadow code-shipped SEO guides. Proven verbatim in phase 2 (backups in
// scripts/task98-a18-dbrow-backup.json and scripts/task98-hiw-dbrow-backup.json):
//   - samsung-galaxy-a18-price-in-somalia (saved 2026-10-12T18:22Z, byte-equal
//     to the post-Task-97 shipped guide; blocks the owner-mandated 128GB
//     revision and strips FAQPage/HowTo/quickAnswer)
//   - online-shopping-in-somalia-how-it-works (saved 2026-10-05, byte-equal to
//     the PRE-Task-97 guide; still served "free shipping over $75" 14x live)
// Guards: re-fetch each row immediately before DELETE and abort on slug/status
// mismatch. The third DB row (sida-loo-doorto-laptop-ka-kugu-habboon) is
// owner-authored and is NEVER touched.
// Run: node scripts/task98-delete-shadow-rows.mjs

const BASE = "https://hayaan.co";
const TARGETS = [
  { slug: "samsung-galaxy-a18-price-in-somalia", id: "4979f669-afe8-45a6-98bb-11fbb73248c0" },
  { slug: "online-shopping-in-somalia-how-it-works", id: "3856a888-951a-47f8-8713-ccc4a150b176" },
];

const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
console.log("[login] ok");
const headers = { "content-type": "application/json", cookie };

for (const t of TARGETS) {
  const list = (await (await fetch(`${BASE}/api/admin/blog`, { headers })).json()).posts;
  const row = list.find((p) => p.id === t.id);
  if (!row) { console.log(`[skip] id ${t.id} not present (already deleted?)`); continue; }
  if (row.slug !== t.slug) { console.error(`ABORT: id ${t.id} now holds slug "${row.slug}" — expected "${t.slug}"`); process.exit(1); }
  if (row.source !== "db") { console.log(`[skip] ${t.slug} is source=${row.source}, nothing to delete`); continue; }

  const del = await fetch(`${BASE}/api/admin/blog/${t.id}`, { method: "DELETE", headers });
  const body = await del.text();
  console.log(`[delete] ${t.slug} -> HTTP ${del.status} ${body.slice(0, 80)}`);
  if (!del.ok) process.exit(1);
}

// ---------- re-audit ----------
const list2 = (await (await fetch(`${BASE}/api/admin/blog`, { headers })).json()).posts;
const dbLeft = list2.filter((p) => p.source === "db");
console.log("\n== DB rows remaining ==");
for (const p of dbLeft) console.log(`- ${p.slug} | ${p.status}`);
const a18 = list2.find((p) => p.slug === "samsung-galaxy-a18-price-in-somalia");
const hiw = list2.find((p) => p.slug === "online-shopping-in-somalia-how-it-works");
console.log("A18 now source:", a18?.source, "| how-it-works now source:", hiw?.source);
console.log(dbLeft.length === 1 && dbLeft[0].slug === "sida-loo-doorto-laptop-ka-kugu-habboon" && a18?.source === "shipped" && hiw?.source === "shipped"
  ? "RE-AUDIT PASS: only the owner-authored Somali post remains in DB; both guides serve from code."
  : "RE-AUDIT UNEXPECTED — inspect above.");
