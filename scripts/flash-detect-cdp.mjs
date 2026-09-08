// Task 41 — Detect the "Demo mode." callout flash above the navbar on first open.
// Injects a sampler BEFORE page scripts run (addScriptToEvaluateOnNewDocument):
// every 25ms it checks for the callout's signature class (bg-[#fef1de]) and
// whether the catalog fetch (/api/products) has completed. Runs against the
// LIVE site; usage: bun scripts/flash-detect-cdp.mjs

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

function waitEvent(ws, eventName, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === eventName) { clearTimeout(t); ws.removeEventListener("message", onMsg); resolve(msg.params); }
    };
    ws.addEventListener("message", onMsg);
  });
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("attached:", versionInfo.Browser);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

// Sampler injected before any page script: logs every sighting of the callout.
await sendCmd(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__flash = { samples: 0, seen: 0, firstSeenMs: null, lastSeenMs: null };
    const t0 = performance.now();
    const timer = setInterval(() => {
      const el = document.querySelector('[class*="fef1de"]');
      window.__flash.samples++;
      if (el) {
        window.__flash.seen++;
        if (window.__flash.firstSeenMs === null) window.__flash.firstSeenMs = Math.round(performance.now() - t0);
        window.__flash.lastSeenMs = Math.round(performance.now() - t0);
      }
      if (performance.now() - t0 > 15000) clearInterval(timer);
    }, 25);
  `,
}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired").catch(() => null);
await sendCmd(ws, "Page.navigate", { url: "https://hayaan.co" }, sessionId);
await loadPromise;
console.log("loaded, sampling for 16s…");
await new Promise((r) => setTimeout(r, 16000));

const { result } = await sendCmd(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({
    flash: window.__flash,
    catalogFetched: performance.getEntriesByType('resource').some(r => r.name.includes('/api/products')),
    productCards: document.querySelectorAll('a[href^="/product/"]').length,
    calloutStillThere: !!document.querySelector('[class*="fef1de"]')
  })`,
  returnByValue: true,
}, sessionId);
const v = JSON.parse(result.value);
console.log(JSON.stringify(v, null, 2));

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1440, height: 300, scale: 1 } }, sessionId);
await Bun.write(process.argv[2] ?? "/home/z/my-project/download/flash-detect.png", Buffer.from(shot.data, "base64"));

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();

const verdict = v.flash.seen > 0 ? `FLASH DETECTED (first at ${v.flash.firstSeenMs}ms, ${v.flash.seen}/${v.flash.samples} samples)` : "NO FLASH observed";
console.log(verdict);
