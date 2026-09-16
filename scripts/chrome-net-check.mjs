// Discriminator: is chrome's networking broken entirely, or hayaan-specific?
import fs from "fs";
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 20000);
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
function waitEvent(ws, eventName, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    const onMsg = (ev) => {
      if (JSON.parse(ev.data).method === eventName) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        resolve(true);
      }
    };
    ws.addEventListener("message", onMsg);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

async function visit(url, settleMs) {
  const t0 = Date.now();
  const lp = waitEvent(ws, "Page.loadEventFired", 25000);
  await sendCmd(ws, "Page.navigate", { url }, sessionId).catch(() => {});
  const loaded = await lp;
  await sleep(settleMs);
  let info = null;
  try {
    const r = await sendCmd(ws, "Runtime.evaluate", { expression: `document.title + " | " + location.href + " | bytes=" + document.documentElement.outerHTML.length`, returnByValue: true }, sessionId);
    info = r.result.value;
  } catch (e) { info = "EVAL-FAIL: " + e.message; }
  console.log(`${url} -> load=${loaded ? "yes" : "NO"} in ${Date.now() - t0}ms | ${info}`);
  return loaded;
}

await visit("https://example.com", 500);
await visit("https://www.cloudflare.com/cdn-cgi/trace", 500);
await visit("https://hayaan.co/", 8000);

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId).catch(() => null);
if (shot) {
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync("/home/z/my-project/download/debug-home-now.png", Buffer.from(shot.data, "base64"));
  console.log("screenshot saved");
}

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
