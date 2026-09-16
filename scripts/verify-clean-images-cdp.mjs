// Task 54 live verify: cleaned images on hayaan.co (no Sanguni logo).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9340;
const BASE = "https://hayaan.co";
const SHOT_HOME = "/home/z/my-project/download/task54-home-no-logo.png";
const SHOT_PDP = "/home/z/my-project/download/task54-pdp-no-logo.png";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t54-${Date.now()}`,
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
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result?.value; };
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

// PDP: HP EliteBook 840 G7 (the one from the user's screenshot)
await send("Page.navigate", { url: `${BASE}/product/hp-elitebook-840-g7-notebook` });
await sleep(6000);
const pdp = await ev(`(() => {
  const img = document.querySelector('img');
  return { title: document.querySelector('h1')?.innerText, imgLoaded: img ? img.complete && img.naturalWidth > 50 : false,
    price: /\\$[\\d,]+/.test(document.body.innerText) };
})()`);
console.log("PDP:", JSON.stringify(pdp));
await send("Page.captureScreenshot", { format: "png" }).then((r) => writeFileSync(SHOT_PDP, Buffer.from(r.data, "base64")));

// homepage: cards region with cleaned items (DJI Mic / HP Toner / routers)
await send("Page.navigate", { url: BASE });
await sleep(6000);
const scroll = `new Promise(res => { let y=0; const st=()=>{ y+=1200; window.scrollTo(0,y); if(y<2600) setTimeout(st,150); else { setTimeout(res,900); } }; st(); })`;
await ev(scroll);
const home = await ev(`(() => {
  const imgs=[...document.querySelectorAll('a[href^="/product/"] img')];
  const loaded=imgs.filter(i=>i.complete&&i.naturalWidth>50);
  return { cards: imgs.length, loaded: loaded.length };
})()`);
console.log("HOME:", JSON.stringify(home));
await send("Page.captureScreenshot", { format: "png" }).then((r) => writeFileSync(SHOT_HOME, Buffer.from(r.data, "base64")));
console.log("TASK54-VERIFY-DONE");
chrome.kill(); process.exit(0);
