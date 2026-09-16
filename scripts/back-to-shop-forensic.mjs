// Forensic: is the homepage main thread jamming? Which requests fail?
// Run A: unthrottled, desktop UA. Run B: mobile UA + throttle (like real phone).
const DEBUG_PORT = 9333;
const BASE = "https://hayaan.co";
const MODE = process.argv[2] || "unthrottled";

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
function waitEvent(ws, eventName, timeoutMs = 90000) {
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
async function evalJs(ws, sessionId, expression, awaitPromise = false, timeoutMs = 8000) {
  const id = ++msgId;
  const payload = { id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise } };
  if (sessionId) payload.sessionId = sessionId;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        if (msg.error) resolve({ __error: msg.error });
        else resolve(msg.result?.value);
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
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

// record long tasks (>50ms) from the very first script execution
await sendCmd(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `(function(){
    window.__lt = []; window.__ltSum = 0;
    try {
      new PerformanceObserver(function(l){
        for (const e of l.getEntries()) { window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); window.__ltSum += e.duration; }
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  })()`,
}, sessionId);

if (MODE === "mobile") {
  await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
  await sendCmd(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await sendCmd(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  await sendCmd(ws, "Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId);
} else {
  await sendCmd(ws, "Network.enable", {}, sessionId);
}

const apiResponses = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId === sessionId && m.method === "Network.responseReceived") {
    const u = m.params?.response?.url || "";
    if (u.includes("/api/") || u.includes("_rsc") || u.includes("challenge") || u.includes("turnstile")) {
      apiResponses.push(`${m.params.response.status} ${u.replace(BASE, "").slice(0, 100)}`);
    }
  }
});

console.log(`--- MODE=${MODE} ---`);
const t0 = Date.now();
const loadPromise = waitEvent(ws, "Page.loadEventFired", 90000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: BASE + "/" }, sessionId);
await loadPromise;
console.log(`load event at +${Date.now() - t0}ms`);

// heartbeat + state sampling every 3s for 36s
for (let k = 0; k < 12; k++) {
  await sleep(3000);
  const hb = await evalJs(ws, sessionId, `1+1`, false, 6000);
  const st = hb && hb.__timeout !== true ? await evalJs(ws, sessionId, `(function(){
    return {
      t: Math.round(performance.now()),
      cards: document.querySelectorAll('a[href^="/product/"]').length,
      pulse: document.querySelectorAll(".animate-pulse").length,
      ltSum: Math.round(window.__ltSum || 0),
      ltCount: (window.__lt || []).length,
      ltWorst: (window.__lt || []).reduce((m, e) => Math.max(m, e[1]), 0),
      noProducts: !!Array.from(document.querySelectorAll("p")).find(p => /No products found/.test(p.textContent||"")),
      demo: !!Array.from(document.querySelectorAll("p")).find(p => /Demo mode/.test(p.textContent||""))
    };
  })()`, false, 6000) : null;
  console.log(`+${String(Date.now() - t0).padStart(6)}ms hb=${hb && hb.__timeout ? "JAM" : "ok"} state=${st && st.__timeout ? "JAM" : JSON.stringify(st)}`);
}

console.log("API/JS responses (" + apiResponses.length + "):");
for (const r of apiResponses.slice(0, 40)) console.log("  " + r);
const longs = await evalJs(ws, sessionId, `JSON.stringify((window.__lt||[]).sort((a,b)=>b[1]-a[1]).slice(0,12))`, false, 8000);
console.log("Worst long tasks [startMs, durMs]:", longs);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
