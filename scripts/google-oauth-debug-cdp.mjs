// Task 43 diagnostics — why doesn't the Google flow start?
// 1. open /?view=account → Sign in → modal
// 2. click Continue with Google
// 3. sample for 8s: resource requests to supabase.co, sonner toasts,
//    sb-* cookies (PKCE verifier), location.href
const DEBUG_PORT = 9333;

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

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

// Wrap window.location assignment to observe attempted nav even if blocked.
await sendCmd(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__navLog = [];
    for (const key of ['href','assign','replace']) {
      try {
        const orig = window.location[key].bind(window.location);
        window.location[key] = (...args) => { window.__navLog.push(String(args[0] ?? '')); return orig(...args); };
      } catch {}
    }`,
}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired").catch(() => null);
await sendCmd(ws, "Page.navigate", { url: "https://hayaan.co/?view=account" }, sessionId);
await loadPromise;
await new Promise((r) => setTimeout(r, 5000));

await sendCmd(ws, "Runtime.evaluate", {
  expression: `[...document.querySelectorAll('button')].find(e => e.textContent.trim().includes('Sign in'))?.click()`,
}, sessionId);
await new Promise((r) => setTimeout(r, 1500));

const clickRes = await sendCmd(ws, "Runtime.evaluate", {
  expression: `(() => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Continue with Google'));
    if (!b) return 'NOT FOUND';
    b.click();
    return 'clicked';
  })()`,
  returnByValue: true,
}, sessionId);
console.log("google click:", clickRes.result?.value);

for (const t of [2, 4, 8]) {
  await new Promise((r) => setTimeout(r, t === 2 ? 2000 : t === 4 ? 2000 : 4000));
  const st = await evalJson(ws, sessionId, `JSON.stringify({
    href: location.href,
    navLog: window.__navLog ?? [],
    toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(e => e.textContent),
    sbCookies: document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(n => n.startsWith('sb-')),
    supabaseReqs: performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('supabase')).slice(-5)
  })`).catch(() => ({ err: "eval failed (navigating?)" }));
  console.log(`t+${t}s:`, JSON.stringify(st, null, 2));
  if (st.href && !st.href.includes("hayaan.co")) break;
}

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();
