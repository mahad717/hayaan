// Task 66 CDP visual verification (local dev): the import dialog now shows
// a PERSISTENT inline error when the supplier blocks the fetch, plus a
// one-click "Add the product manually with this URL" fallback that opens the
// Create form with the supplier URL prefilled.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary"); process.exit(1); }

const BASE = "http://localhost:3000";
const DEBUG_PORT = 9341;
const ALIBABA_URL = "https://www.alibaba.com/product-detail/100000mAh-Large-Capacity-PD-22-5W-Portable-Battery-Power-Station-With-Cable-1600111931204.html";
const SHOT_ERR = "/home/z/my-project/download/task66-import-inline-error.png";
const SHOT_FALLBACK = "/home/z/my-project/download/task66-manual-fallback.png";
mkdirSync("/home/z/my-project/download", { recursive: true });

// Fresh admin session for the injected cookie.
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const sessionValue = /shop_session=([^;]+)/.exec(setCookie)?.[1];
if (!sessionValue) { console.error("FATAL: login did not yield shop_session"); process.exit(1); }
console.error("[stage] logged in via API");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t66-${Date.now()}`,
  "--window-size=1440,1400", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools endpoint never came up"); chrome.kill(); process.exit(1); }

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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 60000);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => sendCmd(ws, m, p, sessionId);

const consoleErrors = [];
await send("Page.enable");
await send("Runtime.enable");
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params?.exceptionDetails?.text ?? "exception");
  if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
    consoleErrors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  }
});
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
await send("Network.enable");
await send("Network.setCookie", { name: "shop_session", value: sessionValue, url: BASE, httpOnly: true });

// --- open admin + import dialog -------------------------------------------
await send("Page.navigate", { url: `${BASE}/admin` });
await sleep(6000);
console.error("[stage] admin loaded, admin text:", await evalJS(`document.body.innerText.includes("Admin dashboard")`));

const openImport = await evalJS(`(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Import from URL"));
  if (btn) { btn.click(); return true; } return false;
})()`);
console.error("[stage] import dialog opened:", openImport);
await sleep(800);

// paste the Alibaba URL and click Fetch details
await evalJS(`(() => {
  const input = document.querySelector("#import-url");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, ${JSON.stringify(ALIBABA_URL)});
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input.value.length;
})()`);
console.error("[stage] url pasted");
await evalJS(`(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Fetch details"));
  btn.click(); return true;
})()`);
console.error("[stage] Fetch details clicked — waiting for inline error…");

// wait for the persistent inline error panel (up to 25s)
let errText = "";
try {
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    errText = await evalJS(`document.querySelector('[role="alert"]')?.innerText ?? ""`).catch((e) => { console.error(`[wait ${i}] eval failed:`, String(e).slice(0, 120)); return ""; });
    console.error(`[wait ${i}] errText len:`, errText.length);
    if (errText) break;
  }
} catch (e) {
  console.error("[stage] wait loop crashed:", String(e).slice(0, 300));
}
const errOk = /anti-bot challenge/.test(errText) && /Add the product manually/.test(errText);
console.error("inline error shown:", !!errText, "| actionable:", errOk);
console.error("error text:", errText.replace(/\n/g, " | ").slice(0, 160));

const shot1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(SHOT_ERR, Buffer.from(shot1.data, "base64"));

// click the manual fallback
const clicked = await evalJS(`(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Add the product manually with this URL"));
  if (btn) { btn.click(); return true; } return false;
})()`);
await sleep(1200);
const fallback = await evalJS(`(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find(d => d.innerText.includes("New product") || d.querySelector("#p-supplier-url"));
  const supplier = document.querySelector("#p-supplier-url");
  return {
    dialogOpen: !!dlg,
    supplierPrefilled: supplier ? supplier.value : "NO_FIELD",
    nameEmpty: (document.querySelector("#p-name")?.value ?? "") === "" || ![...document.querySelectorAll("input")].some(i => i.id?.startsWith("p-") && i.id !== "p-supplier-url" && i.id !== "p-supplier-sku" && i.value),
  };
})()`);
console.error("fallback clicked:", clicked, "| product dialog open:", fallback.dialogOpen, "| supplier URL prefilled:", fallback.supplierPrefilled.slice(0, 70));

const shot2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(SHOT_FALLBACK, Buffer.from(shot2.data, "base64"));

console.error("console errors:", consoleErrors.length, consoleErrors.slice(0, 3));
console.error("RESULTS:", JSON.stringify({ errOk, fallback }, null, 1));
chrome.kill();
process.exit(errOk && fallback.dialogOpen && fallback.supplierPrefilled === ALIBABA_URL ? 0 : 1);
