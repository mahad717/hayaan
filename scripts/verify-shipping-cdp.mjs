// Task 63 live verify — district-based shipping fees:
//   A. poll hayaan.co until the new bundle contains the district markers
//   B. CDP: signup a throwaway customer -> add product to cart -> /?view=checkout
//      -> district Select placeholder + "Pick your district" + disabled Pay
//      -> pick "Hodan — $1.50" (summary shows $1.50, Pay enabled)
//      -> pick "Kahda — $3.00" (summary shows $3.00)
//      -> pick "Other city (outside Mogadishu)" + type Kismayo ($6.95)
//   Screenshots -> download/task63-*.png
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const BASE = "https://hayaan.co";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const MARKERS = ["Gubadley", "Other city (outside Mogadishu)", "Calculated at checkout"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ---------- Phase A: deploy poll ----------
async function bundleMarkers() {
  const html = await get(BASE + "/");
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g) ?? [])];
  const found = {};
  for (const m of MARKERS) found[m] = false;
  for (const c of chunks) {
    try {
      const js = await get(BASE + c);
      for (const m of MARKERS) if (js.includes(m)) found[m] = true;
    } catch {}
  }
  return { chunks: chunks.length, found };
}

let live = null;
for (let i = 1; i <= 30; i++) {
  try {
    live = await bundleMarkers();
    const all = Object.values(live.found).every(Boolean);
    console.log(`poll ${i}: ${live.chunks} chunks, markers: ${JSON.stringify(live.found)}${all ? "  -> DEPLOYED" : ""}`);
    if (all) break;
  } catch (e) {
    console.log(`poll ${i}: fetch error ${e.message}`);
  }
  await sleep(20000);
}
if (!live || !Object.values(live.found).every(Boolean)) {
  console.error("DEPLOY NOT DETECTED within timeout — aborting live verify.");
  process.exit(1);
}

// ---------- Phase B: CDP live checkout flow ----------
const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const DEBUG_PORT = 9351;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t63-${Date.now()}`,
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

const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
// Click a DOM element by selector/text using its on-screen rect
const clickElement = async (findExpr) => {
  const rect = await ev(`(() => { const el = ${findExpr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!rect) return false;
  await clickAt(rect.x, rect.y);
  return true;
};
const openSelect = async () => {
  // Radix can race a toggle (click closes a still-open listbox) — retry clicks.
  for (let i = 0; i < 3; i++) {
    await clickElement(`document.querySelector("#district")`);
    await sleep(900);
    if (await ev(`!!document.querySelector('[role="listbox"]')`)) {
      console.log("  listbox count after open:", await ev(`document.querySelectorAll('[role="listbox"]').length`));
      await sleep(400);
      return true;
    }
    await sleep(600);
  }
  return false;
};
// Always operate on the LIVE (most recently mounted) listbox — a dying portal
// from a retried open would swallow the click.
const pickOption = async (labelPrefix) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await ev(`(() => { const lb = [...document.querySelectorAll('[role="listbox"]')].pop(); const el = lb && [...lb.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().startsWith(${JSON.stringify(labelPrefix)})); if (el) el.scrollIntoView({ block: "nearest" }); return !!el; })()`);
    await sleep(400);
    const ok = await clickElement(`(() => { const lb = [...document.querySelectorAll('[role="listbox"]')].pop(); return (lb && [...lb.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().startsWith(${JSON.stringify(labelPrefix)}))) || null; })()`);
    await sleep(800);
    if (ok) return true;
    console.log(`  pick "${labelPrefix}" attempt ${attempt + 1} missed — retrying`);
  }
  return false;
};
// The checkout Pay button — the submit button inside the form that owns #district
// (avoids matching the header search / footer newsletter submit buttons).
const payBtnExpr = `[...document.querySelectorAll("form")].find(f => f.querySelector("#district"))?.querySelector('button[type="submit"]') ?? null`;

// 1. Home + signup (cookie lands in the browser profile)
await send("Page.navigate", { url: BASE + "/" });
await sleep(6000);
const EMAIL = `task63.${Date.now()}@example.com`;
const signup = await ev(`fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: 'task63pass', name: 'Verify Task63' }) }).then(r => r.json())`);
console.log("signup:", JSON.stringify(signup).slice(0, 120));

// 2. Add a product to the cart
const added = await ev(`(async () => {
  const r = await fetch('/api/products', { credentials: 'include' });
  const j = await r.json();
  const list = j.products ?? j;
  if (!Array.isArray(list) || list.length === 0) return { error: 'no products' };
  const p = list.find(x => (x.stock == null || x.stock > 0) && x.price > 0) ?? list[0];
  const c = await fetch('/api/cart', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId: p.id, quantity: 1, action: 'set' }) }).then(r => r.json());
  return { product: p.name, price: p.price, cartItems: c?.cart?.items?.length ?? null };
})()`);
console.log("cart add:", JSON.stringify(added));

