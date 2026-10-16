// Task 107 — S4 isolation probe (v2): why did the seeded product-referrer
// arrival NOT restore? Replays S4 with per-gate diagnostics from inside the
// page. Uses ONLY the raw patterns verified to work in this sandbox:
// fetch for /json/list, persistent onmessage dispatcher, single page socket.
const DEBUG_PORT = 9339;
const BASE = "https://hayaan.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
const page = pages.find(t => t.type === "page");
console.log("tab:", page.id, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error("ws error")); });
console.log("OPEN");

let msgId = 0;
const pending = new Map();
const eventWaiters = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    p(msg);
  } else if (msg.method) {
    for (let i = eventWaiters.length - 1; i >= 0; i--) {
      if (eventWaiters[i].method === msg.method) { eventWaiters[i].resolve(msg); eventWaiters.splice(i, 1); }
    }
  }
};
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${method}`)); }, 45000);
    pending.set(id, (msg) => {
      clearTimeout(t);
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function waitEvent(method, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${method}`)), timeoutMs);
    eventWaiters.push({
      method,
      resolve: (msg) => { clearTimeout(t); resolve(msg); },
    });
  });
}
async function evalJs(expression) {
  const r = await cmd("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r.result.value;
}
async function goto(url, referrer) {
  const params = { url, transitionType: "link" };
  if (referrer) params.referrer = referrer;
  await cmd("Page.navigate", params);
  // Poll readyState (loadEventFired can be lost around same-URL navigations)
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    try {
      if ((await evalJs("document.readyState")) === "complete") return;
    } catch {}
    await sleep(300);
  }
  throw new Error("goto: readyState never complete");
}

await cmd("Runtime.enable");
await cmd("Page.enable");
await cmd("Emulation.setCPUThrottlingRate", { rate: 4 });
await cmd("Network.emulateNetworkConditions", {
  offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
});
console.log("devtools session ready (CPU 4x, 300ms RTT, 1Mbps)");

// 1. First visit, seed the save
await goto(`${BASE}/`);
await sleep(1500);
console.log("seed:", await evalJs(`sessionStorage.setItem("hayaanShopY", JSON.stringify({y:1500,t:Date.now()})); "ok"`));

// 2. Navigate again WITH product referrer (exactly like S4)
await goto(`${BASE}/`, `${BASE}/product/samsung-galaxy-a18`);

// 3. Sample diagnostics every 300ms for ~5s
for (let i = 0; i < 17; i++) {
  const d = await evalJs(`(function(){
    var seed=null; try{seed=sessionStorage.getItem("hayaanShopY")}catch(e){seed="ERR"}
    return {
      t: Date.now(),
      y: window.scrollY|0,
      referrer: (document.referrer||"").slice(0,80),
      marker: !!window.__hayaanShopScroll,
      prerendering: !!document.prerendering,
      readyState: document.readyState,
      docH: document.documentElement.scrollHeight|0,
      seed: seed ? seed.slice(0,60) : null
    };
  })()`);
  console.log(`t+${i * 300}ms`, JSON.stringify(d));
  await sleep(300);
}
console.log("PROBE DONE");
process.exit(0);
