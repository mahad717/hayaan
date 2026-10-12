#!/usr/bin/env node
// Find product descriptions that mention the free-shipping-over-$75 rule (public API).
import fs from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/scripts/shipping-rule-db-audit.json";

const patterns = [
  /free\s+(?:over|on orders(?: of)?|above)\s*\$?75/i,
  /orders? (?:over|of) \$?75 (?:or more )?(?:ship|are|is|get) free/i,
  /ship(?:s|ping)? free over/i,
  /free (?:shipping|delivery) (?:over|on orders)/i,
  /75 ka badan waa bilaash/i,
  /reach the \$?75/i,
  /free-shipping threshold/i,
  /free-delivery line/i,
];

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
    const matched = patterns.filter((re) => re.test(desc));
    if (matched.length > 0) {
      const snippets = matched.map((re) => {
        const m = desc.match(new RegExp(`.{0,80}(?:${re.source})[^<]{0,80}`, "i"));
        return m ? m[0] : "";
      });
      hits.push({ id: p.id, name: p.name, slug: p.slug, snippets: [...new Set(snippets)].slice(0, 3) });
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ total: products.length, hits }, null, 2));
  console.log(`hits: ${hits.length} (saved to ${OUT})`);
  for (const h of hits) {
    console.log(`\n== ${h.name} (${h.slug})`);
    for (const s of h.snippets) console.log(`   …${s.replace(/\s+/g, " ")}…`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