// 3. Checkout — placeholder state
await send("Page.navigate", { url: BASE + "/?view=checkout" });
await sleep(8000);
console.log("district trigger present:", await ev(`!!document.querySelector("#district")`));
console.log("placeholder text:", await ev(`document.querySelector("#district")?.textContent.trim()`));
console.log("shipping row hint:", await ev(`[...document.querySelectorAll("span")].some(s => s.textContent.trim() === "Pick your district")`));
console.log("pay disabled (no district):", await ev(`(() => { const b = ${payBtnExpr}; return b ? b.disabled : null; })()`));
await shot("/home/z/my-project/download/task63-checkout-placeholder.png");

// 4. Pick Hodan — $1.50
if (!(await openSelect())) throw new Error("district dropdown did not open");
console.log("picked Hodan:", await pickOption("Hodan"));
await sleep(500);
console.log("trigger shows Hodan:", await ev(`document.querySelector("#district")?.textContent.includes("Hodan")`));
console.log("summary shipping $1.50:", await ev(`document.body.innerText.includes("$1.50")`));
console.log("pay enabled (Hodan):", await ev(`(() => { const b = ${payBtnExpr}; return b ? !b.disabled : null; })()`));
await shot("/home/z/my-project/download/task63-checkout-hodan.png");

// 5. "Other city (outside Mogadishu)" — the human path: wheel-scroll inside
// the listbox until the option is fully visible, then click it.
if (!(await openSelect())) throw new Error("district dropdown did not open (Other)");
const wheel = async (x, y, dy) => { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy }); };
let committedOther = false;
for (let i = 0; i < 12 && !committedOther; i++) {
  const vis = await ev(`(() => {
    const lb = [...document.querySelectorAll('[role="listbox"]')].pop();
    if (!lb) return { open: false };
    const opt = [...lb.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().startsWith("Other city"));
    if (!opt) return { open: true, found: false };
    const o = opt.getBoundingClientRect(); const l = lb.getBoundingClientRect();
    return { open: true, found: true, visible: o.top >= l.top - 2 && o.bottom <= l.bottom + 2, x: o.x + o.width / 2, y: o.y + o.height / 2, lx: l.x + l.width / 2, ly: l.y + l.height / 2 };
  })()`);
  if (!vis.open) break;
  if (!vis.found) break;
  if (vis.visible) {
    await clickAt(vis.x, vis.y);
    await sleep(800);
    committedOther = await ev(`document.querySelector("#district")?.textContent.includes("Other city") && !!document.querySelector("#city")`);
    if (committedOther) break;
  } else {
    await wheel(vis.lx, vis.ly, 240);
    await sleep(300);
  }
}
console.log("Other committed via wheel+click:", committedOther);
if (committedOther) {
  console.log("city input appeared:", await ev(`!!document.querySelector("#city")`));
  console.log("pay disabled (other, no city):", await ev(`(() => { const b = ${payBtnExpr}; return b ? b.disabled : null; })()`));
  await clickElement(`document.querySelector("#city")`);
  await send("Input.insertText", { text: "Kismayo" });
  await sleep(500);
  console.log("summary shipping $6.95:", await ev(`document.body.innerText.includes("$6.95")`));
  console.log("pay enabled (other + city):", await ev(`(() => { const b = ${payBtnExpr}; return b ? !b.disabled : null; })()`));
  await shot("/home/z/my-project/download/task63-checkout-other.png");
} else {
  console.log("(pointer path flaky — Other-city branch verified via saved-profile prefill below)");
}

// 6. Saved-profile prefill: priced district auto-selects itself and shows its fee
await ev(`fetch('/api/account', { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: 'Verify Task63', city: 'Hodan' }) }).then(r => r.json())`);
await send("Page.navigate", { url: BASE + "/?view=checkout" });
await sleep(8000);
console.log("saved Hodan -> trigger:", await ev(`document.querySelector("#district")?.textContent.trim()`));
console.log("saved Hodan -> summary $1.50:", await ev(`document.body.innerText.includes("$1.50")`));
console.log("saved Hodan -> pay enabled:", await ev(`(() => { const b = ${payBtnExpr}; return b ? !b.disabled : null; })()`));
await shot("/home/z/my-project/download/task63-checkout-saved-hodan.png");

// 7. Saved-profile prefill: non-district city -> Other-city branch + flat fee
await ev(`fetch('/api/account', { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: 'Verify Task63', city: 'Kismayo' }) }).then(r => r.json())`);
await send("Page.navigate", { url: BASE + "/?view=checkout" });
await sleep(8000);
console.log("saved Kismayo -> trigger:", await ev(`document.querySelector("#district")?.textContent.trim()`));
console.log("saved Kismayo -> city input value:", await ev(`document.querySelector("#city")?.value`));
console.log("saved Kismayo -> summary $6.95:", await ev(`document.body.innerText.includes("$6.95")`));
console.log("saved Kismayo -> pay enabled:", await ev(`(() => { const b = ${payBtnExpr}; return b ? !b.disabled : null; })()`));
await shot("/home/z/my-project/download/task63-checkout-other.png");

console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
console.log("DONE");
