// Task 53: scrape real product images from sanguni.so for the 94 imported
// Hayaan products. Self-contained CDP harness (proven import-verify-cdp.mjs
// pattern) — chrome is spawned here, challenge is passed once, then every
// product page is visited and its main product image is fetched in-page
// (same-origin, cookies included) and returned as base64.
//
// Resumable: skips products whose scripts/product_images/<slug>.jpg already
// exists and looks like an image (JPEG/PNG/WebP magic bytes).
//
// Run: node scripts/scrape_sanguni_images.mjs   (re-run until 0 missing)

import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9338;
const TARGETS = "/home/z/my-project/scripts/image_targets.json";
const OUT_DIR = "/home/z/my-project/scripts/product_images";
const MANIFEST = "/home/z/my-project/scripts/image_manifest.json";
const COOKIES_OUT = "/home/z/my-project/scripts/sanguni-cookies.json";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary"); process.exit(1); }
mkdirSync(OUT_DIR, { recursive: true });

const targets = JSON.parse(readFileSync(TARGETS, "utf8"));
console.log(`[t53] ${targets.length} targets`);

// ---------- chrome ----------
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  "--disable-blink-features=AutomationControlled",
  `--user-agent=${UA}`,
  "--lang=en-US",
  `--user-data-dir=/tmp/chrome-t53-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools never came up"); chrome.kill(); process.exit(1); }
console.error("[t53] chrome up");

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p, to) => sendCmd(ws, m, p, sessionId, to);

await send("Page.enable");
await send("Runtime.enable");
const evalJS = async (expr, timeoutMs) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
// poll until expr truthy (or return value of non-boolean expr is truthy)
async function waitFor(expr, timeoutMs = 30000, interval = 800) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await evalJS(expr); if (v) return v; } catch {}
    await sleep(interval);
  }
  return null;
}

// ---------- pass the anti-bot challenge on the first product page ----------
console.error("[t53] opening first product page (challenge pass)...");
await send("Page.navigate", { url: targets[0].sanguni_url });
const firstOk = await waitFor(
  `document.querySelector('img.wp-post-image') !== null || !!document.querySelector('.woocommerce-product-gallery')`,
  60000, 1000
);
if (!firstOk) {
  const title = await evalJS("document.title").catch(() => "?");
  console.error(`FATAL: challenge never cleared (title=${title})`);
  chrome.kill(); process.exit(1);
}
console.error("[t53] challenge cleared");
// dump cookies for diagnostics
const cookies = await sendCmd(ws, "Storage.getCookies", {}, null, 20000);
writeFileSync(COOKIES_OUT, JSON.stringify(cookies.cookies?.map(c => ({ name: c.name, domain: c.domain, valuePresent: !!c.value })) ?? [], null, 1));
console.error(`[t53] ${cookies.cookies?.length ?? 0} cookies dumped (names only)`);

// ---------- per-product extraction + in-page fetch ----------
const EXTRACT = `(() => {
  const main = document.querySelector('img.wp-post-image');
  const og = document.querySelector('meta[property="og:image"]');
  const gal = [...document.querySelectorAll('.woocommerce-product-gallery img, .woodmart-product-gallery img')]
    .map(i => i.getAttribute('data-large_image') || i.getAttribute('data-src') || i.src)
    .filter(u => u && /wp-content\\/uploads/.test(u));
  const cands = [];
  const push = (u) => { if (u && !cands.includes(u) && /wp-content\\/uploads/.test(u)) cands.push(u); };
  if (main) push(main.getAttribute('data-large_image') || main.getAttribute('data-src') || main.src);
  gal.slice(0, 4).forEach(push);
  if (og) push(og.content);
  return cands;
})()`;

const FETCH_B64 = (u) => `(async () => {
  try {
    const res = await fetch(${JSON.stringify(u)}, { credentials: 'include' });
    if (!res.ok) return { err: 'http ' + res.status };
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return { err: 'ctype ' + ct };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 3000) return { err: 'too small ' + buf.byteLength };
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CH = 32768;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return { b64: btoa(bin), ct };
  } catch (e) { return { err: String(e) }; }
})()`;

const looksImage = (p) => {
  if (!existsSync(p)) return false;
  try {
    const b = readFileSync(p);
    return b.length > 3000 && (
      (b[0] === 0xff && b[1] === 0xd8) ||
      (b[0] === 0x89 && b[1] === 0x50) ||
      (b[0] === 0x52 && b[1] === 0x49 && b.subarray(8, 12).toString() === "WEBP")
    );
  } catch { return false; }
};

const manifest = [];
let done = 0, failed = 0;
for (const t of targets) {
  const slug = t.slug;
  const file = `${OUT_DIR}/${slug}.jpg`;
  done++;
  if (looksImage(file)) {
    manifest.push({ ...t, file, source_url: "(cached)", bytes: 0, ok: true });
    continue;
  }
  let got = null;
  for (let attempt = 0; attempt < 2 && !got; attempt++) {
    try {
      await send("Page.navigate", { url: t.sanguni_url }, 30000);
      const ready = await waitFor(
        `document.querySelector('img.wp-post-image') !== null || document.title.indexOf('One moment') === -1 && document.readyState === 'complete'`,
        25000, 700
      );
      const cands = await evalJS(EXTRACT);
      if (!cands || !cands.length) { await sleep(1500); continue; }
      for (const u of cands) {
        const r = await evalJS(FETCH_B64(u), 90000);
        if (r && r.b64) {
          writeFileSync(file, Buffer.from(r.b64, "base64"));
          got = { source_url: u, ct: r.ct };
          break;
        }
      }
    } catch (e) {
      console.error(`  [warn] ${slug}: ${String(e).slice(0, 120)}`);
      await sleep(2500);
    }
  }
  if (got) {
    const bytes = (await import("node:fs")).statSync(file).size;
    manifest.push({ ...t, file, source_url: got.source_url, bytes, ok: true });
    console.log(`[t53] ${done}/${targets.length} OK ${slug} ${(bytes / 1024).toFixed(0)}KB ${got.source_url.split("/").pop()}`);
  } else {
    failed++;
    manifest.push({ ...t, file: null, source_url: null, bytes: 0, ok: false });
    console.log(`[t53] ${done}/${targets.length} FAIL ${slug}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  await sleep(1200 + Math.floor(Math.random() * 800));
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`[t53] DONE ok=${manifest.filter(m => m.ok).length} fail=${failed}`);
chrome.kill();
process.exit(0);
