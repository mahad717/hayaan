// Task 148 runtime check: the Galaxy A-series price hub must ship fully —
// page renders, quick-answer box present, JSON-LD @graph carries BlogPosting +
// FAQPage + HowTo, canonical + og:image wired, cover resolves as a real JPEG,
// EVERY hayaan.co link printed in the content resolves 200, /blog index +
// sitemap.xml + llms.txt + llms-full.txt all include the new post. PLUS the
// Task 148 PDP-override suite: A16/A56/A57×2 titles, meta descriptions,
// visible FAQ headings, FAQPage JSON-LD, Product schema price, intro phrase,
// the A17-6GB out-of-stock branch, and the A-series guide-card funnel on the
// A-series PDPs (absent on the A18, which keeps its dedicated guide).
// Modeled on task147-keyword-check.mjs. Works against a seeded local server
// (scripts/t148-seed-db.py) or against prod via BASE=... after deploy.
// Usage: BASE=... node scripts/t148-verify.mjs (env SHOT_PREFIX, NO_SHOT, SKIP_LINKS)
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
const DEBUG_PORT = 9362;
const BASE = process.env.BASE || "http://127.0.0.1:3222";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "/home/z/my-project/download/task148";

const HUB = {
  slug: "samsung-galaxy-a-series-price-in-somalia",
  titleFrag: "Samsung Galaxy A Series Price in Somalia",
  qaFrag: "runs from $118",
  cover: "samsung-galaxy-a-series-price-in-somalia.jpg",
};

// PDP override suite — (slug, exact title, intro fragment, stock>0?)
// Prices match the verified prod catalog; the local seed DB mirrors them.
const PDPS = [
  ["samsung-galaxy-a16", "Samsung Galaxy A16 Price in Somalia — $145 | Hayaan Market", "The Samsung Galaxy A16 price in Somalia is $145", true],
  ["samsung-galaxy-a56-5g", "Samsung Galaxy A56 5G Price in Somalia — $375 | Hayaan Market", "The Samsung Galaxy A56 5G price in Somalia is $375", true],
  ["samsung-galaxy-a57-5g-8gb256gb", "Samsung Galaxy A57 5G 8GB/256GB Price in Somalia — $375 | Hayaan Market", "The Samsung Galaxy A57 5G (8GB/256GB) price in Somalia is $375", true],
  ["samsung-galaxy-a57-5g-12gb256gb", "Samsung Galaxy A57 5G 12GB/256GB Price in Somalia — $440 | Hayaan Market", "The Samsung Galaxy A57 5G (12GB/256GB) price in Somalia is $440", true],
  // t138 override + Task 148 seed at stock 0 — exercises the inStock=false branch
  ["samsung-galaxy-a17-6gb128gb", "Samsung Galaxy A17 6GB/128GB Price in Somalia — $220 | Hayaan Market", "The Samsung Galaxy A17 (6GB/128GB) price in Somalia is $220", false],
];

// A-series PDPs that must carry the hub-post guide card (max-3 trio)
const GUIDE_CARD_ON = ["samsung-galaxy-a16", "samsung-galaxy-a56-5g", "samsung-galaxy-a57-5g-8gb256gb", "samsung-galaxy-a17", "samsung-galaxy-a06"];
// the A18 keeps its dedicated guide trio — the hub card must NOT displace it
const HUB_CARD_ABSENT_ON = ["samsung-galaxy-a18"];
const HUB_LINK = "/blog/samsung-galaxy-a-series-price-in-somalia";

