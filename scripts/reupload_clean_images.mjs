// Task 54: replace the 18 logo-bearing product images with cleaned versions.
// Same pattern as apply_images.mjs: login -> upload clean file -> PUT images.
// Run: node scripts/reupload_clean_images.mjs

import { readFileSync, writeFileSync, statSync } from "node:fs";

const BASE = "https://hayaan.co";
const ADMIN_EMAIL = "gabeyre80@gmail.com";
const ADMIN_PASSWORD = "0AgJ(b1|@N52";
const DETECT = "/home/z/my-project/scripts/logo-detection.json";
const MANIFEST = "/home/z/my-project/scripts/image_manifest.json";
const CLEAN_DIR = "/home/z/my-project/scripts/product_images_clean";
const RESULT = "/home/z/my-project/scripts/reupload-results.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const flat = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!res.ok || !flat.includes("shop_session")) throw new Error(`login failed: ${res.status}`);
  return flat;
}

const cleaned = JSON.parse(readFileSync(DETECT, "utf8")).filter((r) => r.status === "cleaned");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const nameBySlug = new Map(manifest.map((m) => [m.slug, m.name]));

const cookie = await login();
const res = await fetch(`${BASE}/api/admin/products`, { headers: { cookie } });
const data = await res.json();
const products = Array.isArray(data) ? data : (data.products ?? data.data ?? []);
const byName = new Map(products.map((p) => [p.name, p]));
console.log(`[reup] ${cleaned.length} cleaned images, ${products.length} live products`);

const results = [];
let ok = 0, fail = 0;
for (const c of cleaned) {
  const name = nameBySlug.get(c.slug);
  const p = name && byName.get(name);
  const file = `${CLEAN_DIR}/${c.slug}.jpg`;
  if (!p) { fail++; results.push({ slug: c.slug, status: "product-not-found" }); continue; }
  if (!statSync(file).size) { fail++; results.push({ slug: c.slug, status: "file-missing" }); continue; }
  try {
    const buf = readFileSync(file);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "image/jpeg" }), `${c.slug}.jpg`);
    const up = await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
    const ud = await up.json().catch(() => ({}));
    if (!up.ok || !ud.url) throw new Error(`upload ${up.status} ${JSON.stringify(ud).slice(0, 80)}`);
    const put = await fetch(`${BASE}/api/products/${p.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ images: [ud.url] }),
    });
    if (!put.ok) throw new Error(`put ${put.status}`);
    ok++;
    results.push({ slug: c.slug, name, productId: p.id, liveUrl: ud.url, status: "updated" });
    console.log(`[reup] ${ok} OK ${c.slug}`);
  } catch (e) {
    fail++;
    results.push({ slug: c.slug, name, status: "failed", error: String(e).slice(0, 120) });
    console.error(`[reup] FAIL ${c.slug}: ${String(e).slice(0, 120)}`);
  }
  await sleep(250);
}
writeFileSync(RESULT, JSON.stringify(results, null, 1));
console.log(`[reup] DONE ok=${ok} fail=${fail}`);
