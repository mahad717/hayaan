// Task 106 — verify the PDP "Back to shop" fix on production.
//
// Change under test (commit e92a330):
//   1. Route-mode back link is a PLAIN <a href="/"> (was <Link prefetch>):
//      every tap is a real navigation -> Chromium ACTIVATES the Speculation
//      Rules prerender of "/" (soft navigations never activate), and
//      non-prerender browsers get a progressive full load instead of a
//      frozen soft-nav waiting on the ~1MB home RSC payload.
//   2. goToView("home") navigates to "/" EXACTLY (never "/?view=home") so
//      the header logo / wishlist / cart "go shopping" paths hit the same
//      pre-built page.
//
// Proof targets:
//   A) prerender-activation tap: navigation entry activationStart > 0 and
//      near-instant hero after the tap.
//   B) early tap (pre-hydration, prerender not ready): full-load fallback,
//      overlay shows then clears, hero well under the old ~5s.
//   C) double-tap (the owner's "second click"): first tap navigates for
//      real, so the second tap can no longer be swallowed by a pending
//      soft-nav; must land on home exactly once.
//   D) logo tap from PDP (goToView("home") path): activation like A.
//
// Real trusted input (Input.dispatchMouseEvent) is used everywhere —
// activation is measured on the genuine input pipeline.
//
// Run: chrome --headless=new --remote-debugging-port=9338 & node this.mjs

import fs from "node:fs";

const DEBUG_PORT = 9338;
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 120000);
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
  await sendCmd(ws, "Network.setBlockedURLs", { urls: ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif", "*.mp4"] }, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000,
  }, sessionId);
  return { targetId, sessionId };
}

async function goto(sessionId, url) {
  const loadPromise = waitEvent(ws, "Page.loadEventFired", 120000).catch(() => null);
  await sendCmd(ws, "Page.navigate", { url }, sessionId);
  await loadPromise;
}

