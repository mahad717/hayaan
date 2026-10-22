// Task 124 runtime check: the hero primary CTA (ButtonWithIcon "Start
// shopping") must render the same font as the sibling CTA (shadcn Button
// "Browse categories") — font-black font-panton on both (Panton ships
// Bold/Black faces only, so weight matters as much as family).
// Usage: node scripts/task124-cta-font-check.mjs
// Env: BASE (default http://127.0.0.1:3215), W, H, SHOT
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9353;
const BASE = process.env.BASE || "http://127.0.0.1:3215";
const VP_W = Number(process.env.W || 1440);
const VP_H = Number(process.env.H || 2400);
const SHOT = process.env.SHOT || "/home/z/my-project/download/task124-cta-font.png";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t124-${Date.now()}`,
  `--window-size=${VP_W},${VP_H}`, "about:blank",
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
  if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "exception").slice(0, 200));
});
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result?.value; };
const shot = async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); };
await send("Emulation.setDeviceMetricsOverride", { width: VP_W, height: VP_H, deviceScaleFactor: 1, mobile: VP_W < 640 });

await send("Page.navigate", { url: `${BASE}/` });
await sleep(5000);

const probe = await ev(`(async () => {
  await document.fonts.ready;
  const findBtn = (txt) => [...document.querySelectorAll("button")].find(b => b.textContent.trim().includes(txt));
  const p = findBtn("Start shopping");
  const s = findBtn("Browse categories");
  if (!p || !s) return { found: false, hasPrimary: !!p, hasSibling: !!s };
  const cp = getComputedStyle(p), cs = getComputedStyle(s);
  return {
    found: true,
    primaryFamily: cp.fontFamily, primaryWeight: cp.fontWeight,
    siblingFamily: cs.fontFamily, siblingWeight: cs.fontWeight,
    sameFamily: cp.fontFamily === cs.fontFamily,
    sameWeight: cp.fontWeight === cs.fontWeight,
    weight900: cp.fontWeight === "900" && cs.fontWeight === "900",
    pantonLoaded: document.fonts.check('900 16px ' + cp.fontFamily.split(",")[0].replace(/["']/g, "")),
  };
})()`);
console.log("probe:", JSON.stringify(probe, null, 1));

const results = {
  "both CTAs found": probe.found === true,
  "same font family": probe.sameFamily === true,
  "same font weight (900)": probe.sameWeight === true && probe.weight900 === true,
  "panton face loaded": probe.pantonLoaded === true,
  "zero page exceptions": errors.length === 0,
};
const failed = Object.entries(results).filter(([, ok]) => !ok);
for (const [k, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${k}`);
await shot(SHOT);
console.log("screenshot:", SHOT);
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([k]) => k).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
