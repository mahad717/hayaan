// Task 144 — verify the owner-marked hero text badge is gone.
// Owner ask: "Remove the text I marked for you" (red circle on the
// "Fixed USD prices — no VAT" pill above the H1). Removed: the <span> badge
// (Sparkles icon + t("hero.badge")) in hero.tsx, the hero.badge key in both
// EN and SO dictionaries, and the unused Sparkles import.
// The Pay-your-way chip on the artwork is NOT touched (Task 142 element).
// Checks (BASE = argv[2], default local dev):
//  A. SSR HTML: badge text + badge markup fingerprints gone; hero core intact.
//  B. Desktop CDP 1440x900: no badge text in live DOM, hero H1 first in copy
//     column, Pay-your-way chip still present.
//  C. SO runtime toggle: switch to Somali, "Qiimo USD oo go'an" absent while
//     the SO H1 renders (proves the SO key removal, not just EN).
//  D. Screenshots download/t144-hero-{desktop,mobile}.png.
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
ok("EN badge text gone from SSR", !html.includes("Fixed USD prices"));
// NOTE: the removed badge's unique class combo (w-fit + gap-1.5 + bg-white).
// A generic "px-3 py-1" fingerprint is useless here — the search input uses it too.
ok("badge pill markup gone (unique class fingerprint)", !html.includes("w-fit items-center gap-1.5 rounded-full bg-white"));
ok("hero artwork still served (v2 asset)", html.includes("hero-shopping-3d-v2"));
ok("hero H1 still first copy element", html.includes("Find what you need,"));
ok("hero subtitle intact", html.includes("Mogadishu and across Somalia"));
ok("Pay-your-way chip intact (Task 142)", html.includes("Pay your way") && html.includes("EVC Plus"));
ok("stale attrs still absent (t141 hold)", !html.includes('width="1200"'));

// ---- CDP harness (same pattern as t142) ----
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("VERDICT: FAIL — no chrome binary"); process.exit(1); }

const DEBUG_PORT = "9373";
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t144-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
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

const navViewport = async (w, h, dsf, isMobile) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile: isMobile });
  await send("Page.navigate", { url: BASE + "/" });
  const ready = await waitFor(`(()=>{const i=document.querySelector('img[src*="hero-shopping-3d"]');return !!i&&i.complete&&i.naturalWidth>0&&document.readyState==='complete';})()`);
  await sleep(1200);
  return ready;
};

// Live-DOM probes: badge gone, H1 headline + chip + artwork present.
const probe = `(()=>{const txt=document.body.innerText;
return {enBadge:txt.includes('Fixed USD prices'),
soBadge:txt.includes('Qiimo USD oo go'),
h1:!!document.querySelector('h1'),
h1Text:(document.querySelector('h1')||{}).innerText||'',
chip:txt.includes('Pay your way'),
img:!!document.querySelector('img[src*="hero-shopping-3d-v2"]')};})()`;

// ---- B. Desktop 1440x900 (EN) ----
let ready = await navViewport(1440, 900, 1, false);
ok("[desktop] page loaded + hero image decoded", !!ready);
let m = await ev(probe);
ok("[desktop] EN badge absent in live DOM", !!m && !m.enBadge, m && JSON.stringify(m));
ok("[desktop] SO badge absent in live DOM", !!m && !m.soBadge);
ok("[desktop] H1 present, starts with headline", !!m && m.h1 && m.h1Text.startsWith("Find what you need"), m && `h1='${(m.h1Text||'').slice(0,40)}'`);
ok("[desktop] Pay-your-way chip still live", !!m && m.chip);
ok("[desktop] artwork img still live", !!m && m.img);
let png = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/t144-hero-desktop.png", Buffer.from(png.data, "base64"));
console.log("screenshot: download/t144-hero-desktop.png");

// ---- C. SO runtime toggle (client-side language switch) ----
const clicked = await ev(`(()=>{const btn=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='SO');
if(!btn)return false;btn.click();return true;})()`);
await sleep(1200);
m = await ev(probe);
ok("[SO] language toggle clicked", !!clicked);
ok("[SO] SO H1 renders (toggle really worked)", !!m && (m.h1Text || "").includes("Hel waxa aad u baahan"), m && `h1='${(m.h1Text||'').slice(0,40)}'`);
ok("[SO] SO badge text absent after toggle", !!m && !m.soBadge && !m.enBadge);

// ---- D. Phone record screenshot 390x844 ----
await navViewport(390, 844, 2, true);
png = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/t144-hero-mobile.png", Buffer.from(png.data, "base64"));
console.log("screenshot: download/t144-hero-mobile.png (390x844)");

chrome.kill();
const fails = results.filter((r) => !r[1]).length;
console.log(`\nVERDICT: ${fails === 0 ? "PASS" : "FAIL"} (${results.length - fails}/${results.length})`);
process.exit(fails === 0 ? 0 : 1);
