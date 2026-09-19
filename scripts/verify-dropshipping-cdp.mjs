// Task 65 visual check: import dialog + Fulfillment tab (local, admin cookie).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const DEBUG_PORT = 9355;
const COOKIE = { name: "shop_session", value: "" };

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t65-${Date.now()}`,
  "--window-size=1440,1400", "about:blank",
], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { chrome.kill(); process.exit(1); }
function conn(url, t = 15000) { return new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => rej(new Error("ws err")); }); }
let id = 0;
function cmd(ws, m, p = {}, sid = null, to = 45000) { return new Promise((res, rej) => { const i = ++id; const pay = { id: i, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); }); }
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
await send("Page.enable"); await send("Runtime.enable");
const errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text ?? "exception"); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result?.value; };
const shot = async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); };
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });

// fresh admin login via API to get a current session cookie
const login = await (await fetch("http://localhost:3000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }) }));
COOKIE.value = (login.headers.get("set-cookie") ?? "").split(";")[0].split("=")[1];
await send("Network.enable");
await send("Network.setCookie", { name: COOKIE.name, value: COOKIE.value, url: "http://localhost:3000", httpOnly: true });

await send("Page.navigate", { url: "http://localhost:3000/admin" });
await sleep(6000);
// 1) import dialog
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("Import from URL"))?.click()`);
await sleep(1200);
await ev(`(() => { const set = (el, val) => { const p = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; p.call(el, val); el.dispatchEvent(new Event("input", { bubbles: true })); }; const el = document.querySelector("#import-url"); if (el) set(el, "https://www.aliexpress.com/item/1005006123456789.html"); })()`);
await sleep(400);
await shot("/home/z/my-project/download/task65-import-dialog.png");
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Cancel")?.click()`);
await sleep(600);
// 2) fulfillment tab
await ev(`[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Fulfillment")?.click()`);
await sleep(2500);
console.log("fulfillment text check:", await ev(`document.body.innerText.includes("To order from supplier") && document.body.innerText.includes("Open listing")`));
await shot("/home/z/my-project/download/task65-fulfillment-tab.png");
console.log("console exceptions:", errors.length, errors.slice(0, 3));
chrome.kill();
console.log("DONE");
