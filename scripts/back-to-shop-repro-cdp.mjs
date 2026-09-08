// Task 42 — Reproduce the "Back to shop needs two clicks" bug on /product/[slug].
// Click once → check URL + whether homepage (hero) or product content renders.
// Click again → same checks. Usage: bun scripts/back-to-shop-repro-cdp.mjs

const DEBUG_PORT = 9333;
const PDP_URL = "https://hayaan.co/product/carry-canvas-tote";

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

async function snapshot(ws, sessionId, label) {
  await new Promise((r) => setTimeout(r, 2500)); // let any client nav settle
  const { result } = await sendCmd(ws, "Runtime.evaluate", {
    expression: `JSON.stringify({
      path: location.pathname + location.search,
      heroVisible: !!document.querySelector('h1') && document.body.innerText.includes('Find what you need'),
      productVisible: document.body.innerText.includes('Back to shop') && document.body.innerText.includes('Add to cart') && !document.body.innerText.includes('Find what you need'),
      storeView: (window.__store_probe && window.__store_probe.view) ?? 'n/a'
    })`,
    returnByValue: true,
  }, sessionId);
  console.log(label, JSON.parse(result.value));
  return JSON.parse(result.value);
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired").catch(() => null);
await sendCmd(ws, "Page.navigate", { url: PDP_URL }, sessionId);
await loadPromise;
await new Promise((r) => setTimeout(r, 3500)); // hydration + mirror effect

// Click "Back to shop" — click #1
const { result: btn } = await sendCmd(ws, "Runtime.evaluate", {
  expression: `(() => {
    const els = [...document.querySelectorAll('button')];
    const b = els.find(e => e.textContent.includes('Back to shop'));
    if (!b) return 'NOT FOUND';
    b.click();
    return 'clicked';
  })()`,
  returnByValue: true,
}, sessionId);
console.log("click1:", btn.result);
const after1 = await snapshot(ws, sessionId, "after click 1:");

let verdict;
if (after1.heroVisible) {
  verdict = "ONE CLICK SUFFICES (bug not reproduced)";
} else if (after1.path.startsWith("/") && after1.productVisible) {
  // click #2
  const { result: btn2 } = await sendCmd(ws, "Runtime.evaluate", {
    expression: `(() => {
      const els = [...document.querySelectorAll('button')];
      const b = els.find(e => e.textContent.includes('Back to shop'));
      if (!b) return 'NOT FOUND';
      b.click();
      return 'clicked';
    })()`,
    returnByValue: true,
  }, sessionId);
  console.log("click2:", btn2.result);
  const after2 = await snapshot(ws, sessionId, "after click 2:");
  verdict = after2.heroVisible
    ? "BUG REPRODUCED: click 1 landed on / but still showed the product; click 2 required"
    : "INCONCLUSIVE: still not home after 2 clicks";
} else {
  verdict = "INCONCLUSIVE: unexpected state after click 1";
}

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write("/home/z/my-project/download/back-to-shop-repro.png", Buffer.from(shot.data, "base64"));
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log(verdict);
