// Task 43 — Live verification of "Continue with Google":
// 1. /?view=account (signed out) → "Sign in" button → auth modal opens
// 2. "Continue with Google" button present (screenshot)
// 3. Click it → browser must navigate away toward Google
//    (accounts.google.com = provider + redirect config OK; supabase error
//    page or staying on hayaan.co = misconfiguration)
// Usage: bun scripts/google-oauth-verify-cdp.mjs

const DEBUG_PORT = 9333;
const SHOT = "/home/z/my-project/download/google-signin-modal.png";

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

function waitEvent(ws, eventName, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === eventName) { clearTimeout(t); ws.removeEventListener("message", onMsg); resolve(msg.params); }
    };
    ws.addEventListener("message", onMsg);
  });
}

async function evalJson(ws, sessionId, expression) {
  const { result } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  return JSON.parse(result.value);
}

function clickByText(ws, sessionId, text) {
  return sendCmd(ws, "Runtime.evaluate", {
    expression: `(() => {
      const els = [...document.querySelectorAll('button')];
      const b = els.find(e => e.textContent.trim().includes('${text}'));
      if (!b) return 'NOT FOUND';
      b.click();
      return 'clicked';
    })()`,
    returnByValue: true,
  }, sessionId);
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired").catch(() => null);
await sendCmd(ws, "Page.navigate", { url: "https://hayaan.co/?view=account" }, sessionId);
await loadPromise;
console.log("loaded /?view=account, waiting for boot…");
await new Promise((r) => setTimeout(r, 5000));

const signin = await clickByText(ws, sessionId, "Sign in");
console.log("sign-in button:", signin.result?.value ?? signin);
await new Promise((r) => setTimeout(r, 1500));

const modal = await evalJson(ws, sessionId, `JSON.stringify({
  googleBtn: !!([...document.querySelectorAll('button')].find(e => e.textContent.includes('Continue with Google'))),
  dialogOpen: !!document.querySelector('[role="dialog"]')
})`);
console.log("modal:", modal);

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write(SHOT, Buffer.from(shot.data, "base64"));
console.log("screenshot:", SHOT);

if (!modal.googleBtn) {
  console.log("FAIL: Google button not found in modal");
  await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
  ws.close();
  process.exit(1);
}

console.log("clicking Continue with Google, watching navigation…");
await clickByText(ws, sessionId, "Continue with Google");

let final = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const st = await evalJson(ws, sessionId, `JSON.stringify({ href: location.href, ready: document.readyState })`);
    if (!st.href.includes("hayaan.co")) { final = st.href; break; }
  } catch { /* navigating */ }
}
console.log("final URL:", final ?? "STILL ON hayaan.co");

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();

if (final && /accounts\.google\.(com|co)/.test(final)) {
  console.log("PASS: reached Google OAuth consent/sign-in page");
} else if (final) {
  console.log("WARN: navigated away but NOT to Google — inspect URL above (likely Supabase redirect/URL config)");
} else {
  console.log("FAIL: browser never left hayaan.co");
}
