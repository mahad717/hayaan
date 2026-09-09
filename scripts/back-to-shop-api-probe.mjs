// With images blocked (no wedge): (1) which image URLs did the page request,
// (2) does /api/products resolve from inside the page, (3) did React hydrate?
const DEBUG_PORT = 9333;
const TARGET = "https://hayaan.co/";

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
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);
await sendCmd(ws, "Network.setBlockedURLs", { urls: ["*unsplash*", "*supabase.co/storage*", "*.svg", "*.jpg*", "*.png*", "*.avif*", "*.webp*"] }, sessionId);

const imgReqs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId !== sessionId) return;
  if (m.method === "Network.requestWillBeSent") {
    const u = m.params.request.url;
    if (/\.(jpg|jpeg|png|avif|webp|svg)(\?|$)|unsplash|storage/i.test(u)) imgReqs.push(u.slice(0, 120));
  }
});

await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});
await sleep(15000);

const probe = await sendCmd(ws, "Runtime.evaluate", {
  expression: `(async function(){
    const out = {};
    const main = document.querySelector("main");
    out.hydrated = !!main && Object.keys(main).some(k => k.startsWith("__reactContainer"));
    out.cards = document.querySelectorAll('a[href^="/product/"]').length;
    out.pulse = document.querySelectorAll('.animate-pulse').length;
    const t = performance.now();
    try {
      const r = await fetch("/api/products", { credentials: "include" });
      const j = await r.json().catch(() => null);
      out.api = { status: r.status, ms: Math.round(performance.now() - t), count: j && j.products ? j.products.length : "?" };
      if (j && j.products) out.imgUrls = j.products.map(p => (p.images && p.images[0]) || "none").slice(0, 15);
    } catch (e) { out.api = { err: String(e).slice(0, 100), ms: Math.round(performance.now() - t) }; }
    return out;
  })()`,
  awaitPromise: true,
  returnByValue: true,
}, sessionId);
console.log("PROBE:", JSON.stringify(probe.result.value, null, 1));
console.log("\nimage requests made (" + imgReqs.length + "):");
for (const u of [...new Set(imgReqs)]) console.log("  " + u);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
