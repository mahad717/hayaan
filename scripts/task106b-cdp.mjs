// Task 106b — (1) probe whether headless Chrome attempts prerendering the
// PDP's speculationrules target "/" (Preload CDP domain events), and
// (2) rerun the double-tap + logo-tap scenarios with wedge-proof timeouts.

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
function sendCmd(ws, method, params = {}, sessionId = null, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
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
    sessionId, 8000
  );
  if (exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(exceptionDetails).slice(0, 200)}`);
  return result.value;
}
async function tryEval(ws, sessionId, expression, fallback = null) {
  try { return await evalJs(ws, sessionId, expression); } catch { return fallback; }
}
async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const preloadEvents = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method && msg.method.startsWith("Preload.")) {
    preloadEvents.push({ method: msg.method, params: JSON.stringify(msg.params).slice(0, 400) });
  }
});

async function newTarget() {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId).catch(() => {});
  await sendCmd(ws, "Runtime.enable", {}, sessionId).catch(() => {});
  await sendCmd(ws, "Preload.enable", {}, sessionId).catch((e) => console.log("Preload.enable failed: " + e.message));
  await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId).catch(() => {});
  await sendCmd(ws, "Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId).catch(() => {});
  await sendCmd(ws, "Network.enable", {}, sessionId).catch(() => {});
  await sendCmd(ws, "Network.setBlockedURLs", { urls: ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif", "*.mp4"] }, sessionId).catch(() => {});
  await sendCmd(ws, "Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000 }, sessionId).catch(() => {});
  return { targetId, sessionId };
}

async function goto(sessionId, url) {
  const loadPromise = new Promise((resolve) => {
    const onMsg = (ev) => {
      if (JSON.parse(ev.data).method === "Page.loadEventFired") {
        ws.removeEventListener("message", onMsg);
        resolve(true);
      }
    };
    ws.addEventListener("message", onMsg);
    setTimeout(() => resolve(false), 60000);
  });
  await sendCmd(ws, "Page.navigate", { url }, sessionId);
  await loadPromise;
}

const HERO_OK = `location.pathname === "/" && (() => { const h = document.querySelector("h1"); return !!h && h.offsetParent !== null && /Find what you need/.test(h.textContent || ""); })()`;
const CARD_COUNT = `Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a => a.offsetParent !== null).length`;
const FIND_BACK = `(function(){ var all = Array.from(document.querySelectorAll('a[href="/"]')); return all.find(a => /Back to shop/.test(a.textContent||"")) || all[0] || null; })()`;

async function realClick(ws, sessionId, findExpr) {
  const pt = await tryEval(ws, sessionId, `(function(){
    var a = ${findExpr};
    if (!a) return null;
    a.scrollIntoView({ block: "center" });
    var r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!pt) return false;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await sendCmd(ws, "Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 }, sessionId, 8000).catch(() => {});
  }
  return true;
}

async function pollHero(sessionId, t0, capMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await sleep(120);
    if (await tryEval(ws, sessionId, HERO_OK, false)) return Date.now() - t0;
  }
  return null;
}

const t_start = Date.now();
function log(s) { console.log(`[${Math.round((Date.now() - t_start) / 1000)}s] ${s}`); }

// ---------- P0: prerender attempt probe ----------
{
  preloadEvents.length = 0;
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  log("P0: PDP loaded — listening 18s for Preload events (prerender attempt?)");
  await sleep(18000);
  log(`P0: preload events = ${preloadEvents.length}`);
  for (const e of preloadEvents.slice(0, 12)) log(`   ${e.method} ${e.params}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- C: hydrated double-tap ----------
{
  preloadEvents.length = 0;
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  await sleep(8000);
  const t0 = Date.now();
  const c1 = await realClick(ws, sessionId, FIND_BACK);
  await sleep(250);
  // Second tap: whatever is under the same point now (old PDP back link or
  // already-swapped home) — mirrors the owner tapping twice in a hurry.
  const c2 = await realClick(ws, sessionId, FIND_BACK).catch(() => false);
  const hero = await pollHero(sessionId, t0);
  await sleep(1200);
  const path = await tryEval(ws, sessionId, `location.pathname`, "?");
  const cards = await tryEval(ws, sessionId, CARD_COUNT, "?");
  const nav = await tryEval(ws, sessionId, `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), activationStart: Math.round(n.activationStart || 0), type: n.type } : null; })()`, null);
  log(`C[double-tap] clicks=${c1}+${c2} | tap1->hero=${hero ?? "TIMEOUT"}ms | final path=${path} | cards=${cards} | nav=${JSON.stringify(nav)}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

// ---------- D: header logo tap from PDP ----------
{
  preloadEvents.length = 0;
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, PDP);
  await sleep(10000);
  const t0 = Date.now();
  const clicked = await realClick(ws, sessionId, `document.querySelector('header button')`);
  const hero = await pollHero(sessionId, t0);
  await sleep(1200);
  const path = await tryEval(ws, sessionId, `location.pathname`, "?");
  const nav = await tryEval(ws, sessionId, `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), activationStart: Math.round(n.activationStart || 0), type: n.type } : null; })()`, null);
  log(`D[logo-tap] clicked=${clicked} | tap->hero=${hero ?? "TIMEOUT"}ms | final path=${path} | nav=${JSON.stringify(nav)}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

ws.close();
console.log("DONE");
