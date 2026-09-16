// Matrix: does the remote .png-named JPEG wedge reliably? Do the same bytes
// served locally as .jpg / .png wedge? (file:// avoids network variables)
import fs from "fs";
const DEBUG_PORT = 9333;
const REMOTE = "https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725483330-085f6bde-b327-4b93-8b76-ab85e8af903b.png";
const LOCAL_JPG = "file:///tmp/poison-as-jpg.jpg";
const LOCAL_PNG = "file:///tmp/poison-as-png.png";

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

async function testUrl(url, label) {
  let { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const sessionId = (await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true })).sessionId;
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);
  let verdict = "OK";
  try { await sendCmd(ws, "Page.navigate", { url }, sessionId); } catch {}
  for (let k = 0; k < 6; k++) {
    await sleep(1500);
    try {
      await sendCmd(ws, "Runtime.evaluate", { expression: `1+1`, returnByValue: true }, sessionId);
    } catch { verdict = `JAM at +${((k + 1) * 1.5).toFixed(1)}s`; break; }
  }
  console.log(`${verdict.padEnd(16)} ${label}`);
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
}

await testUrl(REMOTE, "remote .png (jpeg bytes) run A");
await testUrl(REMOTE, "remote .png (jpeg bytes) run B");
await testUrl(LOCAL_JPG, "local file .jpg (same bytes)");
await testUrl(LOCAL_PNG, "local file .png (same bytes)");
ws.close();
console.log("DONE");
