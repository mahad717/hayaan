// Task 120 local runtime check: GLSL hills canvas mounts inside the hero,
// sized correctly, WebGL context alive, zero page exceptions.
// Usage: node scripts/task120-local-hills-check.mjs   (expects `next start` already on :3210)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9351;
const BASE = process.env.HILLS_BASE || "http://127.0.0.1:3210";
const VP_W = Number(process.env.HILLS_W || 1440);
const VP_H = Number(process.env.HILLS_H || 2400);

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  `--user-data-dir=/tmp/chrome-t120-${Date.now()}`,
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
await sleep(8000); // lazy chunk + hydration + first frames

console.log("hero canvas count:", await ev(`document.querySelectorAll("section canvas").length`));
console.log("canvas size:", await ev(`(() => { const c = document.querySelector("section canvas"); if (!c) return "NO CANVAS"; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, buf: c.width + "x" + c.height }; })()`));
console.log("webgl context:", await ev(`(() => { const c = document.querySelector("section canvas"); return !!c && !!(c.getContext("webgl2") || c.getContext("webgl")); })()`));
// Geometry intent: canvas lives in the LOWER part of the hero, bottom-anchored.
// (Top ~42% of the canvas is dissolved by the wrapper mask, so overlap with
// copy is invisible — screenshots prove legibility, don't re-derive it here.)
console.log("canvas base-pinned:", await ev(`(() => { const c = document.querySelector("section canvas"); const s = document.querySelector("section"); if (!c || !s) return false; const cr = c.getBoundingClientRect(), sr = s.getBoundingClientRect(); return cr.top >= sr.top + sr.height * 0.35 && cr.bottom <= sr.bottom + 2; })()`));
await shot(process.env.HILLS_SHOT || "/home/z/my-project/download/task120-hero-hills-local.png");
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
console.log("DONE");
