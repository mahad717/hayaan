// Navigate chrome DIRECTLY to each candidate image; whichever wedges the
// renderer is the poison image.
const DEBUG_PORT = 9333;
const IMAGES = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop",
  "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725484435-41dd6a71-ae1e-46f7-a413-a46102279bae.jpg",
  "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725483330-085f6bde-b327-4b93-8b76-ab85e8af903b.png",
  "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725481334-42782eff-9837-4cf2-bb56-70377b7f2df7.jpg",
  "https://hayaan.co/hayaan-logo-green.svg",
];

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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
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
let { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
let sessionId = (await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true })).sessionId;
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

for (const url of IMAGES) {
  const label = url.replace("https://", "").slice(0, 72);
  try {
    await sendCmd(ws, "Page.navigate", { url }, sessionId);
  } catch {}
  let verdict = "OK";
  for (let k = 0; k < 5; k++) {
    await sleep(1500);
    try {
      await sendCmd(ws, "Runtime.evaluate", { expression: `1+1`, returnByValue: true }, sessionId);
    } catch (e) {
      verdict = `JAM at +${((k + 1) * 1.5).toFixed(1)}s`;
      break;
    }
  }
  console.log(`${verdict.padEnd(14)} ${label}`);
  if (verdict !== "OK") {
    // wedged renderer stays wedged — continue in a fresh tab
    await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
    const nt = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
    sessionId = (await sendCmd(ws, "Target.attachToTarget", { targetId: nt.targetId, flatten: true })).sessionId;
    targetId = nt.targetId;
    await sendCmd(ws, "Page.enable", {}, sessionId);
    await sendCmd(ws, "Runtime.enable", {}, sessionId);
  }
}
ws.close();
console.log("DONE");
