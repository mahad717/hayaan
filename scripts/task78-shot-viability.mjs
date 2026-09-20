// Task 78 — minimal screenshot viability test across chrome binaries/flags.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [,, binIdx, portArg, extraFlags] = process.argv;
const BINS = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const PORT = Number(portArg);
function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flags = [
  "--headless=new", "--no-sandbox", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, "--window-size=1440,900",
  `--user-data-dir=/tmp/t78-test-${PORT}`, "about:blank",
];
if (extraFlags !== "keepgpu") flags.splice(2, 0, "--disable-gpu");
const chrome = spawn(BINS[Number(binIdx)], flags, { stdio: "ignore" });
try {
  for (let i = 0; i < 30; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(500); }
  }
  const v = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
  const ws = await connectWs(v.webSocketDebuggerUrl);
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  const loadP = new Promise((res) => {
    const onMsg = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
    ws.addEventListener("message", onMsg);
  });
  await sendCmd(ws, "Page.navigate", { url: `https://hayaan.co/?cb=${Date.now()}` }, sessionId);
  await Promise.race([loadP, sleep(30000)]);
  await sleep(4000);
  try {
    const { data } = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
    writeFileSync(`/tmp/t78-shot-${PORT}.png`, Buffer.from(data, "base64"));
    console.log(`RESULT bin=${binIdx} gpu=${extraFlags === "keepgpu" ? "kept" : "disabled"}: OK`);
  } catch (e) {
    console.log(`RESULT bin=${binIdx} gpu=${extraFlags === "keepgpu" ? "kept" : "disabled"}: FAIL ${String(e).slice(0, 100)}`);
  }
} finally {
  chrome.kill("SIGKILL");
}
