// Full request lifecycle timeline for one plain visit to hayaan.co (unthrottled).
// Answers: WHICH requests stall and how long (requestWillBeSent->loadingFinished)?
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 20000);
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
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);

const reqs = new Map(); // requestId -> {sent, url, type, responseT, endT, encoded, fromCache}
const t0 = Date.now();
const evT = () => Date.now() - t0;
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId !== sessionId) return;
  const p = m.params || {};
  if (m.method === "Network.requestWillBeSent") {
    reqs.set(p.requestId, { sent: evT(), url: p.request.url, type: p.type, wallSent: Date.now() });
  } else if (m.method === "Network.responseReceived") {
    const r = reqs.get(p.requestId);
    if (r) { r.responseT = evT(); r.status = p.response.status; r.encoded = p.response.encodedDataLength; r.fromCache = p.response.fromDiskCache; }
  } else if (m.method === "Network.loadingFinished") {
    const r = reqs.get(p.requestId);
    if (r) { r.endT = evT(); r.encoded = p.encodedDataLength; }
  } else if (m.method === "Network.loadingFailed") {
    const r = reqs.get(p.requestId);
    if (r) { r.endT = evT(); r.failed = p.errorText; }
  }
});

console.log("navigating (unthrottled, fresh profile)...");
await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});

// sample page state + wait 40s total
for (let k = 0; k < 8; k++) {
  await sleep(5000);
  try {
    const st = await sendCmd(ws, "Runtime.evaluate", {
      expression: `JSON.stringify({cards: document.querySelectorAll('a[href^="/product/"]').length, pulse: document.querySelectorAll('.animate-pulse').length, ready: document.readyState})`,
      returnByValue: true,
    }, sessionId);
    console.log(`+${String(evT()).padStart(6)}ms page: ${st.result.value}`);
  } catch (e) {
    console.log(`+${String(evT()).padStart(6)}ms EVAL FAIL: ${e.message.slice(0, 60)}`);
  }
}

console.log("\n=== request timeline (sorted by sent) ===");
const rows = [...reqs.values()].sort((a, b) => a.sent - b.sent);
for (const r of rows) {
  const url = r.url.replace("https://hayaan.co", "").replace("https://mqyhgyakhfhuctnvezby.supabase.co", "[supabase]").replace("https://images.unsplash.com", "[unsplash]").slice(0, 80);
  const dur = r.endT != null ? `${r.endT}ms (resp@${r.responseT})` : (r.responseT != null ? `RESP@${r.responseT} NEVER-FINISHED` : "NO-RESPONSE");
  console.log(`sent@${String(r.sent).padStart(6)} ${r.status ?? "---"} ${dur.padEnd(34)} ${url}${r.failed ? " FAILED:" + r.failed : ""}`);
}

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId).catch((e) => null);
if (shot) {
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync("/home/z/my-project/download/debug-home-timeline.png", Buffer.from(shot.data, "base64"));
  console.log("\nscreenshot saved");
}
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
