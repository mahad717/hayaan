// Task 56 live verify: Somali language toggle on hayaan.co (EN/SO).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9341;
const BASE = "https://hayaan.co";
const SHOT_EN = "/home/z/my-project/download/task56-home-en.png";
const SHOT_SO = "/home/z/my-project/download/task56-home-so.png";
const SHOT_PDP_SO = "/home/z/my-project/download/task56-pdp-so.png";
const SLUG = "iphone-17-pro-(physical-sim)";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t56-${Date.now()}`,
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

// ---- 1. Home, default (no cookie) = English ----
await send("Page.navigate", { url: `${BASE}/` });
await sleep(7000);
console.log("EN htmlLang:", await ev(`document.documentElement.lang`));
console.log("EN hero ok:", await ev(`document.body.innerText.includes("Start shopping") && document.body.innerText.includes("Add to cart")`));
console.log("EN toggle present:", await ev(`!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === "SO")`));
await shot(SHOT_EN);

// ---- 2. Click SO toggle -> instant switch, no reload ----
console.log("clicked SO:", await ev(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === "SO"); b.click(); return true; })()`));
await sleep(1200);
console.log("SO htmlLang after click:", await ev(`document.documentElement.lang`));
console.log("SO hero ok:", await ev(`document.body.innerText.includes("Bilow iibsiga") && document.body.innerText.includes("Ku dar gaadhiga")`));
console.log("cookie:", await ev(`document.cookie.split('; ').find(c => c.startsWith('hayaan_lang'))`));
await shot(SHOT_SO);

// ---- 3. Reload -> Somali persists (cookie drives SSR) ----
await send("Page.navigate", { url: `${BASE}/` });
await sleep(7000);
console.log("after reload htmlLang:", await ev(`document.documentElement.lang`));
console.log("after reload SO ok:", await ev(`document.body.innerText.includes("Bilow iibsiga")`));
console.log("after reload pills:", await ev(`Array.from(document.querySelectorAll('#catalog button')).slice(0,6).map(b => b.textContent.trim()).join(" | ")`));

// ---- 4. Toggle back to EN, then PDP in Somali via cookie ----
console.log("switch back EN:", await ev(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === "EN"); b.click(); return true; })()`));
await sleep(800);
console.log("EN back ok:", await ev(`document.body.innerText.includes("Start shopping")`));
await send("Page.navigate", { url: `${BASE}/product/${encodeURIComponent(SLUG)}` });
await sleep(7000);
await ev(`document.cookie = "hayaan_lang=so; path=/; max-age=31536000"`);
await send("Page.navigate", { url: `${BASE}/product/${encodeURIComponent(SLUG)}` });
await sleep(7000);
console.log("PDP SO lang:", await ev(`document.documentElement.lang`));
console.log("PDP SO ok:", await ev(`document.body.innerText.includes("Iibso hadda") && document.body.innerText.includes("Ku noqo suuqa") && document.body.innerText.includes("ayaa jira")`));
console.log("PDP desc SO:", await ev(`(document.querySelector("p.max-w-prose")?.textContent ?? "").slice(0, 80)`));
await shot(SHOT_PDP_SO);

console.log("console exceptions:", errors.length, errors.slice(0, 5));
chrome.kill();
process.exit(0);
