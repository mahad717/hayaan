// Task 125 runtime check: the "Browse categories" outline CTA must never be
// white-on-cream. States asserted (computed styles on the button):
//  - desktop + forced :hover  -> brand-green fill rgb(20,83,45) + white label
//  - mobile + forced :hover   -> label stays green rgb(20,83,45), fill light
//    (touch devices must not enter the flip — v4 hover utilities are
//    @media(hover:hover)-gated; the components flip is now gated too)
//  - mobile + forced :active  -> darker green fill rgb(11,59,34) + white label
//    (press feedback: fill and label change together)
// Usage: node scripts/task125-cta-hover-check.mjs  (env BASE/W/H/SHOT/MODE)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9354;
const BASE = process.env.BASE || "http://127.0.0.1:3216";
const VP_W = Number(process.env.W || 1440);
const VP_H = Number(process.env.H || 2400);
const SHOT = process.env.SHOT || "/home/z/my-project/download/task125-cta-hover.png";

const GREEN = "rgb(20, 83, 45)";        // --primary #14532d
const GREEN_DARK = "rgb(11, 59, 34)";   // --hayaan-green-dark #0b3b22
const WHITE = "rgb(255, 255, 255)";

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Headless here defaults to hover:none/pointer:coarse — pin the pointer/hover
// media explicitly per mode via blink settings (2 = hover/2 = coarse pointer
// ... 4 = fine pointer), so @media (hover:hover) and (pointer:fine) matches
// exactly like the real device class being emulated.
const BLINK = VP_W < 640
  ? "--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2"
  : "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", BLINK,
  `--user-data-dir=/tmp/chrome-t125-${Date.now()}`,
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
await send("DOM.enable"); await send("CSS.enable");
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
console.log("media features:", await ev(`JSON.stringify({ hoverHover: matchMedia("(hover: hover)").matches, pointerFine: matchMedia("(pointer: fine)").matches })`));

const { root } = await send("DOM.getDocument", { depth: -1 });
const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: `button[data-slot="button"]` });
// find the Browse categories button node via JS to be locale-safe, then map to a nodeId
const btnInfo = await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().includes("Browse categories")); if (!b) return null; b.setAttribute("data-t125", "1"); return true; })()`);
if (!btnInfo) { console.log("FAIL  browse-categories button not found"); chrome.kill(); process.exit(1); }
const btnNode = await send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-t125="1"]` });

async function styles() {
  return ev(`(() => { const b = document.querySelector('[data-t125="1"]'); const c = getComputedStyle(b); return { color: c.color, bg: c.backgroundColor }; })()`);
}
async function force(states) {
  await send("CSS.forcePseudoState", { nodeId: btnNode.nodeId, forcedPseudoClasses: states });
}

const results = {};
if (process.env.MODE === "desktop") {
  await force(["hover"]);
  await sleep(700); // settle past the 500ms transition-all
  const h = await styles();
  console.log("desktop hover:", JSON.stringify(h));
  results["desktop hover: green fill"] = h.bg === GREEN;
  results["desktop hover: white label"] = h.color === WHITE;
  await force([]);
} else {
  // touch: sticky hover after tap must NOT flip the label
  await force(["hover"]);
  await sleep(700);
  const h = await styles();
  console.log("mobile sticky hover:", JSON.stringify(h));
  results["touch sticky hover: label stays green"] = h.color === GREEN;
  results["touch sticky hover: no green fill (rest look)"] = h.bg !== GREEN && h.bg !== GREEN_DARK;
  await force([]);
  await sleep(700);
  // press feedback: :active flips fill+label together
  await force(["active"]);
  await sleep(700);
  const a = await styles();
  console.log("mobile active:", JSON.stringify(a));
  results["touch press: green-dark fill"] = a.bg === GREEN_DARK;
  results["touch press: white label"] = a.color === WHITE;
  await force([]);
}

results["zero page exceptions"] = errors.length === 0;
const failed = Object.entries(results).filter(([, ok]) => !ok);
for (const [k, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${k}`);
await shot(SHOT);
console.log("screenshot:", SHOT);
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([k]) => k).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
