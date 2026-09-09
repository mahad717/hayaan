// Bisect the renderer wedge: MODE=images | js | fonts | none | all-off
// MODE=images  -> block all image loads (unsplash, supabase storage, svg)
// MODE=js      -> disable script execution entirely
// MODE=fonts   -> block font loads
// MODE=css     -> block stylesheets
const DEBUG_PORT = 9333;
const TARGET = "https://hayaan.co/";
const MODE = process.argv[2] || "images";

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
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);

const blocked = [];
if (MODE === "images") blocked.push("*unsplash*", "*supabase.co/storage*", "*.svg", "*.jpg*", "*.png*", "*.avif*", "*.webp*");
if (MODE === "fonts") blocked.push("*.woff2", "*.otf", "*.ttf", "*.woff");
if (MODE === "css") blocked.push("*.css");
if (blocked.length) {
  await sendCmd(ws, "Network.setBlockedURLs", { urls: blocked }, sessionId);
  console.log(`blocked: ${blocked.join(", ")}`);
}
if (MODE === "js" || MODE === "all-off") {
  await sendCmd(ws, "Emulation.setScriptExecutionDisabled", { value: true }, sessionId);
  console.log("script execution disabled");
}

const t0 = Date.now();
let jamAt = null;
console.log(`--- MODE=${MODE} ---`);
await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});
for (let k = 0; k < 10; k++) {
  await sleep(2000);
  try {
    const st = await sendCmd(ws, "Runtime.evaluate", {
      expression: `JSON.stringify({t: Math.round(performance.now()), cards: document.querySelectorAll('a[href^="/product/"]').length, pulse: document.querySelectorAll('.animate-pulse').length})`,
      returnByValue: true,
    }, sessionId);
    console.log(`+${String(Date.now() - t0).padStart(6)}ms OK ${st.result.value}`);
  } catch (e) {
    if (jamAt === null) jamAt = Date.now() - t0;
    console.log(`+${String(Date.now() - t0).padStart(6)}ms JAM (${e.message.slice(0, 40)})`);
  }
}
console.log(jamAt === null ? `RESULT: never jammed in 20s (MODE=${MODE})` : `RESULT: jammed at +${jamAt}ms (MODE=${MODE})`);

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId).catch(() => null);
if (shot) {
  const fs = await import("fs");
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync(`/home/z/my-project/download/debug-bisect-${MODE}.png`, Buffer.from(shot.data, "base64"));
  console.log("screenshot saved");
}
await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
