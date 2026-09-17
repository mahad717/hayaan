// Task 58 live verify: floating WhatsApp button on hayaan.co
// (leads migration confirmed via API beforehand; button should now render
// with the build-inlined number 252615990144).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const DEBUG_PORT = 9343;
const BASE = "https://hayaan.co";
const OUT = {
  desktop: "/home/z/my-project/download/task58-whatsapp-desktop.png",
  mobile: "/home/z/my-project/download/task58-whatsapp-mobile.png",
};

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t58-${Date.now()}`,
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

const check = () => ev(`(() => {
  const a = document.querySelector('a[href^="https://wa.me/"]');
  if (!a) return JSON.stringify({ found: false });
  const r = a.getBoundingClientRect();
  return JSON.stringify({
    found: true,
    href: a.href.slice(0, 80),
    aria: a.getAttribute("aria-label"),
    visible: r.width > 0 && r.height > 0,
    pos: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    fixed: getComputedStyle(a).position,
  });
})()`);

// ---- 1. desktop homepage ----
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/` });
await sleep(8000);
console.log("desktop wa button:", await check());
await shot(OUT.desktop);

// ---- 2. mobile viewport (the primary Somali shopping device) ----
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `${BASE}/` });
await sleep(8000);
console.log("mobile wa button:", await check());
await shot(OUT.mobile);

// ---- 3. PDP too (button should be site-wide) ----
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `${BASE}/product/iphone-17-pro-(physical-sim)` });
await sleep(8000);
console.log("pdp wa button:", await check());

console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
process.exit(0);
