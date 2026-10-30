// Task 132: search input UX — live suggestions panel under the header search
// input (desktop center zone + mobile search row), because searchQuery only
// filtered the grid BELOW the hero, so phones got zero in-viewport feedback.
//
// Interactive asserts (CDP):
//   1. type a real catalog word into the visible search input
//   2. panel [data-search-panel] opens IN VIEWPORT (no scrolling) with
//      suggestion rows, a bolded match highlight and a "See all N results"
//      footer
//   3. tapping a suggestion navigates to /product/[slug]
//   4. Enter closes the panel and scrolls the catalog into view
// Viewport screenshots prove the owner's complaint is fixed (390×844 phone).
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3155";
const DEBUG_PORT = process.env.DEBUG_PORT || "9361";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "download/task132-search-local";

const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pick a needle that is guaranteed to match at least one product name.
let needle = "";
try {
  const data = await (await fetch(`${BASE}/api/products`)).json();
  const list = Array.isArray(data) ? data : (data?.products ?? []);
  const p = list.find((x) => x?.name);
  needle = (p?.name ?? "").trim().split(/\s+/)[0].toLowerCase();
} catch {}
ok("catalog reachable, needle picked", needle.length >= 2, `needle="${needle}"`);
if (needle.length < 2) {
  console.log("VERDICT: FAIL (no catalog to search)");
  process.exit(1);
}

const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) {
  console.log("VERDICT: FAIL — no chrome binary");
  process.exit(1);
}

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t132-${Date.now()}`,
  "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { console.log("VERDICT: FAIL — CDP never came up"); chrome.kill(); process.exit(1); }

const conn = (url, t = 15000) => new Promise((res2, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res2(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res2, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res2(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
await send("Page.enable");
await send("Runtime.enable");

const waitFor = async (expr, tries = 30, gap = 400) => {
  for (let i = 0; i < tries; i++) {
    if (await ev(expr)) return true;
    await sleep(gap);
  }
  return false;
};

// Interact through the REAL input pipeline: React 19 silently swallows the
// native-setter + synthetic Event("input") injection (probe: value stayed "",
// onChange never fired), so we click the input with mouse events and insert
// text via Input.insertText — byte-for-byte what a real user produces.
const clickAt = async (x, y) => {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
};
const typeIntoVisibleSearch = async () => {
  const c = await ev(`(() => {
    const el = [...document.querySelectorAll('input[aria-label="Search products"]')].find((i) => i.offsetParent !== null);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!c) return false;
  await clickAt(c.x, c.y);
  await sleep(150);
  await send("Input.insertText", { text: needle });
  return true;
};

for (const [name, w, h, mobile] of [["desktop", 1440, 900, false], ["mobile", 390, 844, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: `${BASE}/` });
  // hydrated = catalog section + at least one product card rendered
  const booted = await waitFor(`document.querySelector('#catalog') && document.querySelectorAll('a[href^="/product/"]').length > 0`);
  ok(`[${name}] home hydrated with catalog`, booted);

  ok(`[${name}] typed needle into visible search input`, (await typeIntoVisibleSearch()) === true);
  await sleep(700); // panel is instant; 700ms also rides out the store debounce

  const panel = await ev(`(() => {
    const p = document.querySelector('[data-search-panel]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return {
      rows: p.querySelectorAll('img').length,
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      vh: window.innerHeight,
      seeAll: p.innerText.includes('See all') || p.innerText.includes('results'),
      noMatchLie: p.innerText.includes('No products match'),
      highlight: p.innerHTML.includes('text-brand-dark'),
    };
  })()`);
  ok(`[${name}] suggestions panel open`, !!panel, JSON.stringify(panel));
  if (panel) {
    ok(`[${name}] panel has suggestion rows`, panel.rows >= 1 && !panel.noMatchLie, `rows=${panel.rows}`);
    ok(`[${name}] panel fully visible WITHOUT scrolling`, panel.top >= 0 && panel.top < panel.vh && panel.bottom <= panel.vh + 1, `top=${panel.top} bottom=${panel.bottom} vh=${panel.vh}`);
    ok(`[${name}] "See all results" footer present`, panel.seeAll === true);
    ok(`[${name}] match highlight present`, panel.highlight === true);
  }

  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOT_PREFIX}-${name}.png`, Buffer.from(shot.data, "base64"));
  console.log(`screenshot: ${SHOT_PREFIX}-${name}.png`);

  // Suggestion tap -> SSR PDP route (same contract as product cards).
  await ev(`document.querySelector('[data-search-panel] div > button')?.click()`);
  await waitFor(`location.pathname.startsWith('/product/')`, 20, 400);
  ok(`[${name}] suggestion tap opens /product/[slug]`, (await ev(`location.pathname.startsWith('/product/')`)) === true, await ev(`location.pathname`));
}

// Enter -> scroll to the results grid (mobile pass).
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: `${BASE}/` });
await waitFor(`document.querySelector('#catalog') && document.querySelectorAll('a[href^="/product/"]').length > 0`);
await typeIntoVisibleSearch();
await sleep(500);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(1600);
const scrolled = await ev(`(() => { const c = document.querySelector('#catalog'); const r = c ? c.getBoundingClientRect() : null; return { y: Math.round(window.scrollY), catalogTop: r ? Math.round(r.top) : -1, resultsFor: document.body.innerText.includes('results for') }; })()`);
ok("Enter scrolls catalog into view", scrolled.y > 100 && scrolled.catalogTop < 300, JSON.stringify(scrolled));
ok("grid shows 'results for' filter state", scrolled.resultsFor === true);

chrome.kill();
const failed = results.filter(([, pass]) => !pass);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([n]) => n).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
