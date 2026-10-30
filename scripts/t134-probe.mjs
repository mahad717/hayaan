// Task 134 — prod diagnostic probe: why does the sticky bar never appear on
// https://hayaan.co while local is 14/14? Captures console errors, tests real
// interactivity (qty click), scroll mechanics, buy-box geometry, and manual
// scroll-event dispatch to isolate: hydration failure vs scroll blocking vs
// listener/state issue.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const BASE = process.env.BASE || "https://hayaan.co";
const SLUG = process.env.PDP_SLUG || "samsung-galaxy-a18";
const DEBUG_PORT = process.env.DEBUG_PORT || "9371";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("no chrome binary"); process.exit(1); }

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t134p-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { console.log("CDP never came up"); chrome.kill(); process.exit(1); }

const conn = (url, t = 15000) => new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => rej(new Error("ws err")); });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => { try { return (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value; } catch (e) { return "EVAL_ERR:" + e.message; } };
await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");

const logs = [];
ws.addEventListener("message", (m) => {
  const ms = JSON.parse(m.data);
  if (ms.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(ms.params.type)) {
    logs.push(["console." + ms.params.type, (ms.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 400)]);
  }
  if (ms.method === "Runtime.exceptionThrown") {
    const d = ms.params.exceptionDetails;
    logs.push(["exception", (d.exception?.description || d.text || "").slice(0, 400)]);
  }
  if (ms.method === "Log.entryAdded" && ms.params.entry.level === "error") {
    logs.push(["log", (ms.params.entry.text || "").slice(0, 300)]);
  }
});

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 520, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `${BASE}/product/${SLUG}` });
for (let i = 0; i < 30; i++) { if (await ev(`!!document.querySelector('h1')`) === true) break; await sleep(400); }
await sleep(2500);

console.log("=== 1. hydration interactivity (qty + click) ===");
const qty = await ev(`(() => {
  const inp = document.querySelector('input[type="number"], input[inputmode="numeric"]');
  const btns = [...document.querySelectorAll('button')];
  const plus = btns.find(b => (b.getAttribute('aria-label')||'').match(/increase|plus/i) || b.textContent.trim() === '+');
  if (!inp || !plus) return { found: false, inp: !!inp, plus: !!plus };
  const before = inp.value;
  const r = plus.getBoundingClientRect();
  return { found: true, before, cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) };
})()`);
console.log("qty probe:", JSON.stringify(qty));
if (qty?.found) {
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: qty.cx, y: qty.cy, button: "left", clickCount: 1 });
  await sleep(800);
  const after = await ev(`document.querySelector('input[type="number"], input[inputmode="numeric"]')?.value`);
  console.log("qty before:", qty.before, "→ after:", after, "→ hydrated:", after !== qty.before);
} else {
  console.log("qty controls not found as expected:", JSON.stringify(qty));
}

console.log("=== 2. buy-box geometry + scroll mechanics ===");
console.log(await ev(`(() => {
  const wrappers = document.querySelectorAll('div.flex.flex-wrap.items-center.gap-3');
  const el = wrappers[wrappers.length - 1];
  const html = document.documentElement, body = document.body;
  return JSON.stringify({
    wrapperCount: wrappers.length,
    buyBoxTop: el ? Math.round(el.getBoundingClientRect().top) : null,
    bodyScrollHeight: body.scrollHeight,
    htmlScrollHeight: html.scrollHeight,
    innerH: window.innerHeight,
    bodyOverflow: getComputedStyle(body).overflow,
    htmlOverflow: getComputedStyle(html).overflow,
    scrollYNow: window.scrollY,
  });
})()`));

console.log("=== 3. scrollTo bottom → does the window actually scroll? ===");
console.log(await ev(`(() => { window.scrollTo(0, document.body.scrollHeight); return "scrolled"; })()`));
await sleep(1200);
console.log(await ev(`JSON.stringify({
  scrollY: Math.round(window.scrollY),
  maxScroll: document.documentElement.scrollHeight - window.innerHeight,
  bar: !!document.querySelector('[data-sticky-atc]'),
  bodyClass: document.body.classList.contains('pdp-sticky-atc'),
  buyBoxTop: (() => { const w = document.querySelectorAll('div.flex.flex-wrap.items-center.gap-3'); const el = w[w.length-1]; return el ? Math.round(el.getBoundingClientRect().top) : null; })(),
})`));

console.log("=== 4. manual scroll event dispatch (is the listener alive?) ===");
console.log(await ev(`(() => { window.dispatchEvent(new Event('scroll')); return "dispatched"; })()`));
await sleep(1000);
console.log(await ev(`JSON.stringify({ bar: !!document.querySelector('[data-sticky-atc]'), bodyClass: document.body.classList.contains('pdp-sticky-atc') })`));

console.log("=== 5. rAF ticking? ===");
const rafTick = await ev(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })`);
console.log("rAF frames in 500ms:", rafTick);

console.log("=== 6. console/exception log during session ===");
if (logs.length === 0) console.log("(no console errors/warnings/exceptions)");
for (const [k, t] of logs.slice(0, 15)) console.log(`[${k}] ${t}`);

await send("Page.close").catch(() => {});
chrome.kill();
process.exit(0);
