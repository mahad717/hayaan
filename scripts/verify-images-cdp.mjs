// Task 53 live verification: hayaan.co shows real product photos.
// 1. homepage — product cards + % of images actually decoded (naturalWidth>0)
// 2. PDP (iPhone 17 Pro) — real photo renders, screenshot
// Chrome spawned HERE (proven harness pattern).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9339;
const BASE = "https://hayaan.co";
const SHOT_HOME = "/home/z/my-project/download/task53-home-real-images.png";
const SHOT_PDP = "/home/z/my-project/download/task53-pdp-real-photo.png";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t53v-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools endpoint never came up"); chrome.kill(); process.exit(1); }
function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws timeout")); }, timeoutMs);
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
const send = (m, p) => sendCmd(ws, m, p, sessionId);
await send("Page.enable");
await send("Runtime.enable");
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

// scroll to bottom & back to force lazy images
const forceLoad = `new Promise(res => {
  let y = 0; const step = () => {
    y += 1200; window.scrollTo(0, y);
    if (y < document.body.scrollHeight) setTimeout(step, 120);
    else { window.scrollTo(0, 0); setTimeout(res, 800); }
  }; step();
})`;

// --- homepage ---
await send("Page.navigate", { url: BASE });
await sleep(6000);
await evalJS(forceLoad);
await sleep(2500);
const home = await evalJS(`(() => {
  const links = document.querySelectorAll('a[href^="/product/"]');
  const imgs = [...links].map(a => a.querySelector('img')).filter(Boolean);
  const loaded = imgs.filter(i => i.complete && i.naturalWidth > 50);
  const placeholder = imgs.filter(i => (i.currentSrc || i.src || '').includes('9ae99ccd')).length;
  return { cards: links.length, imgs: imgs.length, loaded: loaded.length, placeholderLeft: placeholder };
})()`);
console.log("HOME:", JSON.stringify(home));
await send("Page.captureScreenshot", { format: "png" }).then((r) => writeFileSync(SHOT_HOME, Buffer.from(r.data, "base64")));
console.log("shot:", SHOT_HOME);

// --- PDP ---
await send("Page.navigate", { url: `${BASE}/product/${encodeURIComponent("iphone-17-pro-(physical-sim)")}` });
await sleep(6000);
const pdp = await evalJS(`(() => {
  const img = document.querySelector('img');
  const body = document.body.innerText;
  return {
    title: document.querySelector('h1')?.innerText ?? null,
    imgLoaded: img ? img.complete && img.naturalWidth > 50 : false,
    imgNatural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
    isPlaceholder: img ? (img.currentSrc || img.src || '').includes('9ae99ccd') : null,
    priceShown: /\\$\\s?\\d/.test(body),
    buyEnabled: ![...document.querySelectorAll('button')].filter(b => /add to cart|buy now/i.test(b.innerText)).every(b => b.disabled),
  };
})()`);
console.log("PDP:", JSON.stringify(pdp));
await send("Page.captureScreenshot", { format: "png" }).then((r) => writeFileSync(SHOT_PDP, Buffer.from(r.data, "base64")));
console.log("shot:", SHOT_PDP);
console.log("TASK53-VERIFY-DONE");
chrome.kill();
process.exit(0);
