// Task 68 CDP verification: "Health Supplements" category (vitamins).
// Browser checks against the dev server (Prisma mode, admin@shop.demo):
//  1. Storefront pills include "Health Supplements"; clicking shows the
//     expected empty state (no product assigned yet).
//  2. Somali mode (hayaan_lang=so) pill reads "Caafimaad & Vitamiinada".
//  3. Admin product form dropdown lists "Health Supplements".
// All logging via console.error (bun buffers console.log).
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
const DEBUG_PORT = 9345;
mkdirSync("/home/z/my-project/download", { recursive: true });

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const sessionValue = /shop_session=([^;]+)/.exec(setCookie)?.[1];
if (!sessionValue) { console.error("FATAL: login failed"); process.exit(1); }

const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.error(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expr, timeoutMs = 25000, everyMs = 600) => {
  for (const until = Date.now() + timeoutMs; Date.now() < until;) {
    try { if (await evalJS(expr)) return true; } catch {}
    await sleep(everyMs);
  }
  return false;
};

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t68-${Date.now()}`,
  "--window-size=1440,1600", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools never came up"); chrome.kill(); process.exit(1); }

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
});
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
await send("Network.enable");
await send("Network.setCookie", { name: "shop_session", value: sessionValue, url: BASE, httpOnly: true });
const saveShot = async (path) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
};
const pillBtn = (label) =>
  `[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "${label}")`;

// --- 1. English storefront ---------------------------------------------------
await send("Page.navigate", { url: `${BASE}/` });
check("Health Supplements pill renders on storefront", await waitFor(`!!${pillBtn("Health Supplements")}`));
check("existing pills still render", await evalJS(`!!${pillBtn("All")} && !!${pillBtn("Electronics")}`));
await saveShot("/home/z/my-project/download/task68-storefront-pill.png");

// click the new pill -> expected empty state
await evalJS(`${pillBtn("Health Supplements")}.click()`);
check("empty state appears for new category", await waitFor(`!!document.querySelector(".border-dashed") && document.body.innerText.includes("No products found")`));
await saveShot("/home/z/my-project/download/task68-empty-state.png");

// --- 2. Somali pill label ----------------------------------------------------
await send("Network.setCookie", { name: "hayaan_lang", value: "so", url: BASE });
await send("Page.navigate", { url: `${BASE}/` });
check("Somali pill label 'Caafimaad & Vitamiinada' renders", await waitFor(`!!${pillBtn("Caafimaad & Vitamiinada")}`));
check("other Somali pills intact", await evalJS(`!!${pillBtn("Dhar")} && !!${pillBtn("Guriga & Nolosha")}`));
await saveShot("/home/z/my-project/download/task68-somali-pill.png");

// --- 3. Admin product form dropdown ------------------------------------------
await send("Network.setCookie", { name: "hayaan_lang", value: "en", url: BASE });
await send("Page.navigate", { url: `${BASE}/admin` });
check("admin panel renders", await waitFor(`!!${pillBtn("New product")}`));
await evalJS(`${pillBtn("New product")}.click()`);
check("product form opens", await waitFor(`!!document.querySelector('[role="dialog"]')`));
// open the category select (first combobox in the dialog)
const comboExpr = `[...document.querySelectorAll('[role="dialog"] [role="combobox"]')][0]`;
await evalJS(`${comboExpr}.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
await evalJS(`${comboExpr}.click()`);
await sleep(700);
const catOptions = await evalJS(`[...document.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`);
check("dropdown lists Health Supplements", Array.isArray(catOptions) && catOptions.includes("Health Supplements"), (catOptions ?? []).join(" | "));
await saveShot("/home/z/my-project/download/task68-admin-category-dropdown.png");

check("0 console exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.error(`\n${results.length - fails}/${results.length} checks passed`);
chrome.kill();
process.exit(fails ? 1 : 0);
