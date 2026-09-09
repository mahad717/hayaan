// Task 47b — the REAL mobile failing path: a tap BEFORE hydration fires the
// raw <a href="/"> and the browser does a FULL DOCUMENT LOAD of "/" (silent —
// no visual feedback = "stuck, no response"), then the reloaded homepage
// paints products only after JS boots + /api/products returns.
//
// Scenarios (mobile emulation 390x844@3x iPhone UA, 400ms RTT / 1Mbps down):
//   [reload]     fresh target, cache disabled, direct full load of "/" —
//                this IS the destination experience of a pre-hydration tap.
//   [early-tap]  PDP loads (JS still downloading under throttle), tap Back to
//                shop the moment the SSR <a> exists -> expect full reload
//                (window.__m marker gone after landing proves it).
//   [hydrated]   PDP + 9s settle, click -> regression check (client-side swap).
// Milestones host-side (survive cross-document nav): t_hero, t_grid.

const DEBUG_PORT = 9333;
const BASE = "https://hayaan.co";
const PDP = `${BASE}/product/carry-canvas-tote`;

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
    width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  }, sessionId);
  await sendCmd(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await sendCmd(ws, "Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  }, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  if (blockCache) await sendCmd(ws, "Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", {
    offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000,
  }, sessionId);
  return { targetId, sessionId };
}

async function goto(sessionId, url) {
  const loadPromise = waitEvent(ws, "Page.loadEventFired", 60000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url }, sessionId);
  await loadPromise;
}

const HERO_OK = `location.pathname === "/" && (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })()`;
const CARD_OK = `(() => { const c = document.querySelector('a[href^="/product/"]'); return !!c && c.offsetParent !== null; })()`;
const CARD_COUNT = `Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a => a.offsetParent !== null).length`;
const NAV_T = `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), bytes: n.transferSize } : null; })()`;

async function pollMilestones(sessionId, t0, capMs = 45000) {
  let hero = null, grid = null;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await sleep(120);
    const t = Date.now() - t0;
    if (hero === null && t > 60) {
      try { if (await evalJs(ws, sessionId, HERO_OK)) hero = t; } catch {}
    }
    if (grid === null && t > 60) {
      try { if (await evalJs(ws, sessionId, CARD_OK)) { grid = t; } } catch {}
    }
    if (hero !== null && grid !== null) break;
  }
  return { hero, grid };
}

// Back-to-shop anchor on the route-mode PDP: prefer the "Back to shop" one,
// fall back to the first href="/" anchor (header logo) — same destination.
const FIND_BACK = `(function(){
  var all = Array.from(document.querySelectorAll('a[href="/"]'));
  return all.find(a => /Back to shop/.test(a.textContent||"")) || all[0] || null;
})()`;

// ---------- Scenario A: [reload] full document load of "/" (cold cache) ----------
{
  const { targetId, sessionId } = await newTarget();
  const t0 = Date.now();
  await goto(sessionId, BASE + "/");
  const m = await pollMilestones(sessionId, t0);
  const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
  const count = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
  console.log(`[reload   ] t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | cards=${count} | nav=${JSON.stringify(nav)}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario B: [early-tap] tap the moment the SSR <a> exists ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  // marker on the PDP document — gone after landing => full reload happened
  await evalJs(ws, sessionId, `window.__m = "pdp"`).catch(() => {});
  let clicked = false, clickAt = -1;
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) {
    const has = await evalJs(ws, sessionId, `!!(${FIND_BACK})`).catch(() => false);
    if (has) {
      await evalJs(ws, sessionId, `(${FIND_BACK}).click()`).catch(() => {});
      clicked = true; clickAt = Date.now() - t0;
      break;
    }
    await sleep(60);
  }
  console.log(`[early-tap] clicked at +${clickAt}ms after PDP load`);
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    const markerAlive = await evalJs(ws, sessionId, `window.__m || null`).catch(() => "nav-destroyed");
    const fullReload = markerAlive !== "pdp";
    const count = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
    const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
    console.log(`[early-tap] t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | fullReload=${fullReload} | cards=${count} | nav=${JSON.stringify(nav)}`);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario C: [hydrated] regression check (client-side swap) ----------
{
  const { targetId, sessionId } = await newTarget({ blockCache: false });
  await goto(sessionId, PDP);
  await sleep(9000);
  const ready = await evalJs(ws, sessionId, `!!(${FIND_BACK})`).catch(() => false);
  if (ready) {
    const t0 = Date.now();
    await evalJs(ws, sessionId, `(${FIND_BACK}).click()`).catch(() => {});
    const m = await pollMilestones(sessionId, t0);
    const markerAlive = await evalJs(ws, sessionId, `window.__m || null`).catch(() => "nav-destroyed");
    console.log(`[hydrated ] t_hero=${m.hero ?? "TIMEOUT"} | t_grid=${m.grid ?? "TIMEOUT"} | clientSwap=${markerAlive === null ? "unknown" : "yes"}`);
  } else {
    console.log(`[hydrated ] back button not found`);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

ws.close();
console.log("DONE");
