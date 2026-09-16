// Task 48 live verification: click every category pill on https://hayaan.co
// and count visible product cards. Expected (from real Supabase rows,
// worklog Task 48): All=12, Apparel=4, Beauty=2, Electronics=3, Home & Living=3.
// Screenshot the Electronics state (the user's reported failure).
// Chrome must be launched in the SAME bash command (established harness pattern).
const DEBUG_PORT = 9335;
const BASE = "https://hayaan.co";
const SHOT = "/home/z/my-project/download/filters-electronics-fixed.png";

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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 45000);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result); }
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
const send = (m, p) => sendCmd(ws, m, p, sessionId);

await send("Page.enable");
await send("Runtime.enable");
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};

await send("Page.navigate", { url: BASE });
let cards = 0;
for (let i = 0; i < 40; i++) { await sleep(500); cards = (await evalJS(`document.querySelectorAll('a[href^="/product/"]').length`)) || 0; if (cards > 0) break; }

const pillNames = await evalJS(`Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>["All","Electronics","Apparel","Beauty","Home & Living"].includes(t))`);
console.log("grid cards on load:", cards, "| pills found:", JSON.stringify(pillNames));

const clickPill = async (name) => {
  await evalJS(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()===${JSON.stringify(name)});if(b)b.click();return !!b;})()`);
  await sleep(400);
  return {
    vis: await evalJS(`Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a=>a.offsetParent!==null).length`),
    empty: await evalJS(`!!Array.from(document.querySelectorAll('p')).find(p=>p.textContent.trim()==="No products found"&&p.offsetParent!==null)`),
  };
};

const EXPECT = { "All": 12, "Electronics": 3, "Apparel": 4, "Beauty": 2, "Home & Living": 3 };
let pass = true;
for (const name of Object.keys(EXPECT)) {
  const r = await clickPill(name);
  const ok = r.vis === EXPECT[name] && !r.empty;
  if (!ok) pass = false;
  console.log(`pill "${name}": visible=${r.vis} (expect ${EXPECT[name]}) empty=${r.empty} ${ok ? "OK" : "FAIL"}`);
  if (name === "Electronics") {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    (await import("fs")).writeFileSync(SHOT, Buffer.from(data, "base64"));
    console.log("screenshot saved:", SHOT);
  }
}
console.log(pass ? "FILTERS-LIVE-VERIFY: PASS (5/5 pills)" : "FILTERS-LIVE-VERIFY: FAIL");
process.exit(pass ? 0 : 1);
