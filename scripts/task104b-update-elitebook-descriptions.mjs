// Task 104b — update the stored EN descriptions of the 4 EliteBook listings
// so they state the refurbished condition explicitly (names were renamed in
// task104-rename-elitebooks.mjs). Keeps each row's existing template shape,
// injects "Refurbished " before the name + one explanatory sentence.
// Note: the SO exact-match templates already fail on these rows (they say
// "EVC Plus, Edahab" while the dictionary templates say "Sifalo"), so this
// change causes no Somali-translation regression — SO falls back to stored
// EN for these rows before AND after.
import fs from "fs";

const BASE = "https://hayaan.co";
const ADMIN_EMAIL = "admin@hayaan.demo";
const ADMIN_PASSWORD = "admin123";
const BACKUP_BEFORE = "/home/z/my-project/scripts/task104-backup-elitebook-names.json"; // pre-rename backup (names + descriptions)
const BACKUP_AFTER = "/home/z/my-project/scripts/task104-backup-elitebook-descriptions.json";

const UPDATES = {
  "hp-elitebook-840-g9-intel-core-i7-12gen":
    "<p>Refurbished HP EliteBook 840 G9 Intel Core i7-12Gen — serious performance for work, study and play, from Hayaan Market. Sold as a refurbished unit: a pre-owned business laptop restored to full working order and priced far below new. Order today for fast delivery across Somalia with card or EVC Plus, Edahab payment methods.</p>",
  "hp-elitebook-830-g8-intel-core-i7-11gen":
    "<p>Big-screen and big-power picks like the Refurbished HP EliteBook 830 G8 Intel Core i7-11Gen move fast. Get yours now at Hayaan Market — a refurbished business laptop restored to full working order and priced far below new. Nationwide delivery, card or EVC Plus, Edahab payment methods.</p>",
  "hp-elitebook-830-g7-intel-core-i7-10gen":
    "<p>Refurbished HP EliteBook 830 G7 Intel Core i7-10Gen — serious performance for work, study and play, from Hayaan Market. Sold as a refurbished unit: a pre-owned business laptop restored to full working order and priced far below new. Order today for fast delivery across Somalia with card or EVC Plus, Edahab payment methods.</p>",
  "hp-elitebook-840-g7-notebook":
    "<p>Big-screen and big-power picks like the Refurbished HP EliteBook 840 G7 Notebook move fast. Get yours now at Hayaan Market — a refurbished business laptop restored to full working order and priced far below new. Nationwide delivery, card or EVC Plus, Edahab payment.</p>",
};

const once = async (url, opts = {}) => {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(url, { ...opts, redirect: "manual" });
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
};

// --- login ---
const loginRes = await once(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
if (!loginRes.ok) throw new Error(`login failed (${loginRes.status})`);
const sc = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
const cookie = sc.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
console.log("app session OK");

// --- fetch current rows, backup ---
const list = await (await once(`${BASE}/api/admin/products`, { headers: { Cookie: cookie } })).json();
const all = list.products ?? [];
const rows = all.filter((p) => Object.keys(UPDATES).includes(p.slug));
if (rows.length !== 4) throw new Error(`expected 4 rows, found ${rows.length}`);
fs.writeFileSync(BACKUP_AFTER, JSON.stringify(rows.map(({ id, name, slug, description }) => ({ id, name, slug, description })), null, 2));
console.log("post-rename backup written:", BACKUP_AFTER);
for (const r of rows) console.log(`  BEFORE  ${r.slug}  |  name=${r.name}  |  desc=${String(r.description).slice(0, 60)}...`);

// sanity: names must already be Refurbished (task104 ran first)
if (!rows.every((r) => String(r.name).startsWith("Refurbished "))) throw new Error("names not renamed yet — run task104 first");

// --- PUT description per row ---
for (const r of rows) {
  const put = await once(`${BASE}/api/products/${r.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ description: UPDATES[r.slug] }),
  });
  const body = await put.json().catch(() => null);
  if (!put.ok) throw new Error(`PUT failed for ${r.slug} (${put.status}): ${JSON.stringify(body).slice(0, 200)}`);
  const d = String(body?.product?.description ?? "");
  console.log(`  AFTER   ${r.slug}  |  desc has Refurbished=${d.includes("Refurbished")}  |  ${d.slice(0, 70)}...`);
}

// --- verify ---
const list2 = await (await once(`${BASE}/api/admin/products`, { headers: { Cookie: cookie } })).json();
const after = (list2.products ?? []).filter((p) => Object.keys(UPDATES).includes(p.slug));
const ok = after.length === 4 && after.every((r) => String(r.description).includes("Refurbished") && String(r.description).includes("refurbished"));
console.log(`VERIFY: all 4 descriptions updated = ${ok}`);
if (!ok) process.exit(1);
console.log("DONE — pre-change names+descriptions are in", BACKUP_BEFORE);
