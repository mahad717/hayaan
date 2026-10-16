// Task 105b — hydrated client-nav check (standalone, sandbox-flake resilient)
const DEBUG_PORT = 9338;
const BASE = "https://hayaan.co";
const PDP = `${BASE}/product/samsung-galaxy-a18`;

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
async function evalJs(ws, sessionId, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await sendCmd(
    ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, sessionId
  );
  if (exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(exceptionDetails).slice(0, 200)}`);
  return result.value;
}
async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId, sessionId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId: s } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, s);
await sendCmd(ws, "Runtime.enable", {}, s);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, s);
await sendCmd(ws, "Emulation.setCPUThrottlingRate", { rate: 4 }, s);
await sendCmd(ws, "Network.enable", {}, s);
await sendCmd(ws, "Network.setBlockedURLs", { urls: ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif", "*.mp4"] }, s);
await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000 }, s);

const loadPromise = new Promise((res) => {
  const on = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", on); res(); } };
  ws.addEventListener("message", on);
  setTimeout(res, 60000);
});
await sendCmd(ws, "Page.navigate", { url: PDP }, s);
await loadPromise;

// wait for hydration: React router intercepts Link clicks -> defaultPrevented
let hydrated = false;
for (let i = 0; i < 40; i++) {
  hydrated = await evalJs(ws, s, `
    (() => {
      const a = Array.from(document.querySelectorAll('a[href="/"]')).find(x => /Back to shop/.test(x.textContent||"")) || Array.from(document.querySelectorAll('a[href="/"]'))[0];
      if (!a) return "noanchor";
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return window.location.pathname === "/" ? "navigated" : "pending";
    })()
  `).catch((e) => "err:" + e.message.slice(0, 50));
  if (hydrated === "navigated") break;
  await sleep(500);
}
const t0 = Date.now();
let hero = null, cards = null;
while (Date.now() - t0 < 30000) {
  await sleep(100);
  const t = Date.now() - t0;
  if (hero === null) { try { if (await evalJs(ws, s, `location.pathname==="/" && !!document.querySelector("h1") && /Find what you need/.test(document.querySelector("h1").textContent||"")`)) hero = t; } catch {} }
  if (cards === null) { try { if (await evalJs(ws, s, `!!document.querySelector('a[href^="/product/"]')`)) cards = t; } catch {} }
  if (hero !== null && cards !== null) break;
}
console.log(`hydrated click-> path=${hydrated} t_hero=${hero ?? "TIMEOUT"} t_cards=${cards ?? "TIMEOUT"}`);
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
