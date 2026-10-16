// Task 107 — verify "Back to shop" returns the shopper to their grid
// position (the owner's newest report: native back restores position, but
// the back-link lands on the hero).
//
// Fix under test (src/app/page.tsx): inline pre-hydration script on the
// home page that (a) saves the last shop scroll offset to sessionStorage
// (throttled scroll listener + pagehide flush, runs BEFORE React hydrates),
// and (b) on arrival FROM a product page (referrer path /product/*, clean
// "/", saved < 30 min) restores the offset — including on the Speculation
// Rules prerendered copy (deferred to prerenderingchange).
//
// Scenarios:
//   S1 real journey, JS on  : home -> scroll 1500 -> click product -> PDP
//                             -> click "Back to shop" -> expect scrollY ~= 1500
//   S2 real journey, JS OFF : block every /_next/ chunk (pre-hydration
//                             worst case, the owner's A18 flow) -> same
//                             journey via plain anchors -> expect ~= 1200
//   S3 referrer gate        : seeded save + arrival with NON-product
//                             referrer (external) -> expect NO restore (y=0)
//   S4 referrer gate        : seeded save + arrival with product referrer
//                             -> expect restore (y ~= 1500)
//   S5 stale gate           : seeded save aged 31 min + product referrer
//                             -> expect NO restore (y=0)
//   S6 prerender branch     : document.prerendering forced true from first
//                             script, prerenderingchange dispatched after
//                             load + product referrer -> expect restore
//
// Run: chrome --headless=new --remote-debugging-port=9339 & node this.mjs

import fs from "node:fs";

const DEBUG_PORT = 9339;
const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/scripts/task107-results.json";
const ONLY = (process.env.SCENARIOS || "S1,S2,S3,S4,S5,S6").split(",");
const has = (s) => ONLY.includes(s);

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

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("browser: " + versionInfo.Browser);

