// Task 39 — Verify the header logo text got bolder on https://hayaan.co
// Expect: outer span ("Hayaan") computed font-weight 900, inner ("Market") 700.
// Same CDP pattern as ga-verify-cdp.mjs. Chrome must be launched in the SAME
// bash command (processes don't survive between tool invocations).

const DEBUG_PORT = 9333;
const LAUNCH_URL = "https://hayaan.co";
const SHOT_PATH = "/home/z/my-project/download/logo-bolder-header.png";

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => {
      ws.close();
      reject(new Error("ws connect timeout"));
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(t);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws error"));
    };
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

function waitEvent(ws, eventName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === eventName) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        resolve(msg.params);
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
console.log("browser: " + versionInfo.Browser);
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
console.log("attached to browser ws");

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });

await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired", 45000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: LAUNCH_URL }, sessionId);
await loadPromise;
console.log("page loaded, waiting 4s for hydration/fonts…");
await new Promise((r) => setTimeout(r, 4000));

const { result } = await sendCmd(
  ws,
  "Runtime.evaluate",
  {
    expression: `(() => {
      const root = document.querySelector('button[aria-label="Hayaan Market home"]');
      if (!root) return JSON.stringify({ found: false });
      const outer = root.querySelector('span');
      const inner = outer ? outer.querySelector('span') : null;
      const so = getComputedStyle(outer), si = getComputedStyle(inner);
      const clip = root.getBoundingClientRect();
      return JSON.stringify({
        found: true,
        outerWeight: so.fontWeight,
        outerColor: so.color,
        outerFamily: so.fontFamily.slice(0, 40),
        innerWeight: si.fontWeight,
        innerColor: si.color,
        logoRect: { x: Math.round(clip.x), y: Math.round(clip.y), w: Math.round(clip.width), h: Math.round(clip.height) }
      });
    })()`,
    returnByValue: true,
  },
  sessionId
);
const v = JSON.parse(result.value);
console.log(JSON.stringify(v, null, 2));

// Screenshot the header strip only (logo sits at top-left)
const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1440, height: 120, scale: 1 } }, sessionId);
await Bun.write(SHOT_PATH, Buffer.from(shot.data, "base64"));
console.log("screenshot saved: " + SHOT_PATH);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();

const pass = v.found && v.outerWeight === "900" && v.innerWeight === "700";
console.log(pass ? "PASS: logo text is bolder (900/700)" : "FAIL: weights unchanged or wrong");
process.exit(pass ? 0 : 1);
