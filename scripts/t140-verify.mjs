// Task 140 — prod verification: hero collage replaced by the owner's 3D
// online-shopping render, Pay-your-way chip intact.
//  A. HTML fingerprints (plain fetch): new asset present, old 4 collage
//     sources gone, chip copy present, alt3d in SSR.
//  B. Asset HEAD: /images/hero-shopping-3d.webp -> 200 image/webp.
//  C. CDP screenshots (desktop 1440x900 + mobile 390x844) with hydration
//     polling (Task 134 lesson: poll, never fixed sleep) + hero img decode
//     wait + console error count.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const BASE = "https://hayaan.co";
const DEBUG_PORT = "9366";
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- A. HTML fingerprints ----
const html = await (await fetch(BASE + "/", { headers: { "user-agent": "Mozilla/5.0" } })).text();
ok("new hero asset in SSR HTML", html.includes('/images/hero-shopping-3d.webp'));
ok("old unsplash hero img gone", !html.includes("photo-1505740420928-5e560c06d30e?w=600"));
ok("old supabase hero img gone", !html.includes("1788725484435-41dd6a71"));
ok("old supabase hero img 4 gone", !html.includes("1788725481334-42782eff"));
ok("Pay-your-way chip intact (EN copy)", html.includes("Pay your way") && html.includes("EVC Plus"));
ok("alt3d present in SSR", html.includes("a courier delivers an order straight from the phone"));

// ---- B. asset HEAD ----
const head = await fetch(BASE + "/images/hero-shopping-3d.webp", { method: "HEAD" });
ok("hero webp served 200 image/webp", head.status === 200 && (head.headers.get("content-type") || "").includes("image/webp"),
   `${head.status} ${head.headers.get("content-type")} ${(head.headers.get("content-length") || "?")}B`);

// ---- C. CDP screenshots ----
const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("VERDICT: FAIL — no chrome binary"); process.exit(1); }

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t140-${Date.now()}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
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
let consoleErrors = 0;
ws.addEventListener("message", (e2) => { try { const m = JSON.parse(e2.data); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors++; if (m.method === "Runtime.exceptionThrown") consoleErrors++; } catch {} });
const waitFor = async (expr, tries = 30, gap = 400) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return true; await sleep(gap); } return false; };

const shot = async (name, mobile) => {
  if (mobile) {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  await send("Page.navigate", { url: BASE + "/" });
  const ready = await waitFor(
    `(()=>{const i=document.querySelector('img[src*="hero-shopping-3d"]');return !!i&&i.complete&&i.naturalWidth>0&&document.readyState==='complete';})()`,
    30, 400);
  ok(`[${name}] page loaded + hero image decoded`, !!ready);
  await sleep(1200); // beams animation + chip paint settle
  const metrics = await ev(`(()=>{const i=document.querySelector('img[src*="hero-shopping-3d"]');if(!i)return null;const r=i.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),natural:i.naturalWidth+'x'+i.naturalHeight};})()`);
  ok(`[${name}] hero img rendered with real size`, !!metrics && metrics.w > 200, JSON.stringify(metrics));
  const chip = await ev(`(()=>{const els=[...document.querySelectorAll('div')].filter(d=>d.className&&String(d.className).includes('-bottom-3'));return els.some(d=>d.textContent.includes('Pay your way')&&d.textContent.includes('EVC Plus'))&&getComputedStyle(els[0]).display!=='none';})()`);
  if (!mobile) ok("[desktop] Pay-your-way chip visible over artwork", !!chip);
  const png = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`/home/z/my-project/download/t140-hero-${name}.png`, Buffer.from(png.data, "base64"));
  console.log(`screenshot: download/t140-hero-${name}.png`);
};

await shot("desktop", false);
await shot("mobile", true);
ok("[mobile] zero console errors", consoleErrors === 0, `${consoleErrors} errors`);

chrome.kill();
const fails = results.filter((r) => !r[1]).length;
console.log(`\nVERDICT: ${fails === 0 ? "PASS" : "FAIL"} (${results.length - fails}/${results.length})`);
process.exit(fails === 0 ? 0 : 1);