const results = {};
const t0 = Date.now();
const log = (m) => { console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${m}`); };
const flush = () => { try { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); } catch {} };

async function newTarget({ blockJs = false } = {}) {
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  await sendCmd(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  await sendCmd(ws, "Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
  await sendCmd(ws, "Network.enable", {}, sessionId);
  await sendCmd(ws, "Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  const blocked = ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.avif", "*.gif", "*.mp4"];
  if (blockJs) blocked.push("*://hayaan.co/_next/*");
  await sendCmd(ws, "Network.setBlockedURLs", { urls: blocked }, sessionId);
  await sendCmd(ws, "Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 125000, uploadThroughput: 64000,
  }, sessionId);
  return { targetId, sessionId };
}

async function goto(sessionId, url, referrer) {
  const loadPromise = waitEvent(ws, "Page.loadEventFired", 120000).catch(() => null);
  const params = { url };
  if (referrer !== undefined) params.referrer = referrer;
  await sendCmd(ws, "Page.navigate", params, sessionId);
  await loadPromise;
}

// Real trusted click at the center of an element found by expression.
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

const FIND_CARD = `(function(){
  var links = Array.from(document.querySelectorAll('a[href^="/product/"]'));
  return links.find(a => a.offsetParent !== null && a.getBoundingClientRect().width > 0) || null;
})()`;

const FIND_BACK = `(function(){
  var all = Array.from(document.querySelectorAll('a[href="/"]'));
  return all.find(a => /Back to shop/i.test(a.textContent || "")) || null;
})()`;

const BACK_DIAG = `(function(){
  var all = Array.from(document.querySelectorAll('a[href="/"]'));
  return { count: all.length, texts: all.map(function(a){ return (a.textContent||'').trim().slice(0,30); }).slice(0,6) };
})()`;

async function pollScrollY(ws, sessionId, target, timeoutMs = 6000) {
  const start = Date.now();
  let firstHit = null;
  while (Date.now() - start < timeoutMs) {
    const y = await evalJs(ws, sessionId, "window.scrollY | 0");
    if (target !== null && Math.abs(y - target) <= 150 && firstHit === null) firstHit = Date.now() - start;
    if (firstHit !== null && Date.now() - start > firstHit + 1500) {
      const y2 = await evalJs(ws, sessionId, "window.scrollY | 0");
      return { y: y2, stuck: Math.abs(y2 - target) <= 150, msToRestore: firstHit };
    }
    if (target === null && y > 0 && Date.now() - start > 3000) return { y, stuck: null, msToRestore: null };
    await sleep(250);
  }
  return { y: await evalJs(ws, sessionId, "window.scrollY | 0"), stuck: false, msToRestore: null };
}

const SEED = (y, ageMs = 0) => `try{sessionStorage.setItem("hayaanShopY", JSON.stringify({y:${y},t:Date.now()-${ageMs}}))}catch(e){} "seeded"`;

// Wait until an expression turns truthy (poll every 250ms).
async function waitFor(sessionId, expr, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await evalJs(ws, sessionId, expr)) return true; } catch {}
    await sleep(250);
  }
  return false;
}

// ---------- S1: real journey, JS on (hydrated or not — both valid) ----------
if (has("S1")) try {
  log("S1: real journey, JS on");
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, `${BASE}/`);
  await sleep(3000); // let hydration happen (4x CPU throttle)
  await evalJs(ws, sessionId, "window.scrollTo(0, 1500)");
  await sleep(600); // trailing-throttle save flush
  const saved = await evalJs(ws, sessionId, `sessionStorage.getItem("hayaanShopY")`);
  log(`S1 saved after scroll: ${saved}`);
  const clicked = await realClick(ws, sessionId, FIND_CARD);
  const onPdp = await waitFor(sessionId, `location.pathname.indexOf("/product/") === 0 && (${FIND_BACK}) !== null`, 30000);
  const pdpUrl = await evalJs(ws, sessionId, "location.pathname");
  const backDiag = await evalJs(ws, sessionId, BACK_DIAG);
  log(`S1 on PDP: ${pdpUrl} (clicked=${clicked}, backAnchors=${backDiag.count})`);
  const backClicked = await realClick(ws, sessionId, FIND_BACK);
  const onHome = await waitFor(sessionId, "location.pathname === \"/\" && !!document.querySelector(\"#catalog\")", 25000);
  const url = await evalJs(ws, sessionId, "location.pathname");
  const r = await pollScrollY(ws, sessionId, 1500);
  results.s1 = { clicked, backClicked, onPdp, pdpUrl, backDiag, onHome, url, ...r };
  log(`S1 RESULT: url=${url} scrollY=${r.y} target=1500 stuck=${r.stuck} msToRestore=${r.msToRestore}`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s1 = { error: String(e).slice(0, 200) }; flush(); log("S1 ERROR: " + e); }

// ---------- S2: real journey, ALL app JS blocked (pre-hydration worst case) ----------
if (has("S2")) try {
  log("S2: real journey, /_next JS blocked");
  const { targetId, sessionId } = await newTarget({ blockJs: true });
  await goto(sessionId, `${BASE}/`);
  const hasScript = await evalJs(ws, sessionId, `!!window.__hayaanShopScroll`);
  await evalJs(ws, sessionId, "window.scrollTo(0, 1200)");
  await sleep(600);
  const saved = await evalJs(ws, sessionId, `sessionStorage.getItem("hayaanShopY")`);
  log(`S2 saver-inline=${hasScript} saved=${saved}`);
  const clicked = await realClick(ws, sessionId, FIND_CARD);
  const onPdp = await waitFor(sessionId, `location.pathname.indexOf("/product/") === 0 && (${FIND_BACK}) !== null`, 30000);
  const pdpUrl = await evalJs(ws, sessionId, "location.pathname");
  const backDiag = await evalJs(ws, sessionId, BACK_DIAG);
  log(`S2 on PDP: ${pdpUrl} (clicked=${clicked}, backAnchors=${backDiag.count})`);
  const backClicked = await realClick(ws, sessionId, FIND_BACK);
  const onHome = await waitFor(sessionId, "location.pathname === \"/\" && !!document.querySelector(\"#catalog\")", 25000);
  const url = await evalJs(ws, sessionId, "location.pathname");
  const r = await pollScrollY(ws, sessionId, 1200);
  results.s2 = { hasScript, saved, clicked, backClicked, onPdp, pdpUrl, backDiag, onHome, url, ...r };
  log(`S2 RESULT: url=${url} scrollY=${r.y} target=1200 stuck=${r.stuck} msToRestore=${r.msToRestore}`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s2 = { error: String(e).slice(0, 200) }; flush(); log("S2 ERROR: " + e); }

// ---------- S3: referrer gate — external arrival must NOT restore ----------
if (has("S3")) try {
  log("S3: gate — external referrer");
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, `${BASE}/`);
  await evalJs(ws, sessionId, SEED(1500));
  await goto(sessionId, `${BASE}/`, "https://example.com/some-blog");
  await sleep(2500);
  const r = await pollScrollY(ws, sessionId, null, 4000);
  results.s3 = { ...r };
  log(`S3 RESULT: scrollY=${r.y} (expect 0 — external referrer must not restore)`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s3 = { error: String(e).slice(0, 200) }; flush(); log("S3 ERROR: " + e); }

// ---------- S4: product referrer arrival DOES restore ----------
// NOTE: seed must survive the FIRST page's pagehide flush — scroll the first
// page to the seed offset so the flush writes a consistent {y:1500} (a bare
// sessionStorage seed on a y=0 page is clobbered to {y:0} on navigate-away,
// which made early S4 runs read as "no restore").
if (has("S4")) try {
  log("S4: gate — product referrer restores");
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, `${BASE}/`);
  await evalJs(ws, sessionId, `window.scrollTo(0,1500)`);
  await evalJs(ws, sessionId, SEED(1500));
  await sleep(500);
  await goto(sessionId, `${BASE}/`, `${BASE}/product/samsung-galaxy-a18`);
  const r = await pollScrollY(ws, sessionId, 1500);
  results.s4 = { ...r };
  log(`S4 RESULT: scrollY=${r.y} stuck=${r.stuck} msToRestore=${r.msToRestore} (expect ~1500)`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s4 = { error: String(e).slice(0, 200) }; flush(); log("S4 ERROR: " + e); }

// ---------- S5: stale (>30 min) save must NOT restore ----------
// Same pagehide-flush rule as S4: the aged seed would be clobbered by a
// fresh {y:0} flush, so scroll the first page to keep the write consistent
// (the 31-min age still comes from the seeded t).
if (has("S5")) try {
  log("S5: gate — stale save");
  const { targetId, sessionId } = await newTarget();
  await goto(sessionId, `${BASE}/`);
  await evalJs(ws, sessionId, `window.scrollTo(0,1500)`);
  await evalJs(ws, sessionId, SEED(1500, 31 * 60 * 1000));
  await sleep(500);
  await goto(sessionId, `${BASE}/`, `${BASE}/product/samsung-galaxy-a18`);
  await sleep(2500);
  const r = await pollScrollY(ws, sessionId, null, 4000);
  results.s5 = { ...r };
  log(`S5 RESULT: scrollY=${r.y} (expect 0 — save older than 30 min)`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s5 = { error: String(e).slice(0, 200) }; flush(); log("S5 ERROR: " + e); }

// ---------- S6: prerendered-copy branch (prerenderingchange) ----------
if (has("S6")) try {
  log("S6: prerender branch via forced document.prerendering");
  const { targetId, sessionId } = await newTarget();
  // Define a controllable document.prerendering BEFORE any page script runs.
  await sendCmd(ws, "Page.addScriptToEvaluateOnNewDocument", {
    source: `Object.defineProperty(document, "prerendering", { configurable: true, get: function(){ return document.__hayaanFakePr !== false; } });`,
  }, sessionId);
  await goto(sessionId, `${BASE}/`, `${BASE}/product/samsung-galaxy-a18`);
  await evalJs(ws, sessionId, SEED(1500));
  await sleep(1500);
  const yBefore = await evalJs(ws, sessionId, "window.scrollY | 0");
  // Activate: flip prerendering -> false and fire prerenderingchange.
  await evalJs(ws, sessionId,
    `document.__hayaanFakePr = false; document.dispatchEvent(new Event("prerenderingchange")); "fired"`);
  const r = await pollScrollY(ws, sessionId, 1500, 5000);
  results.s6 = { yBefore, ...r };
  log(`S6 RESULT: yBefore=${yBefore} scrollY=${r.y} (expect ~1500 after prerenderingchange)`);
  flush();
  await sendCmd(ws, "Target.closeTarget", { targetId });
} catch (e) { results.s6 = { error: String(e).slice(0, 200) }; flush(); log("S6 ERROR: " + e); }

fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
log("DONE -> " + OUT);
console.log(JSON.stringify(results, null, 2));