const results = [];
const ok = (name, cond, extra = "") => { results.push([name, !!cond, extra]); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const get = async (url) => { try { const r = await fetch(url, { redirect: "follow" }); return { status: r.status, body: await r.text(), type: r.headers.get("content-type") || "" }; } catch (e) { return { status: 0, body: "", type: "", err: String(e) } } };

// ---- Phase A1: hub post SSR checks -----------------------------------------
const allContentLinks = new Set();
const page = await get(`${BASE}/blog/${HUB.slug}`);
ok(`[hub] page 200`, page.status === 200, `status ${page.status}`);
if (page.status === 200) {
  ok(`[hub] h1 title`, page.body.includes(HUB.titleFrag));
  ok(`[hub] quick-answer box`, page.body.includes("Quick answer") && page.body.includes(HUB.qaFrag));
  const kw = "price in somalia";
  const density = page.body.toLowerCase().split(kw).length - 1;
  ok(`[hub] keyword density (price in somalia x>=8)`, density >= 8, `${density} mentions`);
  let types = [];
  for (const m of page.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { for (const node of JSON.parse(m[1])["@graph"] || []) types.push(node["@type"]); } catch {}
  }
  ok(`[hub] JSON-LD BlogPosting+FAQPage+HowTo`, types.includes("BlogPosting") && types.includes("FAQPage") && types.includes("HowTo"), types.join(","));
  ok(`[hub] FAQPage carries the 6 model questions`, page.body.includes("How much is the Samsung A56 in Somalia?") && page.body.includes("How much is the Samsung A57 in Somalia?") && page.body.includes("How much is the Samsung A17 in Somalia?") && page.body.includes("How much is the Samsung A16 in Somalia?") && page.body.includes("What is the Samsung A15 price in Somalia?") && page.body.includes("Which Samsung Galaxy A model should you buy?"));
  // verified-prices discipline: every catalog price asserted present
  const prices = ["$118", "$140", "$145", "$170", "$220", "$263", "$190", "$285", "$330", "$375", "$440"];
  const missingPrices = prices.filter((p) => !page.body.includes(p));
  ok(`[hub] all 11 verified catalog prices present`, missingPrices.length === 0, missingPrices.join(","));
  // honest-A15 discipline: no invented A15 price; the not-stocked answer present
  ok(`[hub] A15 answered honestly (not stocked, no invented price)`, page.body.includes("does not stock the Galaxy A15") && !/A15[^.]{0,30}\$\d/.test(page.body.replace(/\n/g, " ")) && page.body.includes("6.5-inch 90Hz Super AMOLED"));
  ok(`[hub] canonical`, page.body.includes(`rel="canonical"`) && page.body.includes(`/blog/${HUB.slug}`));
  ok(`[hub] og:image cover`, page.body.includes(`og:image`) && page.body.includes(HUB.cover));
  const cov = await get(`${BASE}/images/blog/${HUB.cover}`);
  ok(`[hub] cover 200 image/jpeg`, cov.status === 200 && cov.type.includes("image/jpeg"), `status ${cov.status} type ${cov.type}`);
  for (const m of page.body.matchAll(/https:\/\/hayaan\.co\/[a-z0-9\-\/._]*/g)) allContentLinks.add(m[0].replace(/[.,)]+$/, ""));
}

// ---- Phase A2: PDP override suite -------------------------------------------
let jsonLdTypes = {};
for (const [slug, title, introFrag, inStock] of PDPS) {
  const p = await get(`${BASE}/product/${slug}`);
  ok(`[pdp ${slug}] page 200`, p.status === 200, `status ${p.status}`);
  if (p.status !== 200) continue;
  ok(`[pdp ${slug}] override <title>`, p.body.includes(`<title>${title}</title>`), `expected ${title}`);
  ok(`[pdp ${slug}] intro paragraph`, p.body.includes(introFrag));
  ok(`[pdp ${slug}] FAQ heading`, p.body.includes("price in Somalia and buying FAQs"));
  ok(`[pdp ${slug}] meta ${inStock ? "Order online" : "Check back soon"}`, p.body.includes(inStock ? "Order online." : "Check back soon."));
  // Product JSON-LD price + FAQPage in @graph
  const types = [];
  let priceOk = false;
  for (const m of p.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const g = JSON.parse(m[1])["@graph"] || [];
      for (const node of g) {
        types.push(node["@type"]);
        if (node["@type"] === "Product" && node.offers?.price === (title.match(/\$(\d+)/)?.[1] ?? "") + ".00") priceOk = true;
      }
    } catch {}
  }
  ok(`[pdp ${slug}] Product JSON-LD price`, priceOk);
  ok(`[pdp ${slug}] FAQPage JSON-LD`, types.includes("FAQPage"), types.join(","));
  jsonLdTypes[slug] = types;
}

