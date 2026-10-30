// Task 135 — share button verification (PDP share+heart pair + blog-post share).
// Dataset-adaptive: PDP slug from PDP_SLUG or /api/products; blog slug from
// BLOG_SLUG or parsed from /blog HTML (posts may be absent in the local seed —
// those asserts then defer to prod, same pattern as the Task 134 WhatsApp lift).
// Headless Chrome has no navigator.share, so the deterministic path here IS the
// fallback menu: WhatsApp / Facebook / X intents captured via a window.open stub
// (test instrumentation), Copy link verified through the real clipboard.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3158";
const DEBUG_PORT = process.env.DEBUG_PORT || "9375";
const PDP_SLUG_OVERRIDE = process.env.PDP_SLUG || "";
const BLOG_SLUG_OVERRIDE = process.env.BLOG_SLUG || "";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "download/task135-share";

const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- dataset-adaptive slugs ----
let PDP = PDP_SLUG_OVERRIDE;
if (!PDP) {
  try {
    const data = await (await fetch(`${BASE}/api/products`)).json();
    const list = Array.isArray(data) ? data : (data?.products ?? []);
    PDP = (list.find((p) => p?.stock > 0) ?? list[0])?.slug || "";
  } catch {}
}
ok("PDP slug picked", (PDP || "").length > 2, `slug="${PDP}"`);
if ((PDP || "").length < 2) { console.log("VERDICT: FAIL (no catalog)"); process.exit(1); }

// ---- chrome over raw CDP ----
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("VERDICT: FAIL — no chrome binary"); process.exit(1); }

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t135-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { console.log("VERDICT: FAIL — CDP never came up"); chrome.kill(); process.exit(1); }

