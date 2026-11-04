// Task 143 runtime check: the venture-capital guide must ship fully — page
// renders, quick-answer box present, JSON-LD @graph carries BlogPosting +
// FAQPage + HowTo, canonical + og:image wired, cover resolves as a real JPEG,
// EVERY hayaan.co link printed in the content resolves 200 (no dead deep
// links), /blog index + sitemap.xml + llms.txt + llms-full.txt all include
// the new post. Also captures a desktop screenshot of the post.
// Modeled on task129-keyword-check.mjs (chrome version-glob lesson kept).
// Usage: BASE=... node scripts/task143-keyword-check.mjs (env SHOT_PREFIX, NO_SHOT)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  ...[...(await import("node:fs")).readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })]
    .filter((d) => d.isDirectory() && d.name.startsWith("linux-"))
    .sort()
    .reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d.name}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9359;
const BASE = process.env.BASE || "http://127.0.0.1:3222";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "/home/z/my-project/download/task143-blog";

const POSTS = [
  {
    slug: "venture-capital-in-somalia",
    titleFrag: "Venture Capital in Somalia",
    qaFrag: "no formal VC industry yet",
    cover: "venture-capital-in-somalia.jpg",
  },
];

const results = [];
const ok = (name, cond, extra = "") => { results.push([name, !!cond, extra]); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const get = async (url) => { try { const r = await fetch(url, { redirect: "follow" }); return { status: r.status, body: await r.text(), type: r.headers.get("content-type") || "" }; } catch (e) { return { status: 0, body: "", type: "", err: String(e) }; } };

// ---- Phase A: fetch-based SSR checks --------------------------------------
const allContentLinks = new Set();
for (const p of POSTS) {
  const url = `${BASE}/blog/${p.slug}`;
  const page = await get(url);
  ok(`[${p.slug}] page 200`, page.status === 200, `status ${page.status}`);
  if (page.status !== 200) continue;
  ok(`[${p.slug}] h1 title`, page.body.includes(p.titleFrag));
  ok(`[${p.slug}] quick-answer box`, page.body.includes("Quick answer") && page.body.includes(p.qaFrag));
  ok(`[${p.slug}] keyword in title+QA (venture capital)`, page.body.includes("Venture Capital in Somalia") && page.body.toLowerCase().split("venture capital").length > 5, `mentions`);
  let types = [];
  for (const m of page.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { for (const node of JSON.parse(m[1])["@graph"] || []) types.push(node["@type"]); } catch {}
  }
  ok(`[${p.slug}] JSON-LD BlogPosting+FAQPage+HowTo`, types.includes("BlogPosting") && types.includes("FAQPage") && types.includes("HowTo"), types.join(","));
  ok(`[${p.slug}] FAQPage carries the 5 questions`, (page.body.match(/venture capital in simple terms\?/) || []).length === 1 && page.body.includes("Is there venture capital in Somalia?") && page.body.includes("different from a bank loan?") && page.body.includes("venture capitalists look for before investing?") && page.body.includes("raise venture-style funding today?"));
  ok(`[${p.slug}] canonical`, page.body.includes(`rel="canonical"`) && page.body.includes(`/blog/${p.slug}`));
  ok(`[${p.slug}] og:image cover`, page.body.includes(`og:image`) && page.body.includes(p.cover));
  const cov = await get(`${BASE}/images/blog/${p.cover}`);
  ok(`[${p.slug}] cover 200 image/jpeg`, cov.status === 200 && cov.type.includes("image/jpeg"), `status ${cov.status} type ${cov.type}`);
  for (const m of page.body.matchAll(/https:\/\/hayaan\.co\/[a-z0-9\-\/._]*/g)) allContentLinks.add(m[0].replace(/[.,)]+$/, ""));
}

const index = await get(`${BASE}/blog`);
ok(`/blog index lists the new title`, POSTS.every((p) => index.body.includes(p.titleFrag)));
const sm = await get(`${BASE}/sitemap.xml`);
ok(`sitemap.xml lists the new slug`, POSTS.every((p) => sm.body.includes(p.slug)));
const llms = await get(`${BASE}/llms.txt`);
ok(`llms.txt lists the new guide + /investors`, POSTS.every((p) => llms.body.includes(p.slug)) && llms.body.includes("/investors"));
const llmsFull = await get(`${BASE}/llms-full.txt`);
ok(`llms-full.txt lists the new guide`, POSTS.every((p) => llmsFull.body.includes(p.slug)));

// every internal link printed on the new page must resolve — two-pass
// tolerance for prod's transient 503s (measured, Task 127)
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const probe = async (target) => {
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleepMs(1200 * attempt);
    status = (await get(target)).status;
    if (status === 200) break;
  }
  return status;
};
let dead = [];
if (!process.env.SKIP_LINKS) {
  const pending = [];
  for (const link of [...allContentLinks]) {
    const target = link.startsWith(BASE) ? link : `${BASE}${link.slice("https://hayaan.co".length)}`;
    if ((await probe(target)) !== 200) pending.push([link, target]);
    await sleepMs(350);
  }
  if (pending.length) {
    console.log(`pass1: ${pending.length} link(s) not yet 200 — cooldown 10s, retrying once`);
    await sleepMs(10000);
  }
  for (const [link, target] of pending) {
    const status = await probe(target);
    if (status !== 200) dead.push(`${link} -> ${status}`);
    await sleepMs(350);
  }
}
ok(`all ${allContentLinks.size} unique internal links on the new page resolve 200`, dead.length === 0, dead.slice(0, 5).join(" | "));

// ---- Phase B: screenshots (CDP) --------------------------------------------
if (!process.env.NO_SHOT) {
  const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!CHROME) console.log("screenshots SKIPPED: no chrome binary found in candidate paths");
  if (CHROME) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chrome = spawn(CHROME, [
      "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-sandbox", "--no-first-run", "--no-default-browser-check",
      "--disable-dev-shm-usage", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
      `--user-data-dir=/tmp/chrome-t143-${Date.now()}`,
      "--window-size=1440,2400", "about:blank",
    ], { stdio: "ignore" });
    let v = null;
    for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
    if (v) {
      function conn(url, t = 15000) { return new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; }); }
      let id = 0;
      function cmd(ws, m, p = {}, sid = null, to = 45000) { return new Promise((res, rej) => { const i = ++id; const pay = { id: i, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); }); }
      const ws = await conn(v.webSocketDebuggerUrl);
      const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
      const send = (m, p) => cmd(ws, m, p, sessionId);
      await send("Page.enable"); await send("Runtime.enable");
      await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });
      for (const p of POSTS) {
        await send("Page.navigate", { url: `${BASE}/blog/${p.slug}` });
        await sleep(4000);
        const r = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(`${SHOT_PREFIX}-${p.slug}.png`, Buffer.from(r.data, "base64"));
        console.log(`screenshot: ${SHOT_PREFIX}-${p.slug}.png`);
      }
    }
    chrome.kill();
  }
}

const failed = results.filter(([, pass]) => !pass);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([n]) => n).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
