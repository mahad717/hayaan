// Task 47 — reproduce "Back to shop takes 10s on MOBILE" on https://hayaan.co
// Device profile: Samsung Galaxy M13 (360x800 CSS viewport, Android Chrome UA,
// touch) + harsh throttle (400ms RTT, 1.0 Mbps down / 512 Kbps up) + CPU
// throttle (CPU_RATE env, default 4x — the M13's Exynos 850 is ~4x slower
// than a desktop core). Scenarios:
//   early : click the SSR <a> the MOMENT it exists (pre-hydration) -> full doc load path
//   read  : stay on the PDP 8s (speculation-rules prerender of "/" gets a
//           chance to build), then click — the realistic Galaxy M13 flow
//   cold  : PDP deep link, hydrated, click Back to shop (cold store)
//   warm  : homepage -> client-side into PDP -> click Back to shop
// Milestones from the click, host-side (survives cross-document navigation):
// t_hero = home h1 visible; t_grid = real product card visible.
// a[href^="/product/"] matches ONLY real cards (skeleton has no anchors).
// SHOT=/abs/path.png captures the settled shop page at the end of the read run.

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
  if (exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(exceptionDetails).slice(0, 400)}`);
  return result.value;
}

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("browser: " + versionInfo.Browser);

const CPU_RATE = Number(process.env.CPU_RATE || 4);

async function newTarget() {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  await sendCmd(ws, "Emulation.setDeviceMetricsOverride", {
    width: 360, height: 800, deviceScaleFactor: 3, mobile: true,
  }, sessionId);
  await sendCmd(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await sendCmd(ws, "Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (Linux; Android 12; SM-M135FU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  }, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", {
    offline: false, latency: 400, downloadThroughput: 125000, uploadThroughput: 64000,
  }, sessionId);
  if (CPU_RATE > 1) {
    await sendCmd(ws, "Emulation.setCPUThrottlingRate", { rate: CPU_RATE }, sessionId);
    console.log(`cpu throttle: ${CPU_RATE}x`);
  }
  return { targetId, sessionId };
}

async function goto(sessionId, url) {
  const loadPromise = waitEvent(ws, "Page.loadEventFired", 60000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url }, sessionId);
  await loadPromise;
}

const HERO_OK = `location.pathname === "/" && (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })()`;
const CARD_OK = `(() => { const c = document.querySelector('a[href^="/product/"]'); return !!c && c.offsetParent !== null; })()`;
const FEEDBACK_OK = `!!document.getElementById("hayaan-nav-feedback")`;
async function pollMilestones(sessionId, t0, capMs = 45000) {
  let hero = null, grid = null, feedback = null;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await sleep(120);
    const t = Date.now() - t0;
    if (feedback === null && t > 60) {
      try { if (await evalJs(ws, sessionId, FEEDBACK_OK)) feedback = t; } catch {}
    }
    if (hero === null && t > 60) {
      try { if (await evalJs(ws, sessionId, HERO_OK)) hero = t; } catch {}
    }
    if (grid === null && t > 60) {
      try { if (await evalJs(ws, sessionId, CARD_OK)) { grid = t; break; } } catch {}
    }
    if (hero !== null && grid !== null) break;
  }
  return { hero, grid, feedback };
}

function report(label, { hero, grid, feedback }) {
  console.log(`${label}: t_feedback=${feedback ?? "none"} ms | t_hero=${hero ?? "TIMEOUT"} ms | t_grid=${grid ?? "TIMEOUT"} ms`);
}

const READ_REQS = `(function(){
  try {
    return performance.getEntriesByType("resource")
      .filter(function(e){ return (e.name.indexOf("/api/")>-1 || e.name.indexOf("_rsc")>-1); })
      .map(function(e){ var u=new URL(e.name, location.origin); return { p: u.pathname + (u.search||""), start: Math.round(e.startTime), dur: Math.round(e.duration) }; })
      .sort(function(a,b){ return a.start-b.start; }).slice(0, 25);
  } catch (e) { return []; }
})()`;

async function prerenderPresent() {
  try {
    const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
    return list.some((t) => t.type === "page" && t.url.replace(/\/$/, "") === BASE);
  } catch { return false; }
}

async function shoot(sessionId, path) {
  if (!path) return;
  await sleep(1200);
  const { data } = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, Buffer.from(data, "base64"));
  console.log(`screenshot: ${path}`);
}

// ---------- Scenario 1: EARLY tap (pre-hydration, impatient user) ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  let clicked = false;
  const t0 = Date.now();
  for (let i = 0; i < 80; i++) {
    const has = await evalJs(ws, sessionId, `!!document.querySelector('a[href="/"]')`).catch(() => false);
    if (has) { await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`); clicked = true; break; }
    await sleep(100);
  }
  console.log(`[early] clicked pre-hydration: ${clicked} at +${Date.now() - t0}ms after load`);
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    report("[early]", m);
    await sleep(1500);
    console.log("    (new-document resource entries, relative to that document's origin)");
    for (const q of await evalJs(ws, sessionId, READ_REQS)) console.log(`    ${String(q.start).padStart(6)}ms dur=${String(q.dur).padStart(6)}ms  ${q.p.slice(0, 90)}`);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario 1b: READ then tap (8s on the PDP, like a real shopper) ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  let pre = false;
  for (let i = 0; i < 16; i++) { pre = await prerenderPresent(); if (pre) break; await sleep(500); }
  console.log(`[read] speculation prerender of "/" present: ${pre}`);
  await sleep(Math.max(0, 8000 - 8000)); // prerender poll already spans ~8s
  const ready = await evalJs(ws, sessionId, `!!document.querySelector('a[href="/"]')`).catch(() => false);
  console.log(`[read] button ready: ${ready}`);
  if (ready) {
    const t0 = Date.now();
    await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);
    const m = await pollMilestones(sessionId, t0);
    report("[read] ", m);
    await shoot(sessionId, process.env.SHOT || "");
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario 2: COLD (deep-linked PDP, hydrated, then back) ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  await sleep(9000);
  const ready = await evalJs(ws, sessionId, `!!document.querySelector('a[href="/"]')`);
  console.log(`[cold] button ready: ${ready}`);
  if (ready) {
    const t0 = Date.now();
    await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);
    const m = await pollMilestones(sessionId, t0);
    report("[cold] ", m);
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- Scenario 3: WARM (browse home -> PDP -> back) ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, BASE + "/");
  let card = false;
  for (let i = 0; i < 60; i++) { card = await evalJs(ws, sessionId, CARD_OK); if (card) break; await sleep(500); }
  console.log(`[warm] first card rendered: ${card}`);
  if (card) {
    await evalJs(ws, sessionId, `(async () => { const c = document.querySelector('a[href^="/product/"]'); c.click(); for (let k=0;k<400;k++){ await new Promise(r=>setTimeout(r,25)); if (location.pathname.startsWith("/product/")) return true; } return false; })()`, true);
    await sleep(9000);
    const ready = await evalJs(ws, sessionId, `!!document.querySelector('a[href="/"]')`);
    console.log(`[warm] button ready: ${ready}`);
    if (ready) {
      const t0 = Date.now();
      await evalJs(ws, sessionId, `document.querySelector('a[href="/"]').click()`);
      const m = await pollMilestones(sessionId, t0);
      report("[warm] ", m);
    }
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

ws.close();
console.log("DONE");