const conn = (url, t = 15000) => new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => rej(new Error("ws err")); });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => { try { return (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value; } catch { return null; } };
// Variant for promise-returning expressions (clipboard reads) — without
// awaitPromise CDP serializes the Promise object itself ({}).
const evA = async (expr) => { try { return (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value; } catch { return null; } };
await send("Page.enable"); await send("Runtime.enable");
const waitFor = async (expr, tries = 30, gap = 300) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
};
const gotoPage = async (url, readyExpr) => {
  await send("Page.navigate", { url });
  if (readyExpr) await waitFor(readyExpr);
  await sleep(1200);
};
// Center of the first element matching `sel`, scrolled into view.
const clickCenter = async (sel) => {
  const pt = await ev(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})][0];
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!pt) return false;
  await sleep(400);
  await clickAt(pt.x, pt.y);
  return true;
};
const shot = async (name) => {
  try {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${SHOT_PREFIX}-${name}.png`, Buffer.from(data, "base64"));
  } catch {}
};

// Clipboard permissions (best-effort; 127.0.0.1 is a secure context either way).
try { await cmd(ws, "Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: BASE }); } catch {}

// ---- MOBILE: PDP share+heart pair, menu, intents, copy ----
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 520, deviceScaleFactor: 2, mobile: true });
await gotoPage(`${BASE}/product/${PDP}`, `document.querySelector('h1')`);

const pair = await ev(`(() => {
  const share = document.querySelector('button[aria-label^="Share "]');
  const heart = document.querySelector('button[aria-label^="Save "], button[aria-label^="Remove "]');
  if (!share) return { share: false };
  const rs = share.getBoundingClientRect();
  const rh = heart ? heart.getBoundingClientRect() : null;
  return { share: true, heart: !!heart, gapOk: !rh || rs.right <= rh.left + 2,
           label: share.getAttribute('aria-label'), menuClosed: !document.querySelector('[role="menu"]') };
})()`);
ok("[mobile] PDP share button renders", pair?.share === true, JSON.stringify(pair?.label ?? null));
ok("[mobile] completes the share+heart pair, no overlap", pair?.heart === true && pair?.gapOk === true);
ok("[mobile] no menu before interaction", pair?.menuClosed === true);

await ev(`window.__opened = []; const __o = window.open; window.open = (u) => { window.__opened.push(String(u)); return null; }; "stubbed"`);

ok("[mobile] click opens the share menu", await clickCenter('button[aria-label^="Share "]') && (await waitFor(`!!document.querySelector('[role="menu"]')`, 10)));
const items = await ev(`[...document.querySelectorAll('[role="menuitem"]')].map(b => b.textContent.trim())`);
ok("[mobile] menu lists WhatsApp/Facebook/X/Copy", ["WhatsApp", "Facebook", "X (Twitter)", "Copy link"].every(l => (items ?? []).some(x => x.includes(l))), JSON.stringify(items));
await shot("pdp-mobile-menu");

const prodUrl = `https://hayaan.co/product/${PDP}`;
const clickItem = async (label) => {
  const sel = `[...document.querySelectorAll('[role="menuitem"]')].find(b => b.textContent.trim().includes(${JSON.stringify(label)}))`;
  const pt = await ev(`(() => { const el = ${sel}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  if (!pt) return false;
  await clickAt(pt.x, pt.y);
  await sleep(600);
  return true;
};
ok("[mobile] WhatsApp intent carries the product URL",
  await clickItem("WhatsApp") &&
  /https:\/\/wa\.me\/\?text=/.test((await ev(`window.__opened[0] ?? ""`)) || "") &&
  decodeURIComponent((await ev(`window.__opened[0] ?? ""`)) || "").includes(prodUrl),
  (await ev(`window.__opened[0] ?? ""`)) || "");

const reopen = async () => { if (!(await ev(`!!document.querySelector('[role="menu"]')`))) { await clickCenter('button[aria-label^="Share "]'); await waitFor(`!!document.querySelector('[role="menu"]')`, 10); } };
await reopen();
ok("[mobile] Facebook sharer carries the product URL",
  await clickItem("Facebook") && ((await ev(`window.__opened[1] ?? ""`)) || "").startsWith("https://www.facebook.com/sharer/sharer.php?u=") &&
  decodeURIComponent((await ev(`window.__opened[1] ?? ""`)) || "").includes(prodUrl),
  (await ev(`window.__opened[1] ?? ""`)) || "");
await reopen();
ok("[mobile] X intent carries title + URL",
  await clickItem("X (Twitter)") && ((await ev(`window.__opened[2] ?? ""`)) || "").startsWith("https://twitter.com/intent/tweet?") &&
  decodeURIComponent((await ev(`window.__opened[2] ?? ""`)) || "").includes(prodUrl),
  (await ev(`window.__opened[2] ?? ""`)) || "");
await reopen();
await clickItem("Copy link");
let toastTxt = "";
for (let i = 0; i < 10; i++) {
  toastTxt = (await ev(`(() => { const t = document.querySelector('[data-sonner-toast]'); return t ? t.textContent : ""; })()`)) || "";
  if (toastTxt.toLowerCase().includes("copied")) break;
  await sleep(300);
}
ok("[mobile] Copy link toasts confirmation", toastTxt.toLowerCase().includes("copied"), JSON.stringify(toastTxt));
const clip = await evA(`navigator.clipboard.readText().catch(() => "")`);
ok("[mobile] clipboard holds the canonical product URL", clip === prodUrl, JSON.stringify(clip));

await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(500);
ok("[mobile] Escape dismisses the menu", (await ev(`!!document.querySelector('[role="menu"]')`)) === false);

// ---- MOBILE: blog post share ----
let BLOG = BLOG_SLUG_OVERRIDE;
if (!BLOG) {
  const html = await (await fetch(`${BASE}/blog`)).text().catch(() => "");
  BLOG = (html.match(/href="\/blog\/([^"#?]+)"/) || [])[1] || "";
}
if (BLOG) {
  await gotoPage(`${BASE}/blog/${BLOG}`, `document.querySelector('h1')`);
  ok("[mobile] blog share button renders", (await ev(`!!document.querySelector('button[aria-label="Share this post"]')`)) === true);
  ok("[mobile] blog click opens the share menu",
    await clickCenter('button[aria-label="Share this post"]') && (await waitFor(`!!document.querySelector('[role="menu"]')`, 10)));
  await ev(`window.__opened = [];`);
  await clickItem("Copy link");
  const blogClip = await evA(`navigator.clipboard.readText().catch(() => "")`);
  ok("[mobile] blog copy holds the post URL", blogClip === `https://hayaan.co/blog/${BLOG}`, JSON.stringify(blogClip));
  await shot("blog-mobile-menu");
} else {
  console.log("NOTE  no published posts behind BASE — blog share asserts deferred to prod verify");
  ok("[mobile] blog share (deferred, no posts here)", true, "no /blog links in listing");
}

// ---- DESKTOP: pair still renders, menu works (h-11 placement) ----
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await gotoPage(`${BASE}/product/${PDP}`, `document.querySelector('h1')`);
const dShare = await ev(`(() => {
  const share = document.querySelector('button[aria-label^="Share "]');
  const heart = document.querySelector('button[aria-label^="Save "], button[aria-label^="Remove "]');
  if (!share || !heart) return null;
  const rs = share.getBoundingClientRect(); const rh = heart.getBoundingClientRect();
  return { sameRow: Math.abs(rs.top - rh.top) < 3, gapOk: rs.right <= rh.left + 2 };
})()`);
ok("[desktop] share+heart pair on the PDP image", dShare?.sameRow === true && dShare?.gapOk === true, JSON.stringify(dShare));
await ev(`window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; "stubbed"`);
if (await clickCenter('button[aria-label^="Share "]')) await waitFor(`!!document.querySelector('[role="menu"]')`, 10);
ok("[desktop] menu opens and WhatsApp intent correct",
  /https:\/\/wa\.me\/\?text=/.test((await ev(`window.__opened[0] ?? ""`)) || "") ||
  (await clickItem("WhatsApp")) && /https:\/\/wa\.me\/\?text=/.test((await ev(`window.__opened[0] ?? ""`)) || ""),
  (await ev(`window.__opened[0] ?? ""`)) || "");
if (BLOG) {
  await gotoPage(`${BASE}/blog/${BLOG}`, `document.querySelector('h1')`);
  ok("[desktop] blog share renders", (await ev(`!!document.querySelector('button[aria-label="Share this post"]')`)) === true);
}

// ---- tally ----
const failed = results.filter(([, p]) => !p);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
console.log(failed.length === 0 ? "VERDICT: PASS" : `VERDICT: FAIL (${failed.map(([n]) => n).join(", ")})`);
await send("Page.close").catch(() => {});
chrome.kill();
process.exit(failed.length === 0 ? 0 : 1);
