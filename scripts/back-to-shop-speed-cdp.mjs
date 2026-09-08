// Task 46 — measure "Back to shop" PDP → home wall time on https://hayaan.co
// Opens the PDP fresh, waits for hydration, clicks the button, polls for the
// home hero heading; reports elapsed ms per iteration. Same CDP pattern as
// font-regular-revert-verify-cdp.mjs (chrome launched in the SAME bash command).

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

function waitEvent(ws, eventName, timeoutMs = 30000) {
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

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("browser: " + versionInfo.Browser);

// Optional mobile-network simulation: THROTTLE=latency_ms,down_bytes/s,up_bytes/s
// Applied per-target (CDP network emulation is session-scoped).
const throttle = process.env.THROTTLE;
if (throttle) console.log(`throttling: ${throttle}`);

const results = [];
for (let i = 0; i < 3; i++) {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  if (throttle) {
    const [latency, down, up] = throttle.split(",").map(Number);
    await sendCmd(ws, "Network.enable", {}, sessionId);
    await sendCmd(
      ws,
      "Network.emulateNetworkConditions",
      { offline: false, latency, downloadThroughput: down, uploadThroughput: up },
      sessionId
    );
  }

  // Capture same-origin requests fired during the click window
  const clickRequests = [];
  const onReq = (ev) => {
    try {
      const p = JSON.parse(ev.data);
      if (p.sessionId !== sessionId) return;
      const url = new URL(p.params.request.url);
      if (url.origin === "https://hayaan.co") {
        clickRequests.push(url.pathname + (url.search || ""));
      }
    } catch {}
  };
  ws.addEventListener("message", onReq);

  const loadPromise = waitEvent(ws, "Page.loadEventFired", 45000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url: PDP_URL }, sessionId);
  await loadPromise;
  // let hydration settle; the prefetch (post-fix) also lands inside this window
  await new Promise((r) => setTimeout(r, 3500));

  const ready = await evalJs(ws, sessionId, `(() => {
    const btn = [...document.querySelectorAll("button, a")].find((b) => /Back to shop/.test(b.textContent || ""));
    return btn ? "ready" : "missing";
  })()`);
  if (ready !== "ready") {
    console.log(`iter ${i + 1}: SKIP — Back to shop button not found`);
    await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
    continue;
  }

  const elapsed = await evalJs(
    ws,
    sessionId,
    `(async () => {
      const btn = [...document.querySelectorAll("button, a")].find((b) => /Back to shop/.test(b.textContent || ""));
      const t0 = performance.now();
      btn.click();
      for (let k = 0; k < 400; k++) {
        await new Promise((r) => setTimeout(r, 25));
        const h = document.querySelector("h1");
        if (location.pathname === "/" && h && h.offsetParent !== null && /Find what you need/.test(h.textContent || "")) {
          return Math.round(performance.now() - t0);
        }
      }
      return -1;
    })()`,
    true
  );
  results.push(elapsed);
  console.log(`iter ${i + 1}: click → home hero visible = ${elapsed === -1 ? "TIMEOUT (>10s)" : elapsed + " ms"} | requests during click: ${JSON.stringify(clickRequests)}`);
  ws.removeEventListener("message", onReq);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}
ws.close();

if (results.length) {
  const ok = results.filter((r) => r >= 0);
  console.log("SUMMARY: " + JSON.stringify({ runs: results, median: ok.length ? ok.sort((a, b) => a - b)[Math.floor(ok.length / 2)] : null }));
}
