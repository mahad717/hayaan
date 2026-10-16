// One-off probe: what does the PDP DOM actually contain for back links?
const DEBUG_PORT = 9339;
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
async function evalJs(ws, sessionId, expression) {
  const { result, exceptionDetails } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
}
async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }
function waitEvent(ws, eventName, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => { if (JSON.parse(ev.data).method === eventName) { clearTimeout(t); ws.removeEventListener("message", onMsg); resolve(true); } };
    ws.addEventListener("message", onMsg);
  });
}

const vi = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(vi.webSocketDebuggerUrl);

for (const blockJs of [false, true]) {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  const blocked = ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif"];
  if (blockJs) blocked.push("*://hayaan.co/_next/*");
  await sendCmd(ws, "Network.setBlockedURLs", { urls: blocked }, sessionId);
  if (blockJs) await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId);
  const lp = waitEvent(ws, "Page.loadEventFired", 90000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url: `${BASE}/product/samsung-galaxy-a18` }, sessionId);
  await lp;
  await sleep(2000);
  const probe = await evalJs(ws, sessionId, `(function(){
    var anchors = Array.from(document.querySelectorAll("a[href='/']"));
    var anyBack = Array.from(document.querySelectorAll("a")).filter(function(a){ return /back to shop/i.test(a.textContent||""); });
    return {
      url: location.href,
      title: (document.querySelector("h1")||{}).textContent || null,
      slashAnchors: anchors.map(function(a){ return { href: a.getAttribute("href"), text: (a.textContent||"").trim().slice(0,40), visible: a.offsetParent !== null }; }),
      backLinks: anyBack.map(function(a){ return { href: a.getAttribute("href"), tag: a.tagName, text: (a.textContent||"").trim().slice(0,40), visible: a.offsetParent !== null }; }),
      bodySnippet: (document.body.textContent||"").slice(0, 120)
    };
  })()`);
  console.log(`blockJs=${blockJs}:\n` + JSON.stringify(probe, null, 2));
  await sendCmd(ws, "Target.closeTarget", { targetId });
}
