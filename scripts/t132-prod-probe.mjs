// Task 132 prod probe — why doesn't [data-search-panel] open on prod?
// Types into the real input (click + Input.insertText) then polls for the
// panel for up to 10s, dumping input value / aria-expanded / card count.
const BASE = process.env.BASE || "https://hayaan.co";
const DEBUG_PORT = process.env.DEBUG_PORT || "9362";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t132p-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { console.log("no CDP"); process.exit(1); }

const conn = (url, t = 15000) => new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => rej(new Error("ws timeout")), t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => rej(new Error("ws err")); });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
await send("Page.enable"); await send("Runtime.enable");
const waitFor = async (expr, tries = 30, gap = 400) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };

await send("Page.navigate", { url: `${BASE}/` });
const booted = await waitFor(`document.querySelector('#catalog') && document.querySelectorAll('a[href^="/product/"]').length > 0`);
console.log("booted:", booted);
const state0 = await ev(`({cards: document.querySelectorAll('a[href^="/product/"]').length, inputs: [...document.querySelectorAll('input[aria-label="Search products"]')].map(i => ({visible: i.offsetParent !== null, expanded: i.getAttribute('aria-expanded')}))})`);
console.log("state0:", JSON.stringify(state0));

const c = await ev(`(() => { const el = [...document.querySelectorAll('input[aria-label="Search products"]')].find((i) => i.offsetParent !== null); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
console.log("input center:", JSON.stringify(c));
for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c.x, y: c.y, button: "left", clickCount: 1 });
await sleep(150);
await send("Input.insertText", { text: "samsung" });

for (let i = 0; i < 20; i++) {
  const s = await ev(`(() => { const p = document.querySelector('[data-search-panel]'); const input = [...document.querySelectorAll('input[aria-label="Search products"]')].find((i) => i.offsetParent !== null); return { t: Date.now() % 100000, panel: !!p, rows: p ? p.querySelectorAll('img').length : 0, text: p ? p.innerText.slice(0, 120) : null, val: input ? input.value : null, exp: input ? input.getAttribute('aria-expanded') : null, active: document.activeElement === input }; })()`);
  console.log(JSON.stringify(s));
  if (s.panel) break;
  await sleep(500);
}
chrome.kill();
