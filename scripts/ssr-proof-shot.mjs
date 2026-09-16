// Fresh proof screenshot: mobile viewport, cold full load of "/", cards visible.
import fs from "fs";
const DEBUG_PORT = 9333;
const BASE = "https://hayaan.co";

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

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const sessionId = (await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true })).sessionId;
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await sendCmd(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);
await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId);

await sendCmd(ws, "Page.navigate", { url: BASE + "/" }, sessionId).catch(() => {});
// wait until cards are in the DOM (poll 60s)
let cards = 0;
for (let i = 0; i < 120; i++) {
  await sleep(500);
  try {
    cards = await (await sendCmd(ws, "Runtime.evaluate", {
      expression: `document.querySelectorAll('a[href^="/product/"]').length`,
      returnByValue: true,
    }, sessionId)).result.value;
    if (cards >= 8) break;
  } catch {}
}
console.log("cards in DOM:", cards);
await sleep(45000); // let all images decode fully before paint
let shot = null;
for (let k = 0; k < 6 && !shot; k++) {
  await sleep(3000);
  shot = await sendCmd(ws, "Page.captureScreenshot", { format: "jpeg", quality: 85 }, sessionId).catch(() => null);
  console.log(`screenshot attempt ${k + 1}: ${shot ? "ok" : "failed"}`);
}
if (!shot) throw new Error("screenshot failed after retries");
fs.mkdirSync("/home/z/my-project/download", { recursive: true });
fs.writeFileSync("/home/z/my-project/download/back-to-shop-mobile-ssr.png", Buffer.from(shot.data, "base64"));
console.log("screenshot saved: download/back-to-shop-mobile-ssr.png");
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
