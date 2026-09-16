// Minimal probe: what does the live homepage actually do in a plain browser?
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
function waitEvent(ws, eventName, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
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
await sendCmd(ws, "Network.enable", {}, sessionId);

const log = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId !== sessionId) return;
  if (m.method === "Network.responseReceived") {
    const r = m.params.response;
    log.push(`RESP ${r.status} ${String(r.mimeType).slice(0, 24)} ${r.url.replace(BASE, "").slice(0, 90)}`);
  }
  if (m.method === "Runtime.exceptionThrown") {
    log.push("EXC " + String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "").slice(0, 200));
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    log.push("CONSOLE " + String(m.params.args?.map(a => a.value || a.description).join(" ")).slice(0, 200));
  }
});

const t0 = Date.now();
const loadPromise = waitEvent(ws, "Page.loadEventFired", 60000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: BASE + "/" }, sessionId);
await loadPromise;
console.log(`load at +${Date.now() - t0}ms`);
await sleep(12000);

const probe = await sendCmd(ws, "Runtime.evaluate", {
  expression: `(async function(){
    const out = {};
    out.title = document.title;
    out.cards = document.querySelectorAll('a[href^="/product/"]').length;
    out.pulse = document.querySelectorAll(".animate-pulse").length;
    out.noProducts = !!Array.from(document.querySelectorAll("p")).find(p => /No products found/.test(p.textContent||""));
    out.demo = !!Array.from(document.querySelectorAll("p")).find(p => /Demo mode/.test(p.textContent||""));
    try {
      const r = await fetch("/api/products", { credentials: "include" });
      out.apiStatus = r.status;
      const j = await r.json().catch(() => null);
      out.apiCount = j && j.products ? j.products.length : "parse-fail";
    } catch (e) { out.apiErr = String(e).slice(0, 120); }
    return out;
  })()`,
  awaitPromise: true,
  returnByValue: true,
}, sessionId);
console.log("PROBE:", JSON.stringify(probe.result.value, null, 1));

console.log("Network log (" + log.length + "):");
for (const l of log.slice(0, 60)) console.log("  " + l);

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
const fs = await import("fs");
fs.mkdirSync("/home/z/my-project/download", { recursive: true });
fs.writeFileSync("/home/z/my-project/download/debug-home-now.png", Buffer.from(shot.data, "base64"));
console.log("screenshot saved");

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
