// Debug: what state does the live homepage get stuck in under mobile throttle?
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 60000);
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
async function evalJs(ws, sessionId, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, sessionId);
  if (exceptionDetails) return { __evalError: JSON.stringify(exceptionDetails).slice(0, 300) };
  return result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Log.enable", {}, sessionId);
const consoleMsgs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId === sessionId && m.method === "Runtime.exceptionThrown") {
    consoleMsgs.push("EXC: " + JSON.stringify(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "").slice(0, 200));
  }
  if (m.sessionId === sessionId && m.method === "Log.entryAdded") {
    const e = m.params?.entry;
    if (e && (e.level === "error" || e.level === "warning")) consoleMsgs.push(`${e.level}: ${String(e.text).slice(0, 160)} ${(e.url||"").slice(0,80)}`);
  }
});
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
await sendCmd(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);
await sendCmd(ws, "Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId);

const apiResponses = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId === sessionId && m.method === "Network.responseReceived") {
    const u = m.params?.response?.url || "";
    if (u.includes("/api/") || u.includes("_rsc") || u.includes("/_next/")) {
      apiResponses.push(`${m.params.response.status} ${u.replace(BASE, "").slice(0, 90)}`);
    }
  }
});

const loadPromise = waitEvent(ws, "Page.loadEventFired", 90000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: BASE + "/" }, sessionId);
await loadPromise;
console.log("load event fired; waiting 25s under throttle...");
await sleep(25000);

const state = await evalJs(ws, sessionId, `(function(){
  const q = (s) => document.querySelector(s);
  return {
    title: document.title,
    pathname: location.pathname,
    heroH1: !!q("h1"),
    skeletonCount: document.querySelectorAll(".animate-pulse").length,
    productAnchors: document.querySelectorAll('a[href^="/product/"]').length,
    noProducts: !!Array.from(document.querySelectorAll("p")).find(p => /No products found/.test(p.textContent||"")),
    demoCallout: !!Array.from(document.querySelectorAll("p")).find(p => /Demo mode/.test(p.textContent||"")),
    catalogText: (q("#catalog")?.textContent || "").slice(0, 120),
    reactRootChildren: document.getElementById("__next")?.childElementCount ?? "no-__next",
    nextError: !!q("nextjs-portal"),
  };
})()`);
console.log("PAGE STATE:", JSON.stringify(state, null, 1));
console.log("API/JS responses seen (" + apiResponses.length + "):");
for (const r of apiResponses.slice(0, 40)) console.log("  " + r);
console.log("Console errors (" + consoleMsgs.length + "):");
for (const c of consoleMsgs.slice(0, 20)) console.log("  " + c);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
