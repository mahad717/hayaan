// Task 47 debug — pin down why the [cold] warm-up didn't make the grid instant.
// For the cold scenario: track CDP Network events (host timestamps), detect
// whether the click causes a full document navigation, and check whether
// /api/products was fetched BEFORE the click (warm-up) or AFTER (grid refetch).

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
function waitEvent(ws, eventName, timeoutMs = 45000) {
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
  const { result, exceptionDetails } = await sendCmd(
    ws, "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId
  );
  if (exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(exceptionDetails).slice(0, 300)}`);
  return result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);
await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId);

// Network capture with host-side timestamps
const t0 = Date.now();
const events = [];
const onNet = (ev) => {
  try {
    const p = JSON.parse(ev.data);
    if (p.sessionId !== sessionId) return;
    if (p.method === "Network.requestWillBeSent") {
      const u = new URL(p.params.request.url);
      if (u.origin === "https://hayaan.co") {
        events.push({ t: Date.now() - t0, ev: "req", p: u.pathname + (u.search || ""), type: p.params.type });
      }
    }
    if (p.method === "Page.frameNavigated" && !p.params.frame.parentId) {
      events.push({ t: Date.now() - t0, ev: "NAV", p: p.params.frame.url });
    }
  } catch {}
};
ws.addEventListener("message", onNet);

const loadPromise = waitEvent(ws, "Page.loadEventFired", 60000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: PDP }, sessionId);
await loadPromise;
events.push({ t: Date.now() - t0, ev: "load", p: "loadEventFired" });

// +3s: hydration/warm-up checkpoint
await sleep(3000);
const cp1 = await evalJs(ws, sessionId, `(() => ({
  marker: (window.__m === undefined) ? (window.__m = 1, "set") : "set-already",
  pdpProductsFetched: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/products")).length,
  pdpCategoriesFetched: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/categories")).length,
}))()`);
console.log("checkpoint +3s after load:", JSON.stringify(cp1));

// +6s more: click
await sleep(6000);
const btnOk = await evalJs(ws, sessionId, `!!document.querySelector('a[href="/"]')`);
console.log("button present at click time:", btnOk);
events.push({ t: Date.now() - t0, ev: "CLICK", p: "back-to-shop" });
await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);

// poll milestones
let hero = null, grid = null, docSurvived = null;
const start = Date.now();
while (Date.now() - start < 30000) {
  await sleep(150);
  const t = Date.now() - t0;
  const st = await evalJs(ws, sessionId, `(() => ({
    path: location.pathname,
    hero: (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })(),
    card: (() => { const c = document.querySelector('a[href^="/product/"]'); return !!c && c.offsetParent !== null; })(),
    survived: window.__m === 1,
    pdpProducts: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/products")).length,
  }))()`).catch(() => null);
  if (!st) continue;
  if (docSurvived === null && st.survived === false) docSurvived = { nav: "FULL DOCUMENT RELOAD", t };
  if (docSurvived === null && t > 2000) docSurvived = { nav: "client-side (marker survived)", t };
  if (hero === null && st.hero) hero = t;
  if (grid === null && st.card) { grid = t; break; }
}
console.log(`t_hero=${hero} t_grid=${grid} | navigation=${docSurvived?.nav ?? "unknown"}`);

await sleep(1000);
const finalCounts = await evalJs(ws, sessionId, `(() => ({
  productsReqs: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/products")).map((r) => Math.round(r.startTime)),
  categoriesReqs: performance.getEntriesByType("resource").filter((r) => r.name.includes("/api/categories")).map((r) => Math.round(r.startTime)),
}))()`);
console.log("current-document /api request startTime(ms):", JSON.stringify(finalCounts));

console.log("--- network timeline (host ms) ---");
for (const e of events) console.log(`${String(e.t).padStart(6)}  ${e.ev.padEnd(5)} ${e.type ? e.type + " " : ""}${e.p.slice(0, 80)}`);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
