// Trace-based: enable chrome tracing (browser-level, survives renderer
// wedges), visit homepage mobile-style, then dump all trace events with
// dur > 800ms — image decodes / rasters / anything pathological, with URLs.
import fs from "fs";
const DEBUG_PORT = 9333;
const TARGET = "https://hayaan.co/";

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl); // browser-level

const traceEvents = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Tracing.dataCollected") {
    for (const e of m.params.value || []) traceEvents.push(e);
  }
});

await sendCmd(ws, "Tracing.start", {
  categories: "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-blink.image_decoders,disabled-by-default-devtools.timeline.frame,toplevel",
  options: "sampling-frequency=1000",
});

// tab session for emulation + navigation
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const sessionId = (await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true })).sessionId;
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
await sendCmd(ws, "Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }, sessionId);

const t0 = Date.now();
await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});
console.log("navigated; waiting 40s while trace collects...");
await sleep(40000);

const endP = new Promise((resolve) => {
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Tracing.tracingComplete") { resolve(); }
  };
  ws.addEventListener("message", onMsg);
  setTimeout(resolve, 15000);
});
await sendCmd(ws, "Tracing.end", {}).catch(() => {});
await endP;
await sleep(2000);

console.log(`trace events collected: ${traceEvents.length}`);
// long tasks of any kind
const long = traceEvents
  .filter((e) => typeof e.dur === "number" && e.dur > 800)
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 25);
console.log("\n=== events with dur>800ms (us units) ===");
for (const e of long) {
  const argStr = JSON.stringify(e.args || {}).slice(0, 160);
  console.log(`${String(e.dur).padStart(9)}us  ${String(e.name).slice(0, 40)}  [${String(e.cat).slice(0, 50)}]  ${argStr}`);
}
// image decode related events specifically
const img = traceEvents.filter((e) => /image|Image|decode|Decode|raster|Raster|Paint|paint/.test(e.name) && typeof e.dur === "number" && e.dur > 200);
console.log(`\n=== image/paint/decode events dur>200us: ${img.length} ===`);
for (const e of img.sort((a, b) => b.dur - a.dur).slice(0, 20)) {
  console.log(`${String(e.dur).padStart(9)}us  ${e.name}  ${JSON.stringify(e.args || {}).slice(0, 140)}`);
}
fs.writeFileSync("/tmp/trace.json", JSON.stringify(traceEvents));
ws.close();
console.log("DONE");
