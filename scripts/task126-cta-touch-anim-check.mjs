// Task 126 runtime check: hero "Start shopping" pill (ButtonWithIcon) must
// play its signature choreography — paddings swap (24/56 -> 56/24), arrow
// disc slides right->left (computed right: 4px -> width-44px) and rotates
// 45° — for BOTH pointer classes:
//  - desktop + forced :hover   -> animated state (regression guard)
//  - touch + forced :hover     -> rest look (sticky hover stays inert, Task 125)
//  - REAL press (mousePressed) -> animated state while pressed (THE FIX: v4
//    gates hover: behind @media(hover:hover), so touch devices had no
//    animation at all; :active / group-active: now replay it)
// The press uses Input.dispatchMouseEvent(mousePressed): in this headless
// dispatchTouchEvent does not engage :active at all, while a real mouse press
// produces exactly the same :active activation state a finger does — the
// touch-vs-desktop difference is the pinned media environment, not the press
// mechanics. (dispatchTouchEvent diagnostic kept in git history.)
// Usage: node scripts/task126-cta-touch-anim-check.mjs  (env BASE/W/H/SHOT/MODE)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux/chrome",
];
const DEBUG_PORT = 9355;
const BASE = process.env.BASE || "http://127.0.0.1:3218";
const VP_W = Number(process.env.W || 1440);
const VP_H = Number(process.env.H || 2400);
const SHOT = process.env.SHOT || "/home/z/my-project/download/task126-cta-anim.png";
const MODE = process.env.MODE || "touch"; // "desktop" | "touch"

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Pin the pointer/hover media per mode (this headless defaults to
// hover:none/pointer:coarse): 2/2/4/4 = hover-capable fine pointer (desktop),
// 1/1/2/2 = no-hover coarse pointer (touch phone), so @media(hover:hover)
// matches exactly like the real device class being emulated.
const BLINK = MODE === "touch"
  ? "--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2"
  : "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", BLINK,
  `--user-data-dir=/tmp/chrome-t126-${Date.now()}`,
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
await send("Emulation.setDeviceMetricsOverride", { width: VP_W, height: VP_H, deviceScaleFactor: 1, mobile: MODE === "touch" });
if (MODE === "touch") await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

await send("Page.navigate", { url: `${BASE}/` });
await sleep(5000);
console.log("media features:", await ev(`JSON.stringify({ hoverHover: matchMedia("(hover: hover)").matches, pointerFine: matchMedia("(pointer: fine)").matches })`));

const tagged = await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().includes("Start shopping")); if (!b) return null; b.setAttribute("data-t126", "1"); return true; })()`);
if (!tagged) { console.log("FAIL  start-shopping button not found"); chrome.kill(); process.exit(1); }
const { root } = await send("DOM.getDocument", { depth: -1 });
const btnNode = await send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-t126="1"]` });

// ps/pe = label paddings (EN is LTR so inline-start/end map to left/right),
// dr = disc computed right, angle = disc rotation (v4 rotate: property, with
// a transform-matrix fallback), bw = button width (dr animates to bw - 44).
const probe = () => ev(`(() => {
  const b = document.querySelector('[data-t126="1"]');
  const d = b.querySelector("div[aria-hidden]");
  if (!d) return null;
  const c = getComputedStyle(b), cd = getComputedStyle(d);
  let angle = 0;
  if (cd.rotate && cd.rotate !== "none") angle = Math.abs(parseFloat(cd.rotate));
  else if (cd.transform && cd.transform !== "none") { const m = cd.transform.match(/matrix\\(([^)]+)\\)/); if (m) { const p = m[1].split(",").map(Number); angle = Math.abs(Math.atan2(p[1], p[0]) * 180 / Math.PI); } }
  const r = b.getBoundingClientRect();
  return { act: b.matches(":active"), ps: parseFloat(c.paddingLeft), pe: parseFloat(c.paddingRight), dr: parseFloat(cd.right), angle, bw: r.width };
})()`);
const close = (a, b, t = 1.5) => Math.abs(a - b) <= t;
const isRest = (s) => !!s && close(s.ps, 24) && close(s.pe, 56) && close(s.dr, 4) && s.angle < 2;
const isAnim = (s) => !!s && close(s.ps, 56) && close(s.pe, 24) && close(s.dr, s.bw - 44, 2.5) && s.angle >= 44;
async function force(states) {
  await send("CSS.forcePseudoState", { nodeId: btnNode.nodeId, forcedPseudoClasses: states });
}
// Real activation: mouse down on the button center -> the button (activation
// target) carries :active, so .active:* on it and .group-active:* on the disc
// engage exactly like on a real device press.
async function realPress() {
  const ctr = JSON.parse(await ev(`(() => { const r = document.querySelector('[data-t126="1"]').getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`));
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: ctr.x, y: ctr.y, button: "left", clickCount: 1 });
  await sleep(800); // 200ms active attack + margin
  const down = await probe();
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ctr.x, y: ctr.y, button: "left", clickCount: 1 });
  await sleep(800); // release eases back at 500ms
  const up = await probe();
  return { down, up };
}

const results = {};
const rest0 = await probe();
console.log("rest:", JSON.stringify(rest0));
results["rest: paddings 24/56, disc parked right, angle 0"] = isRest(rest0);

if (MODE === "desktop") {
  await force(["hover"]);
  await sleep(700); // settle past the transition (500ms)
  const h = await probe();
  console.log("desktop hover:", JSON.stringify(h));
  results["desktop hover: paddings 56/24 + disc slides left + rotate 45"] = isAnim(h);
  await shot(SHOT);
  await force([]);
  await sleep(700);
  const r1 = await probe();
  results["desktop release: back to rest"] = isRest(r1);
  const p = await realPress();
  console.log("desktop press:", JSON.stringify(p.down), "release:", JSON.stringify(p.up));
  results["desktop press: :active engaged"] = p.down?.act === true;
  results["desktop press: choreography replays"] = isAnim(p.down);
  results["desktop press release: back to rest"] = isRest(p.up);
} else {
  // sticky hover must stay inert on touch (Task 125 semantics)
  await force(["hover"]);
  await sleep(700);
  const h = await probe();
  console.log("touch sticky hover:", JSON.stringify(h));
  results["touch sticky hover: stays at rest (no animation)"] = isRest(h);
  await force([]);
  await sleep(400);
  // REAL press while the media env says coarse/no-hover: :active must play
  // the full choreography even though hover: is inert.
  const p = await realPress();
  console.log("touch press:", JSON.stringify(p.down), "release:", JSON.stringify(p.up));
  results["touch press: :active engaged"] = p.down?.act === true;
  results["touch press: paddings 56/24 + disc slides left + rotate 45"] = isAnim(p.down);
  await shot(SHOT);
  results["touch release: back to rest"] = isRest(p.up);
}

results["zero page exceptions"] = errors.length === 0;
const failed = Object.entries(results).filter(([, ok]) => !ok);
for (const [k, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${k}`);
console.log("screenshot:", SHOT);
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([k]) => k).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
