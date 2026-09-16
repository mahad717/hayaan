// Catch the jam red-handed: stream console errors + Debugger.pause() the
// main thread mid-jam and print the JS stack (function, url, line).
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
await sendCmd(ws, "Debugger.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);

const t0 = Date.now();
const evT = () => Date.now() - t0;

ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.consoleAPICalled") {
    const p = m.params;
    const text = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 220);
    if (p.type === "error" || p.type === "warning" || /Error|error|Maximum|loop/i.test(text)) {
      console.log(`[${String(evT()).padStart(6)}ms] console.${p.type}: ${text}`);
    }
  }
  if (m.method === "Runtime.exceptionThrown") {
    console.log(`[${String(evT()).padStart(6)}ms] EXCEPTION: ${String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || "").slice(0, 300)}`);
  }
  if (m.method === "Debugger.paused") {
    const frames = m.params.callFrames.slice(0, 14);
    console.log(`\n[${String(evT()).padStart(6)}ms] ===== DEBUGGER PAUSED — MAIN THREAD STACK =====`);
    for (const f of frames) {
      const loc = f.location ? ` (${(f.url || "").replace("https://hayaan.co", "")}:${f.location.lineNumber}:${f.location.columnNumber})` : "";
      console.log(`  ${f.functionName || "(anonymous)"}${loc}`);
    }
    console.log("================================================\n");
    sendCmd(ws, "Debugger.resume", {}, sessionId).catch(() => {});
  }
});

await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});
console.log(`[${String(evT()).padStart(6)}ms] navigated, waiting 12s then pausing...`);
await sleep(12000);
await sendCmd(ws, "Debugger.pause", {}, sessionId).catch((e) => console.log("pause failed:", e.message.slice(0, 80)));
await sleep(4000);
// pause again in case the first hit a quiet moment
await sendCmd(ws, "Debugger.pause", {}, sessionId).catch(() => {});
await sleep(4000);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