// ---- Phase A3: guide-card funnel ---------------------------------------------
for (const slug of GUIDE_CARD_ON) {
  const p = await get(`${BASE}/product/${slug}`);
  if (p.status !== 200) { ok(`[guide ${slug}] hub card`, false, "pdp not 200"); continue; }
  ok(`[guide ${slug}] hub card present`, p.body.includes(HUB_LINK));
}
for (const slug of HUB_CARD_ABSENT_ON) {
  const p = await get(`${BASE}/product/${slug}`);
  if (p.status !== 200) { ok(`[guide ${slug}] a18 trio preserved`, false, "pdp not 200"); continue; }
  ok(`[guide ${slug}] A18 keeps its dedicated trio (no hub card)`, !p.body.includes(HUB_LINK) && p.body.includes("/blog/samsung-galaxy-a18-price-in-somalia"));
}

// ---- Phase A4: indexes --------------------------------------------------------
const index = await get(`${BASE}/blog`);
ok(`/blog index lists the hub title`, index.body.includes(HUB.titleFrag));
const sm = await get(`${BASE}/sitemap.xml`);
ok(`sitemap.xml lists the hub slug`, sm.body.includes(HUB.slug));
const llms = await get(`${BASE}/llms.txt`);
ok(`llms.txt lists the hub guide`, llms.body.includes(HUB.slug));
const llmsFull = await get(`${BASE}/llms-full.txt`);
ok(`llms-full.txt lists the hub guide`, llmsFull.body.includes(HUB.slug));

// every internal link printed on the hub page must resolve — two-pass
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
// Local-seed limitation: the throwaway DB carries no /category/ rows, so a
// local 404 on a category link is NOT evidence of a dead link — re-probe the
// same path against prod (the real surface visitors see) before judging.
const PROD_FALLBACK = BASE.startsWith("http://127.") || BASE.startsWith("http://localhost") ? "https://hayaan.co" : null;
const probeSmart = async (target) => {
  let status = await probe(target);
  if (status !== 200 && PROD_FALLBACK) {
    const prodPath = target.startsWith(PROD_FALLBACK) ? target : `${PROD_FALLBACK}${target.replace(BASE, "")}`;
    const prodStatus = await probe(prodPath);
    if (prodStatus === 200) return `200-via-prod(${prodStatus})`;
  }
  return status;
};
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
    const status = await probeSmart(target);
    const okStatus = status === 200 || String(status).startsWith("200-via-prod");
    if (!okStatus) dead.push(`${link} -> ${status}`);
    await sleepMs(350);
  }
}
ok(`all ${allContentLinks.size} unique internal links on the hub page resolve 200`, dead.length === 0, dead.slice(0, 5).join(" | "));

// ---- Phase B: screenshots (CDP) ----------------------------------------------
if (!process.env.NO_SHOT) {
  const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!CHROME) console.log("screenshots SKIPPED: no chrome binary found in candidate paths");
  if (CHROME) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chrome = spawn(CHROME, [
      "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-sandbox", "--no-first-run", "--no-default-browser-check",
      "--disable-dev-shm-usage", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
      `--user-data-dir=/tmp/chrome-t148-${Date.now()}`,
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
      const shots = [[`${BASE}/blog/${HUB.slug}`, `blog-${HUB.slug}`], [`${BASE}/product/samsung-galaxy-a57-5g-8gb256gb`, `pdp-a57-8gb256gb`]];
      for (const [url, name] of shots) {
        await send("Page.navigate", { url });
        await sleep(4000);
        const r = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(`${SHOT_PREFIX}-${name}.png`, Buffer.from(r.data, "base64"));
        console.log(`screenshot: ${SHOT_PREFIX}-${name}.png`);
      }
    }
    chrome.kill();
  }
}

const failed = results.filter(([, pass]) => !pass);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([n]) => n).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
