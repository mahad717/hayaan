// Task 131 — screenshot the footer bottom bar (Androva partner backlink).
// Reuses the task130 CDP pattern; viewport shot AFTER scrolling to the
// footer (captureBeyondViewport would render it, but we want the visual
// context the way a user sees it).
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3222";
const DEBUG_PORT = process.env.DEBUG_PORT || "9361";
const OUT = process.env.OUT || "download/task131-footer-local.png";

const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
].find((p) => existsSync(p));
if (!CHROME) { console.log("SKIPPED: no chrome binary"); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage",
  `--user-data-dir=/tmp/chrome-t131-${Date.now()}`,
  "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
try {
  let v = null;
  for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
  if (!v) throw new Error("cdp never came up");
  const conn = (url, t = 15000) => new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; });
  let id = 0;
  const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
  const ws = await conn(v.webSocketDebuggerUrl);
  const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  const send = (m, p) => cmd(ws, m, p, sessionId);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/` });
  await sleep(5000);
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, document.body.scrollHeight)" });
  await sleep(1500);
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(r.data, "base64"));
  console.log("screenshot:", OUT);
} finally {
  chrome.kill();
}
