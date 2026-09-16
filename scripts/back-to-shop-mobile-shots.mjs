// Task 47 evidence — mobile PDP → tap "Back to shop" → instant homepage.
const DEBUG_PORT = 9333;
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 45000);
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
async function evalJs(ws, sessionId, expression) {
  const { result, exceptionDetails } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
await sendCmd(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }, sessionId);

const loadPromise = new Promise((res) => {
  const onMsg = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
  ws.addEventListener("message", onMsg);
});
await sendCmd(ws, "Page.navigate", { url: "https://hayaan.co/product/carry-canvas-tote" }, sessionId);
await loadPromise;
await sleep(5000);

let shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write("/home/z/my-project/download/back-to-shop-mobile-pdp.png", Buffer.from(shot.data, "base64"));

await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);
await sleep(1200);
const ok = await evalJs(ws, sessionId, `(() => ({ path: location.pathname, hero: !!document.querySelector("h1"), cards: document.querySelectorAll('a[href^="/product/"]').length }))()`);
console.log("after tap:", JSON.stringify(ok));

shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write("/home/z/my-project/download/back-to-shop-mobile-instant.png", Buffer.from(shot.data, "base64"));
console.log("screenshots saved");
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
