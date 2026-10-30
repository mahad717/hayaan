// Task 133 — UX audit: live-site walkthrough of https://hayaan.co
// Mobile-first (390x844), desktop spot-check (1440x900).
// Navigates the full journey, screenshots each stop, extracts DOM facts.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "https://hayaan.co";
const DEBUG_PORT = process.env.DEBUG_PORT || "9363";
const OUT = "/tmp/audit-shots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t133-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { console.log("no CDP"); process.exit(1); }
const conn = (url, t = 20000) => new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => rej(new Error("ws timeout")), t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => rej(new Error("ws err")); });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 60000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
await send("Page.enable"); await send("Runtime.enable");
const waitFor = async (expr, tries = 40, gap = 400) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };

let shotN = 0;
const shot = async (name) => {
  const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  const p = `${OUT}/${String(++shotN).padStart(2, "0")}-${name}.jpg`;
  writeFileSync(p, Buffer.from(s.data, "base64"));
  console.log("SHOT", p);
};
const facts = {};
const record = (k, val) => { facts[k] = val; console.log("FACT", k, JSON.stringify(val).slice(0, 400)); };
const goto = async (url, readyExpr) => {
  await send("Page.navigate", { url });
  if (readyExpr) await waitFor(readyExpr);
  await sleep(1200);
};
const clickCenter = async (sel) => {
  const c = await ev(`(() => { const el = ${sel}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  if (!c) return false;
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c.x, y: c.y, button: "left", clickCount: 1 });
  return true;
};

const mobile = async () => {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  // ---- HOME ----
  await goto(`${BASE}/`, `document.querySelector('#catalog') && document.querySelectorAll('a[href^="/product/"]').length > 0`);
  await shot("home-top");
  record("home.aboveFold", await ev(`(() => { const h = document.querySelector('header'); return { headerH: h ? Math.round(h.getBoundingClientRect().height) : 0, firstSection: document.querySelector('main > section, main > div')?.className?.slice(0, 80) ?? null }; })()`));
  record("home.cardAnatomy", await ev(`(() => { const card = document.querySelector('a[href^="/product/"]'); if (!card) return null; return { hasImg: !!card.querySelector('img'), hasStars: !!card.querySelector('[class*="star"], svg'), text: card.innerText.replace(/\\n/g, ' | ').slice(0, 160) }; })()`));
  record("home.navLinks", await ev(`[...document.querySelectorAll('header a, header button')].map(a => (a.getAttribute('aria-label') || a.innerText.trim()).slice(0, 30)).filter(Boolean).slice(0, 25)`));
  // scroll to grid
  await ev(`document.querySelector('#catalog')?.scrollIntoView()`);
  await sleep(700);
  await shot("home-grid");
  // footer
  await ev(`window.scrollTo(0, document.body.scrollHeight - 900)`);
  await sleep(700);
  await shot("home-footer");
  record("footer.links", await ev(`[...document.querySelectorAll('footer a')].map(a => a.innerText.trim().slice(0, 40) || a.getAttribute('href')).slice(0, 30)`));
  record("whatsapp.float", await ev(`(() => { const w = [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]')]; return w.map(x => ({ href: x.href.slice(0, 60), fixed: getComputedStyle(x).position })); })()`));

  // ---- SEARCH → SEE ALL → GRID ----
  const c = await ev(`(() => { const el = [...document.querySelectorAll('input[aria-label="Search products"]')].find((i) => i.offsetParent !== null); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  if (c) {
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c.x, y: c.y, button: "left", clickCount: 1 });
    await sleep(200);
    await send("Input.insertText", { text: "phone" });
    await sleep(900);
    await shot("search-panel");
    record("search.panelFacts", await ev(`(() => { const p = document.querySelector('[data-search-panel]'); return p ? { rows: p.querySelectorAll('img').length, footer: p.innerText.split('\\n').pop() } : null; })()`));
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
    await sleep(1800);
    await shot("search-results");
    record("search.gridFacts", await ev(`(() => { const b = document.body.innerText; return { resultsFor: b.includes('results for'), sortControl: !!document.querySelector('select'), anyFilterBtn: [...document.querySelectorAll('button')].map(x => x.innerText.trim()).filter(t => /^(Filter|Sort|All|Under)/i.test(t)).slice(0, 8), count: document.querySelectorAll('#catalog a[href^="/product/"]').length }; })()`));
  }

  // ---- CATEGORY PAGE ----
  await goto(`${BASE}/category/phones-wearables`, `document.body.innerText.length > 500`);
  await sleep(800);
  await shot("category");
  record("category.facts", await ev(`(() => ({ h1: document.querySelector('h1')?.innerText?.slice(0, 60) ?? null, cards: document.querySelectorAll('a[href^="/product/"]').length, sort: !!document.querySelector('select'), filters: [...document.querySelectorAll('button, select, input[type=range]')].length, url: location.pathname }))()`));

  // ---- PDP ----
  await goto(`${BASE}/product/samsung-galaxy-a18`, `document.body.innerText.length > 500`);
  await sleep(1200);
  await shot("pdp-top");
  record("pdp.anatomy", await ev(`(() => { const b = document.body.innerText; const btns = [...document.querySelectorAll('button')].map(x => x.innerText.trim()).filter(Boolean); return { imgs: document.querySelectorAll('img').length, h1: document.querySelector('h1')?.innerText?.slice(0, 50) ?? null, hasQty: /quantity|qty|-\\s*\\+|\\+\\s*-/i.test(b), btnWords: btns.slice(0, 14), hasReviews: /review/i.test(b), hasStock: /stock|in stock|out of/i.test(b), hasDelivery: /deliver|shipping|days/i.test(b), price: b.match(/\\$[0-9.]+/)?.[0] ?? null }; })()`));
  record("pdp.sections", await ev(`(() => [...document.querySelectorAll('section, [class*="related"], [class*="review"]')].slice(0, 12).map(s => (s.querySelector('h2,h3')?.innerText || s.getAttribute('class') || '').slice(0, 40)))()`));
  await ev(`window.scrollBy(0, 700)`); await sleep(600); await shot("pdp-mid");
  record("pdp.stickyBar", await ev(`(() => { const sticks = [...document.querySelectorAll('div,button')].filter(el => { const s = getComputedStyle(el); return s.position === 'fixed' && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 200 && el.getBoundingClientRect().top > 500; }); return sticks.map(s => s.innerText.slice(0, 40) || s.getAttribute('aria-label')).slice(0, 6); })()`));

  // ---- CART DRAWER ----
  const cartBtn = `document.querySelector('button[aria-label*="cart" i], a[aria-label*="cart" i]')`;
  const opened = await clickCenter(cartBtn);
  await sleep(1000);
  await shot("cart-drawer");
  record("cart.facts", await ev(`(() => { const b = document.body.innerText; return { drawerOpened: ${opened}, hasSubtotal: /subtotal|total/i.test(b), hasQty: !!document.querySelector('[class*="drawer"] button'), freeShip: /free ship/i.test(b), text: b.slice(0, 100) }; })()`));
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(400);

  // ---- ORDERS / ACCOUNT ----
  record("auth.entry", await ev(`(() => { const b = document.body.innerText; return { hasSignIn: /sign in|login/i.test(b), hasOrders: /orders/i.test(b) }; })()`));
};

const desktop = async () => {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(`${BASE}/product/samsung-galaxy-a18`, `document.body.innerText.length > 500`);
  await sleep(1000);
  await shot("dt-pdp");
  record("dt.pdpLayout", await ev(`(() => ({ galleryImgs: document.querySelectorAll('img').length, cols: getComputedStyle(document.querySelector('main')).gridTemplateColumns.split(' ').length, related: /related|you may/i.test(document.body.innerText) }))()`));
};

await mobile();
await desktop();
writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 2));
console.log("DONE — facts written");
chrome.kill();
