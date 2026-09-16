// Task 52 live verification: https://hayaan.co with the imported catalog.
// 1. homepage — count product cards, detect demo leftovers, screenshot
// 2. a PDP — placeholder image + stock badge + price render, screenshot
// 3. category pill click — Electronics should show 68, Home & Living 26
// Chrome is spawned HERE (self-contained, proven hover-verify-cdp.mjs pattern).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9337;
const BASE = "https://hayaan.co";
const PDP_SLUG = "hp-toner-cartridge-651a-original-set";
const SHOT_HOME = "/home/z/my-project/download/task52-home-new-catalog.png";
const SHOT_PDP = "/home/z/my-project/download/task52-pdp-placeholder.png";
const SHOT_PILL = "/home/z/my-project/download/task52-electronics-pill.png";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary found"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t52-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools endpoint never came up"); chrome.kill(); process.exit(1); }
console.error("[stage] chrome up");
function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 45000);
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
const send = (m, p) => sendCmd(ws, m, p, sessionId);

await send("Page.enable");
await send("Runtime.enable");
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

// --- homepage ---
await send("Page.navigate", { url: BASE });
await sleep(6000);
const home = await evalJS(`(() => {
  const cards = document.querySelectorAll('a[href^="/product/"]').length;
  const body = document.body.innerText;
  return {
    cards,
    demoLeftovers: (body.match(/Aurora Wireless|Ceramic Vase|Soy Candle|Leather Journal|Organic Cotton/g) || []).length,
    sampleVisible: body.includes("Power Bank") || body.includes("iPhone 17") || body.includes("Samsung Galaxy"),
    noProductsBanner: body.includes("No products found"),
  };
})()`);
console.log("HOME:", JSON.stringify(home));
await send("Page.captureScreenshot", { format: "png" }).then((r) => {
  writeFileSync(SHOT_HOME, Buffer.from(r.data, "base64"));
});
console.log("shot:", SHOT_HOME);

// --- PDP ---
await send("Page.navigate", { url: `${BASE}/product/${PDP_SLUG}` });
await sleep(5000);
const pdp = await evalJS(`(() => {
  const img = document.querySelector('img');
  const body = document.body.innerText;
  return {
    title: document.querySelector('h1')?.innerText ?? null,
    imgLoaded: img ? img.complete && img.naturalWidth > 0 : false,
    imgSrc: img?.src?.slice(0, 90) ?? null,
    priceShown: /\\$\\s?\\d/.test(body),
    stockShown: body.includes("in stock"),
    buyEnabled: ![...document.querySelectorAll('button')].filter(b => /add to cart|buy now/i.test(b.innerText)).every(b => b.disabled),
  };
})()`);
console.log("PDP:", JSON.stringify(pdp));
await send("Page.captureScreenshot", { format: "png" }).then((r) => {
  writeFileSync(SHOT_PDP, Buffer.from(r.data, "base64"));
});
console.log("shot:", SHOT_PDP);

// --- category pills ---
await send("Page.navigate", { url: BASE });
await sleep(5000);
const pills = await evalJS(`[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(t => t && t.length < 30).slice(0, 12)`);
console.log("PILLS:", JSON.stringify(pills));
for (const [label, expect] of [["Electronics", 68], ["Home & Living", 26]]) {
  const count = await evalJS(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(label)});
    if (!btn) return "pill-missing";
    btn.click();
    return new Promise(res => setTimeout(() => {
      res(document.querySelectorAll('a[href^="/product/"]').length);
    }, 1200));
  })()`);
  console.log(`PILL ${label}: ${count} cards (expect ${expect})`);
  if (label === "Electronics") {
    await send("Page.captureScreenshot", { format: "png" }).then((r) => {
      writeFileSync(SHOT_PILL, Buffer.from(r.data, "base64"));
    });
    console.log("shot:", SHOT_PILL);
  }
}
console.log("TASK52-VERIFY-DONE");
chrome.kill();
process.exit(0);
