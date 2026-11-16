// Task 157: swap badge-bearing image URLs to cleaned -nb versions on live products.
// PRECONDITION: cleaned -nb files deployed (HEAD-check first).
// Auth: POST /api/seed -> POST /api/auth/login (admin@hayaan.demo) -> cookie
// Update: PUT /api/products/<id> { images: [...] } (partial update, same as fix-poison-image.mjs)
import fs from "fs";

const BASE = "https://hayaan.co";
const APPLY = process.env.APPLY === "1";

const audit = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/t157-live-audit.json", "utf8"));
const affected = audit.affected.filter((a) => a.flags.every((f) => f.kind === "repo"));

// old repo url -> new -nb url
function swap(url) {
  const m = url.match(/^(.*\/images\/products\/)(.+)\.(jpg|jpeg|png|webp)$/i);
  if (!m) throw new Error("unrecognized repo url: " + url);
  return `${m[1]}${m[2]}-nb.${m[3]}`;
}

// ---------- login ----------
const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
console.log("[seed]", seedRes.status);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@hayaan.demo", password: "admin123" }),
});
if (!loginRes.ok) { console.error("FATAL: login failed", loginRes.status); process.exit(1); }
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const headers = { "content-type": "application/json", cookie };
console.log("[login] ok, APPLY =", APPLY);

// ---------- HEAD-check new urls ----------
const newUrls = [...new Set(affected.flatMap((a) => a.flags.map((f) => swap(f.url))))];
for (const u of newUrls) {
  const r = await fetch(u, { method: "HEAD" });
  if (r.status !== 200) { console.error("FATAL: new image not live:", u, r.status); process.exit(1); }
}
console.log(`[head] ${newUrls.length}/${newUrls.length} cleaned images live`);

// ---------- apply ----------
const results = [];
for (const a of affected) {
  const cur = await (await fetch(`${BASE}/api/products/${a.id}`)).json();
  const p = cur.product ?? cur;
  const before = p.images ?? [];
  const after = before.map((u) => (u.startsWith(BASE) && u.includes("/images/products/") && !u.includes("-nb.") ? swap(u) : u));
  if (JSON.stringify(before) === JSON.stringify(after)) {
    console.log(`[skip] ${a.slug} (already clean)`);
    results.push({ slug: a.slug, id: a.id, status: "skip" });
    continue;
  }
  if (!APPLY) { console.log(`[dry ] ${a.slug}: ${before[0]} -> ${after[0]}`); continue; }
  const res = await fetch(`${BASE}/api/products/${a.id}`, {
    method: "PUT", headers, body: JSON.stringify({ images: after }),
  });
  const ok = res.ok;
  // verify via public API
  const pub = await (await fetch(`${BASE}/api/products/${a.id}`)).json();
  const pp = pub.product ?? pub;
  const nowImgs = pp.images ?? [];
  const verified = ok && nowImgs.some((u) => u.includes("-nb.")) && !nowImgs.some((u) => audit.repoFlagged.some((f) => u.endsWith("/" + f)));
  console.log(`[${ok && verified ? "PUT OK" : "FAIL"}] ${a.slug}: ${nowImgs[0]}`);
  results.push({ slug: a.slug, id: a.id, status: ok && verified ? "ok" : "fail", images: nowImgs });
}

const fails = results.filter((r) => r.status === "fail");
console.log(`\n[done] APPLY=${APPLY} products=${results.length} fails=${fails.length}`);
fs.writeFileSync("/home/z/my-project/scripts/t157-apply-results.json", JSON.stringify(results, null, 1));
if (fails.length) process.exit(2);
