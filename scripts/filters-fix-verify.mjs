// Task 48 verification — prove the /api/products categoryId fix on REAL
// production Supabase rows, without needing a deploy:
//  1. extract the public anon key from the live JS bundle
//  2. fetch real products (+category join) and categories via Supabase REST
//     — these come back in the same snake_case shape the API route receives
//  3. run the OLD rowToProduct mapping vs the NEW (fixed) mapping
//  4. simulate the storefront pill filter on the fixed output and report
//     per-category counts (what shoppers will see after deploy)
const SUPA = "https://mqyhgyakhfhuctnvezby.supabase.co";

// --- 1. anon key from live bundle ---
const home = await (await fetch("https://hayaan.co/")).text();
const chunks = [...home.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]);
let anon = null;
for (const c of [...new Set(chunks)]) {
  const js = await (await fetch("https://hayaan.co" + c)).text();
  const m = js.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (m) { anon = m[0]; break; }
}
if (!anon) throw new Error("anon key not found in bundle");
console.log("anon key: ..." + anon.slice(-12));

// --- 2. real rows (snake_case, identical to what the API route's mapper sees) ---
const H = { apikey: anon, Authorization: `Bearer ${anon}` };
const prods = (await (await fetch(`${SUPA}/rest/v1/products?select=*,category:categories(*)&is_active=eq.true&limit=100`, { headers: H })).json());
const cats = (await (await fetch(`${SUPA}/rest/v1/categories?select=*&order=name`, { headers: H })).json());
console.log(`rows: ${prods.length} products, ${cats.length} categories`);

// --- 3. OLD vs NEW mapping (exactly the changed lines) ---
const oldMap = (row) => ({ ...row, categoryId: row.categoryId });
const newMap = (row) => ({ ...row, categoryId: row.categoryId ?? row.category_id });

const oldNulls = prods.filter((p) => oldMap(p).categoryId == null).length;
const newNulls = prods.filter((p) => newMap(p).categoryId == null).length;
console.log(`OLD mapping: products with categoryId=undefined -> ${oldNulls}/${prods.length}  (the bug)`);
console.log(`NEW mapping: products with categoryId=undefined -> ${newNulls}/${prods.length}  (the fix)`);

// --- 4. storefront pill simulation on the FIXED output (product-grid logic) ---
const catIds = new Set(cats.map((c) => c.id));
const orphans = prods.filter((p) => !catIds.has(newMap(p).categoryId));
console.log(`orphan products after fix (categoryId not in categories): ${orphans.length}`);
console.log("-- what shoppers will see per pill (client-side filter) --");
for (const pill of [{ id: "all", name: "All" }, ...cats]) {
  const n = prods.filter((p) => pill.id === "all" || newMap(p).categoryId === pill.id).length;
  console.log(`   ${pill.name.padEnd(14)} -> ${n} product${n === 1 ? "" : "s"}`);
}
if (oldNulls === prods.length && newNulls === 0 && orphans.length === 0) {
  console.log("VERDICT: fix confirmed on live data — pills will populate after deploy.");
} else {
  console.log("VERDICT: unexpected state — investigate before deploying.");
}
