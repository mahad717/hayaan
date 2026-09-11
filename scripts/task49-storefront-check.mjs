// Task 49 live check: storefront visually unchanged + filters still work.
const DEBUG_PORT = 9337;
const BASE = "https://hayaan.co";
const SHOT = "/home/z/my-project/download/task49-storefront-unchanged.png";

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws timeout")); }, timeoutMs);
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
      if (msg.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); }
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
await send("Page.enable"); await send("Runtime.enable");
const evalJS = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

await send("Page.navigate", { url: BASE });
let cards = 0;
for (let i = 0; i < 40; i++) { await sleep(500); cards = (await evalJS(`document.querySelectorAll('a[href^="/product/"]').length`)) || 0; if (cards > 0) break; }
const heroOk = await evalJS(`!!Array.from(document.querySelectorAll("h1")).find(h=>/Find what you need/.test(h.textContent))`);
const pageCostText = await evalJS(`document.body.textContent.includes("$") && /cost|COGS|margin/i.test(document.querySelector("#__next, body")?.textContent ?? "")`);
await sleep(1500);
const { data } = await send("Page.captureScreenshot", { format: "png" });
(await import("fs")).writeFileSync(SHOT, Buffer.from(data, "base64"));
console.log(`home: hero=${heroOk} cards=${cards}`);
// filters still work (Task 48)
await evalJS(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==="Electronics");if(b)b.click();})()`);
await sleep(600);
const elec = await evalJS(`Array.from(document.querySelectorAll('a[href^="/product/"]')).filter(a=>a.offsetParent!==null).length`);
console.log(`filters: Electronics visible=${elec} (expect 3)`);
console.log(cards === 12 && heroOk && elec === 3 ? "STOREFRONT-UNCHANGED: PASS" : "STOREFRONT-UNCHANGED: CHECK");
process.exit(cards === 12 && heroOk && elec === 3 ? 0 : 1);
