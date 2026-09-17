// Task 57 live verify: lead engine on hayaan.co — quote page EN/SO,
// offer popup, footer newsletter.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const DEBUG_PORT = 9342;
const BASE = "https://hayaan.co";
const OUT = {
  quoteEn: "/home/z/my-project/download/task57-quote-en.png",
  quoteSo: "/home/z/my-project/download/task57-quote-so.png",
  popup: "/home/z/my-project/download/task57-popup.png",
  footer: "/home/z/my-project/download/task57-footer-newsletter.png",
};

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t57-${Date.now()}`,
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

// ---- 1. /quote English (fresh context: no lang cookie) ----
await send("Page.navigate", { url: `${BASE}/quote` });
await sleep(7000);
console.log("quote EN lang:", await ev(`document.documentElement.lang`));
console.log("quote EN markers:", await ev(`["Bulk orders", "Full name", "What do you need?", "Request a quote"].every(s => document.body.innerText.includes(s))`));
await shot(OUT.quoteEn);

// ---- 2. /quote Somali (set cookie + reload) ----
await ev(`document.cookie = "hayaan_lang=so; path=/; max-age=31536000; samesite=lax"`);
await send("Page.navigate", { url: `${BASE}/quote` });
await sleep(7000);
console.log("quote SO lang:", await ev(`document.documentElement.lang`));
console.log("quote SO markers:", await ev(`["Dalabyo waaweyn", "Magaca oo dhan", "Codso qiimayn"].every(s => document.body.innerText.includes(s))`));
await shot(OUT.quoteSo);
await ev(`document.cookie = "hayaan_lang=en; path=/; max-age=31536000; samesite=lax"`);

// ---- 3. Home: wait past the 18s popup timer, capture it ----
await send("Page.navigate", { url: `${BASE}/` });
await sleep(25000);
const popupTitle = await ev(`(() => {
  const els = [...document.querySelectorAll("[role='dialog'] h2, [role='dialog'] .font-semibold")];
  return els.map(e => e.textContent.trim()).find(t => t.length > 3) ?? null;
})()`);
console.log("popup title:", popupTitle);
await shot(OUT.popup);

// ---- 4. Dismiss popup, scroll to footer, capture newsletter form ----
await ev(`(() => { const b = [...document.querySelectorAll("[role='dialog'] button")].find(b => /No thanks|Maya/i.test(b.textContent)); if (b) b.click(); })()`);
await sleep(1500);
await ev(`document.querySelector("footer")?.scrollIntoView()`);
await sleep(1500);
console.log("footer form markers:", await ev(`["Subscribe", "Bulk orders"].every(s => document.body.innerText.includes(s))`));
await shot(OUT.footer);

console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
console.log("DONE");
