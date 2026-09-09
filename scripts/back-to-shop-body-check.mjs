// Decisive: capture the main-frame response BODY of hayaan.co in chrome and
// every response status — is Cloudflare serving a challenge to the browser?
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
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);

const responses = [];
const mainFrameResponses = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.sessionId !== sessionId) return;
  if (m.method === "Network.responseReceived") {
    const p = m.params;
    const entry = {
      status: p.response.status,
      url: p.response.url,
      mime: p.response.mimeType,
      type: p.type,
      requestId: p.requestId,
    };
    responses.push(entry);
    if (p.type === "Document") mainFrameResponses.push(entry);
  }
});

const t0 = Date.now();
await sendCmd(ws, "Page.navigate", { url: TARGET }, sessionId).catch(() => {});
await sleep(20000);

console.log(`=== main-frame document responses ===`);
for (const r of mainFrameResponses) {
  console.log(JSON.stringify({ status: r.status, url: r.url, mime: r.mime }));
  try {
    const body = await sendCmd(ws, "Network.getResponseBody", { requestId: r.requestId }, sessionId);
    const text = body.base64Encoded ? Buffer.from(body.body, "base64").toString("utf8") : body.body;
    console.log(`body length=${text.length}`);
    console.log(`challenge markers: just-a-moment=${/Just a moment/i.test(text)} challenge-platform=${/challenge-platform|cf-chl/i.test(text)} turnstile=${/turnstile/i.test(text)} __next=${/__next|_next/i.test(text)}`);
    fs.writeFileSync("/tmp/mainframe-body.html", text.slice(0, 200000));
    console.log("body head:", text.slice(0, 400).replace(/\n/g, " "));
  } catch (e) {
    console.log("getResponseBody failed:", e.message.slice(0, 120));
  }
}

console.log(`\n=== all responses (${responses.length}) ===`);
for (const r of responses.slice(0, 50)) {
  console.log(`${r.status} [${r.type}] ${r.mime} ${r.url.replace("https://hayaan.co", "").slice(0, 90)}`);
}

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId).catch((e) => { console.log("shot fail:", e.message.slice(0, 80)); return null; });
if (shot) {
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync("/home/z/my-project/download/debug-home-now.png", Buffer.from(shot.data, "base64"));
  console.log("\nscreenshot saved: download/debug-home-now.png");
}

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
console.log("DONE");
