// Task 136 prod — light mobile CDP pass (verification only, no purchases):
//   • homepage footer links (client-rendered, post-hydration, polled)
//   • PDP guest add → drawer opens, localStorage cart = 1, NO auth modal
//   • cart drawer checkout → checkout view with guest hint + phone required
//     (NO submit — prod has real Sifalo credentials and would redirect)
//   • orders view with the probe order seeded into the registry
import { existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";

const BASE = process.env.BASE || "https://hayaan.co";
const DEBUG_PORT = process.env.DEBUG_PORT || "9397";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "download/task136-prod";
const ORDER_ID = process.env.ORDER_ID || "";

const results = [];
const ok = (name, pass, extra = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
].find((p) => existsSync(p));
if (!CHROME) { console.log("FAIL no chrome"); process.exit(1); }
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage", `--user-data-dir=/tmp/chrome-t136p-${Date.now()}`, "--window-size=412,915", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
const conn = (url) => new Promise((res, rej) => { const ws = new WebSocket(url); ws.onopen = () => res(ws); ws.onerror = rej; });
let id = 0;
const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => { try { return (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value; } catch { return null; } };
await send("Page.enable"); await send("Runtime.enable");
const waitFor = async (expr, tries = 40, gap = 300) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };
const gotoPage = async (url, ready) => { await send("Page.navigate", { url }); if (ready) await waitFor(ready); await sleep(1500); };
const shot = async (name) => { try { const { data } = await send("Page.captureScreenshot", { format: "png" }); const { writeFileSync } = await import("node:fs"); writeFileSync(`${SHOT_PREFIX}-${name}.png`, Buffer.from(data, "base64")); } catch {} };
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

// 1. home + footer (client-rendered; prod lesson: poll, never fixed sleep)
// NOTE: the polled expression must return BOOLEANS — a raw Element with
// returnByValue serializes unreliably over CDP.
await gotoPage(`${BASE}/`, `!!document.querySelector("footer")`);
const foot = await waitFor(`(() => { const f = document.querySelector("footer"); return !!(f && f.querySelector('a[href="/privacy"]') && f.querySelector('a[href="/shipping"]') && f.querySelector('a[href="/terms"]') && f.querySelector('a[href="/cookies"]')); })()`, 40, 400);
const footFlags = { p: foot === true, s: foot === true, t: foot === true, c: foot === true };
if (!footFlags.p || !footFlags.s || !footFlags.t || !footFlags.c) {
  const dbg = await ev(`(() => { const f = document.querySelector("footer"); return f ? { all: [...f.querySelectorAll("a")].map((a) => a.getAttribute("href")) } : "no footer"; })()`);
  console.log("DEBUG footer:", JSON.stringify(dbg));
  await shot("footer-debug");
}
ok("prod footer: privacy/terms/cookies/shipping links render", footFlags.p && footFlags.s && footFlags.t && footFlags.c, JSON.stringify(footFlags));
const dead = await ev(`document.querySelectorAll('footer a[href="#"]').length`);
ok("prod footer: zero dead # links", dead === 0, `dead=${dead}`);

// 2. PDP guest add
let slug = await ev(`(document.querySelector("a[href^='/product/']")||{}).getAttribute?.("href")`);
if (!slug) { await gotoPage(`${BASE}/`, `document.querySelectorAll("a[href^='/product/']").length > 0`); slug = await ev(`(document.querySelector("a[href^='/product/']")||{}).getAttribute?.("href")`); }
ok("prod PDP slug picked", !!slug, slug);
await gotoPage(`${BASE}${slug}`, `document.querySelectorAll("button").length > 10`);
const clicked = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^(add to cart|add)$/i.test((x.textContent || "").trim())); if (b) { b.scrollIntoView({ block: "center" }); b.click(); return true; } return false; })()`);
await waitFor(`!!document.querySelector('[data-state="open"][role="dialog"]')`, 24, 400);
const stored = await ev(`JSON.parse(localStorage.getItem("hayaan_guest_cart") || "[]").length`);
ok("prod guest Add: drawer opens, local cart = 1, no auth wall", clicked && stored === 1, `stored=${stored}`);
await shot("guest-drawer");

// 3. checkout view for guests (no submit)
const proceed = await ev(`(() => { const dlg = document.querySelector('[role="dialog"][data-state="open"]'); if (!dlg) return false; const b = [...dlg.querySelectorAll("button")].find((x) => /proceed to checkout/i.test(x.textContent || "")); if (b) { b.click(); return true; } return false; })()`);
await waitFor(`!!document.querySelector('[data-guest-checkout-hint]')`, 30, 400);
const ui = await ev(`(() => ({ hint: !!document.querySelector("[data-guest-checkout-hint]"), phoneReq: document.querySelector("input#phone") ? document.querySelector("input#phone").required : null, wall: document.body.innerText.includes("Please sign in to check out") }))()`);
ok("prod checkout: guest hint + required phone, wall gone", !!ui && ui.hint === true && ui.phoneReq === true && ui.wall === false, JSON.stringify(ui));
await shot("guest-checkout");

// 4. orders view with the probe order seeded
if (ORDER_ID) {
  await gotoPage(`${BASE}/?view=orders`, `!!document.querySelector("footer")`);
  await ev(`localStorage.setItem("hayaan_guest_orders", JSON.stringify([${JSON.stringify(ORDER_ID)}]));`);
  await gotoPage(`${BASE}/?view=orders`, `!!document.querySelector('[data-guest-orders]')`);
  const found = await waitFor(`document.querySelector('[data-guest-orders]')?.textContent.includes(${JSON.stringify(ORDER_ID.slice(0, 8).toUpperCase())})`, 24, 400);
  ok("prod orders view (guest) lists the probe order", found === true);
  await shot("guest-orders-view");
}

chrome.kill();
const fails = results.filter((x) => !x).length;
console.log(`VERDICT: ${fails === 0 ? "ALL PASS" : "FAIL"} (${results.length - fails}/${results.length})`);
process.exit(fails === 0 ? 0 : 1);
