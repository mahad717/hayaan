// Task 78 — test whether the homepage main thread settles given patience.
import { spawn } from "node:child_process";
const DEBUG_PORT = 9381;
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 90000);
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
const CHROME = "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome";
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${DEBUG_PORT}`, "--window-size=1440,900",
  "--user-data-dir=/tmp/t78-patience", "about:blank",
], { stdio: "ignore" });
try {
  for (let i = 0; i < 30; i++) {
    try { await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`); break; } catch { await sleep(500); }
  }
  const v = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
  const ws = await connectWs(v.webSocketDebuggerUrl);
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  const loadP = new Promise((res) => {
    const onMsg = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
    ws.addEventListener("message", onMsg);
  });
  const t0 = Date.now();
  await sendCmd(ws, "Page.navigate", { url: `https://hayaan.co/?cb=${Date.now()}` }, sessionId);
  await Promise.race([loadP, sleep(30000)]);
  console.log(`load fired at ${Date.now() - t0}ms; settling 20s…`);
  await sleep(20000);
  const t1 = Date.now();
  const r = await sendCmd(ws, "Runtime.evaluate", { expression: `JSON.stringify({faq: !!document.getElementById("faq-heading"), inFooter: !!document.getElementById("faq-heading")?.closest("footer"), faqTop: document.getElementById("faq-heading")?.getBoundingClientRect().top + window.scrollY, footerTop: document.querySelector("footer")?.getBoundingClientRect().top + window.scrollY})`, returnByValue: true }, sessionId);
  console.log(`evaluate OK in ${Date.now() - t1}ms:`, r.result.value);
} finally {
  chrome.kill("SIGKILL");
}