function waitEvent(ws, eventName, timeoutMs = 120000) {
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

const HERO_OK = `location.pathname === "/" && (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })()`;
const CARD_OK = `(() => { const c = document.querySelector('a[href^="/product/"]'); return !!c && c.offsetParent !== null; })()`;
const CARD_COUNT = `Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a => a.offsetParent !== null).length`;
const OVERLAY_SHOWN = `!!document.getElementById("hayaan-nav-feedback")`;
const NAV_T = `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), activationStart: Math.round(n.activationStart || 0), type: n.type, bytes: n.transferSize } : null; })()`;

const FIND_BACK = `(function(){
  var all = Array.from(document.querySelectorAll('a[href="/"]'));
  return all.find(a => /Back to shop/.test(a.textContent||"")) || all[0] || null;
})()`;

// Real trusted click at the center of an element (dispatches through the
// browser input pipeline — isTrusted, default navigation intact).
async function realClick(ws, sessionId, findExpr) {
  const pt = await evalJs(ws, sessionId, `(function(){
    var a = ${findExpr};
    if (!a) return null;
    a.scrollIntoView({ block: "center" });
    var r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!pt) return false;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await sendCmd(ws, "Input.dispatchMouseEvent", {
      type, x: pt.x, y: pt.y, button: "left", clickCount: 1,
    }, sessionId);
  }
  return true;
}

async function pollMilestones(sessionId, t0, capMs = 60000) {
  let hero = null, grid = null, overlayShownAt = null, overlayGone = null, overlaySeen = false;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await sleep(100);
    const t = Date.now() - t0;
    if (t > 80) {
      try {
        const shown = await evalJs(ws, sessionId, OVERLAY_SHOWN).catch(() => false);
        if (shown && !overlaySeen) { overlaySeen = true; overlayShownAt = t; }
        if (overlaySeen && overlayGone === null && !shown) overlayGone = t;
      } catch {}
    }
    if (hero === null && t > 60) {
      try { if (await evalJs(ws, sessionId, HERO_OK)) hero = t; } catch {}
    }
    if (grid === null && t > 60) {
      try { if (await evalJs(ws, sessionId, CARD_OK)) grid = t; } catch {}
    }
    if (hero !== null && grid !== null && (!overlaySeen || overlayGone !== null)) break;
  }
  return { hero, grid, overlayShownAt, overlayGone, overlaySeen };
}

const t_start = Date.now();
function log(s) { console.log(`[${Math.round((Date.now() - t_start) / 1000)}s] ${s}`); }

// ---------- A) prerender-activation back tap ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  await evalJs(ws, sessionId, `window.__m = "pdp"`).catch(() => {});
  log("A: PDP loaded, waiting 15s for the eager prerender of / to finish (1MB HTML @ 1Mbps)");
  await sleep(15000);
  const t0 = Date.now();
  const clicked = await realClick(ws, sessionId, FIND_BACK);
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
    const marker = await evalJs(ws, sessionId, `window.__m || null`).catch(() => "nav-destroyed");
    const cards = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
    log(`A[prerender-tap] tap->hero=${m.hero ?? "TIMEOUT"}ms | tap->grid=${m.grid ?? "TIMEOUT"}ms | activationStart=${nav?.activationStart ?? "?"} navType=${nav?.type ?? "?"} | fullReload=${marker !== "pdp"} | cards=${cards} | nav=${JSON.stringify(nav)}`);
    await sleep(1500);
    await sendCmd(ws, "Page.captureScreenshot", {}, sessionId).then((r) => {
      fs.writeFileSync("/home/z/my-project/download/task106-activation-home.png", Buffer.from(r.data, "base64"));
      log("A: screenshot saved download/task106-activation-home.png");
    }).catch(() => {});
  } else {
    log("A: back anchor not found");
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- B) early tap, prerender not ready (fallback path) ----------
{
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  const t0 = Date.now();
  let clicked = false, clickAt = -1;
  for (let i = 0; i < 200; i++) {
    const has = await evalJs(ws, sessionId, `!!(${FIND_BACK})`).catch(() => false);
    if (has) { clicked = await realClick(ws, sessionId, FIND_BACK); clickAt = Date.now() - t0; break; }
    if (Date.now() - t0 > 20000) break;
    await sleep(30);
  }
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
    log(`B[early-tap] tap@+${clickAt}ms | tap->hero=${m.hero ?? "TIMEOUT"}ms | overlay shown=${m.overlayShownAt ?? "never"} gone=${m.overlayGone ?? "n/a"} | activationStart=${nav?.activationStart ?? "?"} | nav=${JSON.stringify(nav)}`);
  } else {
    log("B: back anchor never appeared");
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- C) hydrated double-tap (the "second click" report) ----------
{
  const { targetId, sessionId } = await newTarget({ blockCache: false });
  await goto(sessionId, PDP);
  await sleep(9000);
  const t0 = Date.now();
  const c1 = await realClick(ws, sessionId, FIND_BACK);
  await sleep(250);
  const c2 = await realClick(ws, sessionId, FIND_BACK).catch(() => false);
  const m = await pollMilestones(sessionId, t0);
  const path = await evalJs(ws, sessionId, `location.pathname`).catch(() => "?");
  const cards = await evalJs(ws, sessionId, CARD_COUNT).catch(() => "?");
  const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
  log(`C[double-tap] clicks=${c1}+${c2} | final path=${path} | tap->hero=${m.hero ?? "TIMEOUT"}ms | cards=${cards} | activationStart=${nav?.activationStart ?? "?"}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- D) header logo tap from PDP (goToView("home") path) ----------
{
  const { targetId, sessionId } = await newTarget({ blockCache: false });
  await goto(sessionId, PDP);
  await sleep(12000);
  const t0 = Date.now();
  const clicked = await realClick(ws, sessionId, `document.querySelector('button[aria-label*="home" i], header button')`);
  if (clicked) {
    const m = await pollMilestones(sessionId, t0);
    const nav = await evalJs(ws, sessionId, NAV_T).catch(() => null);
    log(`D[logo-tap] tap->hero=${m.hero ?? "TIMEOUT"}ms | activationStart=${nav?.activationStart ?? "?"} | nav=${JSON.stringify(nav)}`);
  } else {
    log("D: logo not found");
  }
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

ws.close();
console.log("DONE");
