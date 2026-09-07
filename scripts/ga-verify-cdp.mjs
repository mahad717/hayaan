// Task 38 — Verify Google Analytics 4 (G-HHYT03XHG4) actually fires on https://hayaan.co
// Reuses the Task 36 CDP harness pattern: browser-level ws attach (flatten),
// Target.createTarget, per-command 15s timeouts.
// Run with proxy env vars cleared: env -u http_proxy -u https_proxy -u HTTP_PROXY
//   -u HTTPS_PROXY -u all_proxy -u ALL_PROXY bun scripts/ga-verify-cdp.mjs

const DEBUG_PORT = 9333;
const MEAS_ID = "G-HHYT03XHG4";
const LAUNCH_URL = "https://hayaan.co";
const SHOT_PATH = "/home/z/my-project/download/ga-verify-homepage.png";

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      reject(new Error("ws connect timeout"));
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(t);
      resolve(ws);
    };
    ws.onerror = (e) => {
      clearTimeout(t);
      reject(new Error("ws error: " + (e.message || "unknown")));
    };
  });
}

let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
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

function waitEvent(ws, eventName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === eventName) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        resolve(msg.params);
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
console.log("browser: " + versionInfo.Browser);
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("attached to browser ws");

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", {
  targetId,
  flatten: true,
});
console.log("target created + attached, sessionId=" + sessionId);

await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired", 45000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: LAUNCH_URL }, sessionId);
await loadPromise;
console.log("page loaded, waiting 10s for GA to execute + send hit…");
await new Promise((r) => setTimeout(r, 10000));

const { result } = await sendCmd(
  ws,
  "Runtime.evaluate",
  {
    expression: `JSON.stringify({
      href: location.href,
      dataLayerLen: Array.isArray(window.dataLayer) ? window.dataLayer.length : -1,
      hasConfig: Array.isArray(window.dataLayer) && window.dataLayer.some(e => e && e[0] === 'config' && String(e[1]).includes('${MEAS_ID}')),
      gtagFn: typeof window.gtag === 'function',
      gtmScript: performance.getEntriesByType('resource').some(r => r.name.includes('googletagmanager.com/gtag/js')),
      collectHits: performance.getEntriesByType('resource')
        .filter(r => /g\\/collect/.test(r.name))
        .map(r => r.name.slice(0, 120))
        .slice(0, 3)
    })`,
    returnByValue: true,
  },
  sessionId
);
const v = JSON.parse(result.value);
console.log(JSON.stringify(v, null, 2));

// Screenshot evidence
const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write(SHOT_PATH, Buffer.from(shot.data, "base64"));
console.log("screenshot saved: " + SHOT_PATH);

// Cleanup target
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();

const pass = v.hasConfig && v.gtagFn && v.gtmScript && Array.isArray(v.collectHits) && v.collectHits.length > 0;
console.log(pass ? "PASS: GA4 firing end-to-end" : v.hasConfig && v.gtmScript ? "PARTIAL: tag installed, but no collect hit observed (may be network-blocked from sandbox — verify in GA Realtime report)" : "FAIL: tag not executing");
process.exit(pass ? 0 : v.hasConfig && v.gtmScript ? 2 : 1);
