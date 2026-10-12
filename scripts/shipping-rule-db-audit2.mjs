#!/usr/bin/env node
// Broad re-audit: any "free ... $75" co-occurrence inside product descriptions.
import fs from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/scripts/shipping-rule-db-audit2.json";

async function main() {
  const res = await fetch(`${BASE}/api/products?limit=500`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`products fetch failed: ${res.status}`);
  const data = await res.json();
  const products = data.products ?? data;
  console.log(`fetched ${products.length} products`);

  const hits = [];
  for (const p of products) {
    const desc = String(p.description ?? "");
    if (!desc) continue;
    const text = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const found = text.match(/[^.]{0,90}[Ff]ree[^.]{0,90}?\$?75[^.]{0,60}\.|[^.]{0,60}\$?75[^.]{0,60}free[^.]{0,60}\./g);
    if (found) hits.push({ id: p.id, name: p.name, slug: p.slug, found: found.map((s) => s.trim()).slice(0, 3) });
  }
  fs.writeFileSync(OUT, JSON.stringify({ total: products.length, hits }, null, 2));
  console.log(`hits: ${hits.length} (saved to ${OUT})`);
  for (const h of hits) {
    console.log(`\n== ${h.name} (${h.slug})  id=${h.id}`);
    for (const s of h.found) console.log(`   "${s}"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
