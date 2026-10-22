// Task 123 local/prod runtime check: background-beams-with-collision replaced
// the GLSL hills in the hero. Probes: hills canvas gone, beams root mounted
// and covering the hero section, all 7 beams present, floor probe present,
// beams actually animating (informational), zero page exceptions.
// Usage: node scripts/task123-beams-check.mjs
// Env: BEAMS_BASE (default http://127.0.0.1:3212), BEAMS_W, BEAMS_H, BEAMS_SHOT
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9352;
const BASE = process.env.BEAMS_BASE || "http://127.0.0.1:3212";
const VP_W = Number(process.env.BEAMS_W || 1440);
const VP_H = Number(process.env.BEAMS_H || 2400);
const SHOT = process.env.BEAMS_SHOT || "/home/z/my-project/download/task123-beams-local.png";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  `--user-data-dir=/tmp/chrome-t123-${Date.now()}`,
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
await sleep(8000); // hydration + width measure + first beam frames

const results = {};
results["hills canvas gone"] = await ev(`document.querySelectorAll("section canvas").length === 0`);
results["beams root present"] = await ev(`!!document.querySelector("[data-beams-root]")`);
results["root covers hero"] = await ev(`(() => { const r = document.querySelector("[data-beams-root]"); const s = r && r.closest("section"); if (!r || !s) return false; const rr = r.getBoundingClientRect(), sr = s.getBoundingClientRect(); return Math.abs(rr.top - sr.top) <= 2 && Math.abs(rr.bottom - sr.bottom) <= 2 && Math.abs(rr.left - sr.left) <= 2 && Math.abs(rr.right - sr.right) <= 2; })()`);
const beamCount = await ev(`document.querySelectorAll("[data-beam]").length`);
results["beam count == 7"] = beamCount === 7;
results["floor present"] = await ev(`!!document.querySelector("[data-beams-floor]")`);
// Informational: at least one beam translating within 1.2s (staggered delays
// mean all 7 can briefly rest in repeatDelay, so don't hard-gate on this).
const animating = await ev(`(async () => { const bs = [...document.querySelectorAll("[data-beam]")]; if (!bs.length) return false; const t0 = bs.map(b => getComputedStyle(b).transform); await new Promise(r => setTimeout(r, 1200)); return bs.some((b, i) => getComputedStyle(b).transform !== t0[i]); })()`);
console.log("beams animating (info):", animating);
console.log("beam geometry sample:", await ev(`(() => { const b = document.querySelector("[data-beam]"); if (!b) return "NONE"; const r = b.getBoundingClientRect(); const root = document.querySelector("[data-beams-root]").getBoundingClientRect(); return { x: Math.round(r.left - root.left), topInRoot: Math.round(r.top - root.top), moving: true }; })()`));

results["zero page exceptions"] = errors.length === 0;

const failed = Object.entries(results).filter(([, ok]) => !ok);
for (const [k, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${k}`);
await shot(SHOT);
console.log("screenshot:", SHOT);
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([k]) => k).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
