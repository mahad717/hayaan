// Probe: on DESKTOP (no throttle), does the pre-hydration tap-feedback overlay
// ever appear during a hydrated SPA "Back to shop" click? If pathname flips
// before the 100ms overlay timer, it never shows (desired). If it does show,
// bump the delay in layout.tsx to avoid a 1-2 frame flicker on fast desktops.
const DEBUG_PORT = 9333;
const PDP = "https://hayaan.co/product/carry-canvas-tote";

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
async function evalJs(ws, sessionId, expression) {
  const { result, exceptionDetails } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 200));
  return result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
const loadPromise = new Promise((r) => {
  const on = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", on); r(); } };
  ws.addEventListener("message", on);
});
await sendCmd(ws, "Page.navigate", { url: PDP }, sessionId);
await loadPromise;
await sleep(9000); // hydrate

for (let iter = 1; iter <= 3; iter++) {
  const t0 = Date.now();
  await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);
  let overlayAt = null, pathAt = null;
  while (Date.now() - t0 < 800) {
    await sleep(50);
    const t = Date.now() - t0;
    if (overlayAt === null) {
      const has = await evalJs(ws, sessionId, `!!document.getElementById("hayaan-nav-feedback")`).catch(() => false);
      if (has) overlayAt = t;
    }
    if (pathAt === null) {
      const onHome = await evalJs(ws, sessionId, `location.pathname === "/"`).catch(() => false);
      if (onHome) pathAt = t;
    }
    if (overlayAt !== null && pathAt !== null) break;
  }
  // confirm overlay cleaned up after arrival
  await sleep(600);
  const cleaned = await evalJs(ws, sessionId, `!document.getElementById("hayaan-nav-feedback")`).catch(() => true);
  console.log(`iter ${iter}: overlay=${overlayAt ?? "never"} | pathname flipped=${pathAt ?? "never(800ms)"} | cleaned up after arrival: ${cleaned}`);
  // go back to the PDP for the next iteration (full reload to reset state)
  const lp = new Promise((r) => {
    const on = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", on); r(); } };
    ws.addEventListener("message", on);
  });
  await sendCmd(ws, "Page.navigate", { url: PDP }, sessionId);
  await lp;
  await sleep(8000);
}
ws.close();
console.log("DONE");
