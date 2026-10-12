#!/usr/bin/env node
// Task 97 — remove the "Free delivery nationwide on orders over $75" boilerplate
// from product descriptions in Supabase (via the site's admin API).
// Step 1: back up the affected rows. Step 2 (COMMIT=1): PUT updated descriptions.
import fs from "node:fs";

const BASE = "https://hayaan.co";
const BACKUP = "/home/z/my-project/scripts/task97-desc-backup.json";
const COMMIT = process.env.COMMIT === "1";

const OLD_SENTENCE =
  "Free delivery nationwide on orders over $75; Mogadishu districts from $1.50.";
const NEW_SENTENCE =
  "Delivery is $1.50\u2013$3.00 by Mogadishu district and a flat $6.95 nationwide.";

async function main() {
  // fetch all products (public read includes description)
  const res = await fetch(`${BASE}/api/products?limit=500`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`products fetch failed: ${res.status}`);
  const data = await res.json();
  const products = data.products ?? data;

  const hits = products.filter((p) => String(p.description ?? "").includes(OLD_SENTENCE));
  console.log(`products with the boilerplate: ${hits.length}`);

  // backup full rows (only fields we may touch + identifiers)
  const backup = hits.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description }));
  fs.writeFileSync(BACKUP, JSON.stringify({ savedAt: new Date().toISOString(), rows: backup }, null, 2));
  console.log(`backup written: ${BACKUP}`);

  if (!COMMIT) {
    console.log("DRY RUN — re-run with COMMIT=1 to apply updates.");
    return;
  }

  // login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
    signal: AbortSignal.timeout(30000),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];

  let ok = 0, fail = 0;
  for (const p of hits) {
    const desc = String(p.description);
    if (!desc.includes(OLD_SENTENCE)) {
      console.log(`SKIP (sentence gone?): ${p.slug}`);
      continue;
    }
    const updated = desc.replace(OLD_SENTENCE, NEW_SENTENCE);
    const put = await fetch(`${BASE}/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ description: updated }),
      signal: AbortSignal.timeout(30000),
    });
    if (put.ok) {
      ok++;
    } else {
      fail++;
      console.log(`FAIL ${p.slug}: ${put.status} ${await put.text().then((t) => t.slice(0, 120))}`);
    }
  }
  console.log(`done: ${ok} updated, ${fail} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
