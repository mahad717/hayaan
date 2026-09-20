// Task 72 SEO hardening — visual CDP verify against the LOCAL dev server.
// Screenshots: /category page, PDP category link, branded 404.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const DEBUG_PORT = 9347;
const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/download";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t72-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { chrome.kill(); process.exit(1); }
function conn(url, t = 15000) { return new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; }); }
let id = 0;
function cmd(ws, m, p = {}, sid = null, to = 45000) { return new Promise((res, rej) => { const i = ++id; const pay = { id: i, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); }); }
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
await send("Page.enable"); await send("Runtime.enable");
const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text ?? "exception");
});
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result?.value; };
const shot = async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); };
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

let fails = 0;
const check = (name, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`); if (!cond) fails++; };

// ---- 1. category landing page ----
await send("Page.navigate", { url: `${BASE}/category/computers-tv-gaming` });
await sleep(6000);
const cat = await ev(`(() => {
  const h1 = document.querySelector("h1");
  const cards = document.querySelectorAll('a[href^="/product/"]').length;
  const pills = [...document.querySelectorAll('a[href^="/category/"]')].map(a => a.textContent.trim());
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent);
  const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]');
  return JSON.stringify({
    h1: h1?.textContent.trim() ?? null,
    productLinks: cards,
    categoryPills: pills.length,
    hasItemList: ld.some(s => s.includes('"ItemList"')),
    hasBreadcrumbLd: ld.some(s => s.includes('"BreadcrumbList"')),
    visibleBreadcrumb: breadcrumb?.textContent.trim() ?? null,
    title: document.title,
  });
})()`);
console.log("category:", cat);
const catData = JSON.parse(cat);
check("category h1 = Apparel", catData.h1 === "Apparel", catData.h1);
check("category SSR product links > 0", catData.productLinks > 0, String(catData.productLinks));
check("category pills > 0", catData.categoryPills > 0, String(catData.categoryPills));
check("category ItemList + BreadcrumbList LD", catData.hasItemList && catData.hasBreadcrumbLd);
check("category visible breadcrumb", /Apparel/.test(catData.visibleBreadcrumb ?? ""), catData.visibleBreadcrumb);
check("category title tag", /Apparel/.test(catData.title), catData.title);
await shot(`${OUT}/task72-live-category-apparel.png`);

// ---- 2. PDP with category link ----
await send("Page.navigate", { url: `${BASE}/product/multivitamines-pour-hommes--boost-immunitaire-aux-vitamines-a-b12-c-d--nergie-quotidienne-et-non-ogm` });
await sleep(6000);
const pdp = await ev(`(() => {
  const a = document.querySelector('a[href^="/category/"]');
  return JSON.stringify({
    categoryHref: a?.getAttribute("href") ?? null,
    categoryText: a?.textContent.trim() ?? null,
    title: document.title,
  });
})()`);
console.log("pdp:", pdp);
const pdpData = JSON.parse(pdp);
check("PDP category link present", !!pdpData.categoryHref, pdpData.categoryHref ?? "none");
check("PDP title has product name", /Carry Canvas Tote/.test(pdpData.title), pdpData.title);
await shot(`${OUT}/task72-live-pdp-category-link.png`);

// ---- 3. branded 404 ----
await send("Page.navigate", { url: `${BASE}/no-such-page-xyz` });
await sleep(4000);
const nf = await ev(`(() => JSON.stringify({
  headline: document.querySelector("h1")?.textContent.trim() ?? null,
  links: [...document.querySelectorAll("a")].map(a => a.getAttribute("href")).filter(h => ["/", "/deals", "/blog"].includes(h)),
}))()`);
console.log("404:", nf);
const nfData = JSON.parse(nf);
check("404 headline", /wandered off the map/.test(nfData.headline ?? ""), nfData.headline);
check("404 recovery links", nfData.links.length >= 3, nfData.links.join(","));
await shot(`${OUT}/task72-live-branded-404.png`);

console.error(`console exceptions: ${errors.length}`);
if (errors.length) console.error(errors.slice(0, 5));
console.error(fails ? `\n${fails} FAILURES` : "\nALL VISUAL CHECKS PASS");
chrome.kill();
process.exit(fails || errors.length ? 1 : 0);
