// Task 142 — verify the hero artwork / Pay-your-way chip are "taken apart",
// and the raise applies on desktop ONLY.
// Owner ask: separate the chip from the 3D illustration; raise the 3D only
// in the desktop version. Implementation: md:-translate-y-12 on the img
// (Tailwind v4 standalone `translate` property — computed `transform` stays
// "none" but getBoundingClientRect includes the shift), width/height attrs
// synced to the owner's uploaded 1563x938 cut.
// Checks (BASE = argv[2], default local dev):
//  A. SSR HTML: translate class + synced intrinsic attrs present.
//  B. Desktop CDP 1440x900: img raised 48px; chip top edge fully below the
//     img's visual bottom edge -> visually apart.
//  C. Narrow 700x900 (single column, chip visible in the sm..md band): no
//     raise and the chip still overlaps the artwork bottom -> sub-desktop
//     unchanged. (Below sm the chip is hidden by design — 390x844 is a
//     screenshot-only record.)
//  D. Screenshots to download/t142-hero-{desktop,mobile}.png.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- A. SSR fingerprints ----
const html = await (await fetch(BASE + "/", { headers: { "user-agent": "Mozilla/5.0" } })).text();
ok("desktop raise class in SSR (md:-translate-y-12)", html.includes("md:-translate-y-12"));
ok("intrinsic attrs synced to owner's 1563x938 cut", html.includes('width="1563"') && html.includes('height="938"'));
ok("stale 1200x770 attrs gone", !html.includes('width="1200"') || !html.includes('height="770"'));

// ---- CDP harness ----
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("VERDICT: FAIL — no chrome binary"); process.exit(1); }

const DEBUG_PORT = "9372";
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t142-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
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
await send("Page.enable"); await send("Runtime.enable");
const waitFor = async (expr, tries = 30, gap = 400) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };

// Probe: hero img + chip rects (rects include the standalone `translate`
// property), plus the parsed vertical offset from translate/transform.
const probe = `(()=>{const i=document.querySelector('img[src*="hero-shopping-3d"]');if(!i||!i.complete||!i.naturalWidth)return null;
const chip=[...document.querySelectorAll('div')].find(d=>d.className&&String(d.className).includes('-bottom-3')&&d.textContent.includes('Pay your way'));
if(!chip)return null;const ir=i.getBoundingClientRect(),cr=chip.getBoundingClientRect();
const cs=getComputedStyle(i);
let ty=0;const tr=(cs.translate||'none').trim();
if(tr!=='none'){const parts=tr.split(/\\s+/);const last=parseFloat(parts[parts.length-1]);ty=isNaN(last)?0:last;}
else if(cs.transform&&cs.transform.startsWith('matrix')){const m=cs.transform.split(',').map(Number);ty=m[m.length-1];}
return {imgBottom:+ir.bottom.toFixed(1),imgTop:+ir.top.toFixed(1),chipTop:+cr.top.toFixed(1),chipBottom:+cr.bottom.toFixed(1),
translateRaw:tr,ty:+ty.toFixed(1),natural:i.naturalWidth+'x'+i.naturalHeight,
layoutH:Math.round(i.offsetHeight),renderGap:+(cr.top-ir.bottom).toFixed(1)};})()`;

const navViewport = async (w, h, dsf, isMobile) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile: isMobile });
  await send("Page.navigate", { url: BASE + "/" });
  const ready = await waitFor(`(()=>{const i=document.querySelector('img[src*="hero-shopping-3d"]');return !!i&&i.complete&&i.naturalWidth>0&&document.readyState==='complete';})()`);
  await sleep(1200);
  return ready;
};

// ---- B. Desktop 1440x900 ----
let ready = await navViewport(1440, 900, 1, false);
ok("[desktop] page loaded + hero image decoded", !!ready);
let m = await ev(probe);
ok("[desktop] hero img + chip probed", !!m, m && JSON.stringify(m));
ok("[desktop] img raised 48px (translate -48)", !!m && m.ty === -48, m && `translate='${m.translateRaw}' ty=${m.ty}`);
ok("[desktop] chip fully below artwork (taken apart)", !!m && m.renderGap >= 2, m && `gap=${m.renderGap}px`);
let png = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/t142-hero-desktop.png", Buffer.from(png.data, "base64"));
console.log("screenshot: download/t142-hero-desktop.png");

// ---- C. Narrow 700x900 (single column, chip visible) ----
ready = await navViewport(700, 900, 1, false);
ok("[narrow] page loaded + hero image decoded", !!ready);
m = await ev(probe);
ok("[narrow] hero img + chip probed", !!m, m && JSON.stringify(m));
ok("[narrow] no raise below md", !!m && (m.translateRaw === "none" || m.ty === 0), m && `translate='${m.translateRaw}' ty=${m.ty}`);
ok("[narrow] chip still rides artwork bottom (unchanged)", !!m && m.renderGap < 0 && m.chipTop > 0, m && `gap=${m.renderGap}px`);

// ---- D. Phone record screenshot 390x844 (chip hidden <640 by design) ----
await navViewport(390, 844, 2, true);
png = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/t142-hero-mobile.png", Buffer.from(png.data, "base64"));
console.log("screenshot: download/t142-hero-mobile.png (390x844)");

chrome.kill();
const fails = results.filter((r) => !r[1]).length;
console.log(`\nVERDICT: ${fails === 0 ? "PASS" : "FAIL"} (${results.length - fails}/${results.length})`);
process.exit(fails === 0 ? 0 : 1);
