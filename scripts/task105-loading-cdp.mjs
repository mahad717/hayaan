// Task 105 — reproduce the owner's recording: Samsung Galaxy A18 PDP ->
// "Loading the shop…" full-screen spinner -> homepage, measured ~5s.
//
// The overlay fires on a PRE-HYDRATION tap of a[href="/"] (Back to shop),
// which becomes a FULL DOCUMENT LOAD of "/". So the number that matters is
// tap -> homepage hero visible, on a throttled desktop profile.
//
// Profile: 1280x720 desktop Chrome (matches the recording), CPU 4x,
// 300ms RTT / 1.6Mbps down — plausible Somali fixed-wireless/LTE desktop.
//
// Scenarios:
//   [early-tap ] tap Back-to-shop the moment the SSR <a> exists (pre-hydration)
//                -> full reload path + overlay timing (THE owner journey)
//   [hydrated  ] PDP + settle, click -> client-side swap (regression check)
//   [cold-load ] direct load of "/" with cache disabled (destination experience)
//
// Run: chrome --headless=new --remote-debugging-port=9337 & node this.mjs

const DEBUG_PORT = 9337;
const BASE = "https://hayaan.co";
const PDP = `${BASE}/product/samsung-galaxy-a18`;

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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 90000);
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

async function evalJs(ws, sessionId, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await sendCmd(
    ws, "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId
  );
  if (exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(exceptionDetails).slice(0, 300)}`);
  return result.value;
}

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("browser: " + versionInfo.Browser);

async function newTarget({ blockCache = true } = {}) {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  await sendCmd(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  await sendCmd(ws, "Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  }, sessionId);
  await sendCmd(ws, "Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  if (blockCache) await sendCmd(ws, "Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  // Images are irrelevant to the navigation-path metric (tap -> home content);
  // blocking them keeps each scenario under control on this 2-vCPU sandbox.
  await sendCmd(ws, "Network.setBlockedURLs", { urls: ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif", "*.mp4"] }, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000,
  }, sessionId);
  return { targetId, sessionId };
}

async function goto(sessionId, url) {
  const loadPromise = waitEvent(ws, "Page.loadEventFired", 90000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url }, sessionId);
  await loadPromise;
}

const HERO_OK = `location.pathname === "/" && (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })()`;
const CARD_OK = `(() => { const c = document.querySelector('a[href^="/product/"]'); return !!c && c.offsetParent !== null; })()`;
const CARD_COUNT = `Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a => a.offsetParent !== null).length`;
const OVERLAY_SHOWN = `!!document.getElementById("hayaan-nav-feedback")`;
const NAV_T = `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), bytes: n.transferSize } : null; })()`;

async function pollMilestones(sessionId, t0, capMs = 60000) {
  let hero = null, grid = null, overlayGone = null, overlaySeen = false;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await sleep(100);
    const t = Date.now() - t0;
    if (!overlaySeen && t > 80) {
      try { if (await evalJs(ws, sessionId, OVERLAY_SHOWN)) { overlaySeen = true; overlayShownAt = t; } } catch {}
    }
    if (overlaySeen && overlayGone === null && t > 80) {
      try { if (!(await evalJs(ws, sessionId, OVERLAY_SHOWN))) overlayGone = t; } catch {}
    }
    if (hero === null && t > 60) {
      try { if (await evalJs(ws, sessionId, HERO_OK)) hero = t; } catch {}
    }
    if (grid === null && t > 60) {
      try { if (await evalJs(ws, sessionId, CARD_OK)) grid = t; } catch {}
    }
    if (hero !== null && grid !== null && (overlayGone !== null || !overlaySeen)) break;
  }
  return { hero, grid, overlayShownAt, overlayGone };
}

let overlayShownAt = null;

const FIND_BACK = `(function(){
  var all = Array.from(document.querySelectorAll('a[href="/"]'));
  return all.find(a => /Back to shop/.test(a.textContent||"")) || all[0] || null;
})()`;

const t_start = Date.now();
function log(s) { console.log(`[${Math.round((Date.now() - t_start) / 1000)}s] ${s}`); }

// ---------- Scenario A: [early-tap] pre-hydration tap = the owner journey ----------
for (let run = 1; run <= 1; run++) {
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  await evalJs(ws, sessionId, `window.__m = "pdp"`).catch(() => {});
  overlayShownAt = null;
  let clicked = false, clickAt = -1;
  const t0 = Date.now();
  for (let i = 0; i < 150; i++) {
    const has = await evalJs(ws, sessionId, `!!(${FIND_BACK})`).catch(() => false);
    if (has) {
      await evalJs(ws, sessionId, `(${FIND_BACK}).click()`).catch(() => {});
      clicked = true; clickAt = Date.now() - t0;
      break;
    }
    if (Date.now() - t0 > 20000) break;
    await sleep(50);
  }
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    const markerAlive = await evalJs(ws, sessionId, `window.__m || null`).catch(() => "nav-destroyed");
    const fullReload = markerAlive !== "pdp";
    const count = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
    const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
    log(`[early-tap] tap@+${clickAt}ms | t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | overlay: shown=${m.overlayShownAt ?? "never"} gone=${m.overlayGone ?? "n/a"} | fullReload=${fullReload} | cards=${count} | nav=${JSON.stringify(nav)}`);
  } else {
    log(`[early-tap] never found Back-to-shop anchor`);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario B: [hydrated] client-side swap regression check ----------
{
  const { targetId, sessionId } = await newTarget({ blockCache: false });
  await goto(sessionId, PDP);
  await sleep(9000);
  const ready = await evalJs(ws, sessionId, `!!(${FIND_BACK})`).catch(() => false);
  if (ready) {
    const t0 = Date.now();
    await evalJs(ws, sessionId, `(${FIND_BACK}).click()`).catch(() => {});
    const m = await pollMilestones(sessionId, t0);
    log(`[hydrated  ] t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | overlay=${m.overlayShownAt ?? "never (good - React owned it)"}`);
  } else {
    log(`[hydrated  ] back anchor not found`);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario C: [cold-load] direct load of "/" ----------
for (let run = 1; run <= 1; run++) {
  const { targetId, sessionId } = await newTarget();
  const t0 = Date.now();
  await goto(sessionId, BASE + "/");
  const m = await pollMilestones(sessionId, t0);
  const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
  const count = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
  log(`[cold-load] t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | cards=${count} | nav=${JSON.stringify(nav)}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

ws.close();
console.log("DONE");
