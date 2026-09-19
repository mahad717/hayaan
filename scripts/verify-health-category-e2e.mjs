// Task 68 local E2E: "Health Supplements" category (vitamins).
// Against the dev server (Prisma mode):
//  1. GET /api/categories -> includes health-supplements with name/description.
//  2. Homepage SSR payload -> contains "Health Supplements" (feeds the pills).
//  3. No product is (yet) assigned to the new category (expected empty pill).
//  4. Categories API shape unchanged (id/name/slug/description) so the
//     storefront pills + admin dropdown keep working.
//  5. Somali label wired: built client bundle carries "Caafimaad & Vitamiinada".
import { readFileSync, readdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.log(line);
};

// 1. categories API ----------------------------------------------------------------
const catRes = await fetch(`${BASE}/api/categories`);
const catBody = await catRes.json();
check("GET /api/categories -> 200", catRes.status === 200, `got ${catRes.status}`);
const health = (catBody.categories ?? []).find((c) => c.slug === "health-supplements");
check("health-supplements category present", Boolean(health), JSON.stringify(health ?? null));
check("name is 'Health Supplements'", health?.name === "Health Supplements", health?.name ?? "—");
check("description mentions vitamins", /vitamin/i.test(health?.description ?? ""), health?.description ?? "—");
check(
  "category rows expose id/name/slug/description only",
  (catBody.categories ?? []).every((c) => "id" in c && "name" in c && "slug" in c && "description" in c),
  `${(catBody.categories ?? []).length} rows`,
);

// 2. homepage SSR payload -----------------------------------------------------------
const home = await (await fetch(`${BASE}/`)).text();
check("homepage SSR contains 'Health Supplements'", home.includes("Health Supplements"));
check("homepage SSR contains slug health-supplements", home.includes("health-supplements"));

// 3. no product assigned yet --------------------------------------------------------
const prodBody = await (await fetch(`${BASE}/api/products`)).json();
const prods = prodBody.products ?? prodBody ?? [];
const inHealth = prods.filter((p) => p.categoryId === health?.id);
check("no product assigned to health-supplements yet", inHealth.length === 0, `${inHealth.length} found`);
check("products API unaffected", Array.isArray(prods) && prods.length > 0, `${prods.length} products`);

// 4. Somali label in the built client bundle ---------------------------------------
let soOk = false;
const chunkDirs = [".next/static/chunks", ".open-next/assets/_next/static/chunks"];
for (const dir of chunkDirs) {
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      if (readFileSync(`${dir}/${f}`, "utf8").includes("Caafimaad & Vitamiinada")) { soOk = true; break; }
    }
  } catch {}
  if (soOk) break;
}
check("Somali pill label 'Caafimaad & Vitamiinada' in client bundle", soOk);

const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
