// Task 138: prod screenshots + hydration-safe checks (Task 134 poll lesson).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-156.0.8078.73/chrome",
  "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
const PORT = 9348;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage", "--disable-gpu",
  "--disable-blink-features=AutomationControlled",
  "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  `--user-data-dir=/tmp/chrome-t138-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill(); } catch {} });

let wsUrl = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    wsUrl = v.webSocketDebuggerUrl; break;
  } catch {}
}
if (!wsUrl) { console.error("FATAL: no chrome"); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let mid = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const t = await send("Target.createTarget", { url: "about:blank" });
const targetId = t.result?.targetId;
const s = await send("Target.attachToTarget", { targetId, flatten: true });
const sessionId = s.result?.sessionId;
console.log("[cdp] session attached:", Boolean(sessionId));
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
const errors = [];
ws.onmessage = (() => { const prev = ws.onmessage; return (e) => { prev(e); try { const m = JSON.parse(e.data); if (m.method === "Runtime.exceptionThrown") errors.push(m.params?.exceptionDetails?.text ?? "exception"); } catch {} }; })();

async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  return r.result?.result?.value;
}
async function shot(path) {
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 }, sessionId);
  const data = r?.result?.data;
  if (!data) { console.log("[shot] FAILED", JSON.stringify(r).slice(0, 150)); return; }
  writeFileSync(path, Buffer.from(data, "base64"));
  console.log("[shot]", path);
}
async function waitFor(expr, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(expr)) return true;
    await sleep(500);
  }
  return false;
}
async function gotoDesktop(url) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2200, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await sleep(2500);
}

// ---- base A17 PDP desktop: price + AEO FAQ section visible ----
await gotoDesktop("https://hayaan.co/product/samsung-galaxy-a17/");
const basePrice = await waitFor(`document.body.innerText.includes('170.00') || document.body.innerText.includes('$170')`);
const baseImg = await waitFor(`!!document.querySelector('img')`, 8000);
const faqHeading = await evalJs(`document.body.innerText.includes('price in Somalia and buying FAQs')`);
console.log("[base-pdp] price text:", basePrice, "| img:", baseImg, "| AEO FAQ heading:", faqHeading);
await evalJs(`window.scrollTo(0, 400)`); await sleep(800);
await shot("/home/z/my-project/download/t138-a17-base-pdp-desktop.png");
await evalJs(`const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.includes('buying FAQs')); h?.scrollIntoView({block:'start'})`);
await sleep(1000);
await shot("/home/z/my-project/download/t138-a17-base-faq.png");

// ---- 8GB/256GB variant PDP desktop: repo image + $240 ----
await gotoDesktop("https://hayaan.co/product/samsung-galaxy-a17-8gb256gb/");
const vImg = await waitFor(`!!document.querySelector('img[src*="samsung-galaxy-a17-8gb256gb"]')`);
const vPrice = await waitFor(`document.body.innerText.includes('240.00') || document.body.innerText.includes('$240')`);
const vTitle = await evalJs(`document.title`);
const vFaq = await evalJs(`document.body.innerText.includes('price in Somalia and buying FAQs')`);
console.log("[8gb256gb-pdp] repo img mounted:", vImg, "| price:", vPrice, "| FAQ:", vFaq, "| title:", vTitle);
await evalJs(`window.scrollTo(0, 400)`); await sleep(800);
await shot("/home/z/my-project/download/t138-a17-8gb256gb-pdp-desktop.png");

// ---- 6GB/128GB variant PDP mobile: sticky bar hydration (Task 134 feature) ----
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
await send("Page.navigate", { url: "https://hayaan.co/product/samsung-galaxy-a17-6gb128gb/" }, sessionId);
await sleep(2500);
const sticky = await waitFor(`!!document.querySelector('[class*="sticky"]')`, 12000);
const mImg = await waitFor(`!!document.querySelector('img[src*="samsung-galaxy-a17-6gb128gb"]')`);
await evalJs(`window.scrollTo(0, 900)`); await sleep(1200);
console.log("[6gb128gb-mobile] sticky bar hydrated:", sticky, "| repo img:", mImg);
await shot("/home/z/my-project/download/t138-a17-6gb128gb-mobile.png");

// ---- phones category: both variant cards visible ----
await gotoDesktop("https://hayaan.co/category/phones-wearables");
const inCat = await waitFor(`document.body.innerText.includes('8GB/256GB') && document.body.innerText.includes('6GB/128GB')`, 12000);
console.log("[category] both A17 variants visible:", inCat);
await evalJs(`const el=[...document.querySelectorAll('a')].find(a=>a.href.includes('samsung-galaxy-a17-8gb256gb')); el?.scrollIntoView({block:'center'})`);
await sleep(1000);
await shot("/home/z/my-project/download/t138-a17-variants-in-category.png");

console.log("[errors]", errors.length ? errors.slice(0, 5) : "none");
ws.close(); process.exit(0);
