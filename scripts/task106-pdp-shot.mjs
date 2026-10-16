// Task 106 — PDP screenshot (visual regression: Back-to-shop Link -> plain <a>).
import fs from "node:fs";

const DEBUG_PORT = 9338;
function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
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
const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);
const loadP = new Promise((resolve) => {
  const onMsg = (ev) => {
    if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); resolve(); }
  };
  ws.addEventListener("message", onMsg);
});
await sendCmd(ws, "Page.navigate", { url: "https://hayaan.co/product/samsung-galaxy-a18" }, sessionId);
await loadP;
await new Promise((r) => setTimeout(r, 3500));
const backInfo = await sendCmd(ws, "Runtime.evaluate", { expression: `(() => { const a = Array.from(document.querySelectorAll('a[href="/"]')).find(x => /Back to shop/.test(x.textContent||"")); if (!a) return null; const r = a.getBoundingClientRect(); return { tag: a.tagName, classes: a.className.slice(0, 80), text: a.textContent.trim(), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; })()`, returnByValue: true }, sessionId);
console.log("back-link:", JSON.stringify(backInfo.result.value));
const shot = await sendCmd(ws, "Page.captureScreenshot", {}, sessionId);
fs.writeFileSync("/home/z/my-project/download/task106-pdp-backlink.png", Buffer.from(shot.data, "base64"));
console.log("saved download/task106-pdp-backlink.png");
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
