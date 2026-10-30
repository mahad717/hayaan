// One-off probe: open the cart drawer as a guest and dump every button's
// aria-label inside the dialog, to see why the qty +/- clicks miss.
import { existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";

const BASE = "http://127.0.0.1:3160";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse()
    .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
].find((p) => existsSync(p));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9393", "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage", `--user-data-dir=/tmp/chrome-probe-${Date.now()}`, "--window-size=412,915", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch("http://127.0.0.1:9393/json/version")).json(); break; } catch {} }

const conn = (url) => new Promise((res, rej) => { const ws = new WebSocket(url); ws.onopen = () => res(ws); ws.onerror = rej; });
let id = 0;
const cmd = (ws, m, p = {}, sid = null) => new Promise((res, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
const evA = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Log.enable").catch(() => {});
const logs = [];
ws.addEventListener("message", (e) => {
  try { const m = JSON.parse(e.data); if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + JSON.stringify(m.params.exceptionDetails).slice(0, 300)); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR: " + JSON.stringify(m.params.args).slice(0, 300)); } catch {}
});
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

await send("Page.navigate", { url: `${BASE}/` });
for (let i = 0; i < 40; i++) { await sleep(400); if (await ev(`document.querySelectorAll("a[href^='/product/']").length > 0`)) break; }
const slug = await ev(`document.querySelector("a[href^='/product/']").getAttribute("href")`);
console.log("PDP:", slug);
await send("Page.navigate", { url: `${BASE}${slug}` });
for (let i = 0; i < 40; i++) { await sleep(400); if (await ev(`document.querySelectorAll("button").length > 10`)) break; }
await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^add to cart$/i.test((x.textContent || "").trim())); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } return !!b; })()`);
await sleep(1500);
// instrument storage writes + fetch before the qty probe
await ev(`window.__writes = []; window.__fetches = []; const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { window.__writes.push({ k, v: String(v).slice(0, 60) }); return _set.call(this, k, v); }; const _of = window.fetch; window.fetch = function (...a) { window.__fetches.push(String(a[0]).slice(0, 80)); return _of.apply(this, a); };`);
await ev(`window.__toasts = []; window.__rejections = []; window.addEventListener("unhandledrejection", (e) => window.__rejections.push(String(e.reason && e.reason.stack || e.reason).slice(0, 300))); const mo = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.getAttribute?.("data-sonner-toast") || n.querySelector?.("[data-sonner-toast]"))) window.__toasts.push((n.textContent || "").slice(0, 80)); }); mo.observe(document.body, { childList: true, subtree: true });`);
const dump = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { dialog: false };
  return {
    dialog: true,
    state: dlg.getAttribute("data-state"),
    buttons: [...dlg.querySelectorAll("button")].map((b) => ({ label: b.getAttribute("aria-label"), text: (b.textContent || "").trim().slice(0, 24), disabled: b.disabled })),
    storage: localStorage.getItem("hayaan_guest_cart"),
  };
})()`);
console.log(JSON.stringify(dump, null, 1));
// try the click the harness does
const r = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").includes("Increase quantity")); if (b) { b.click(); return "clicked"; } return "NOT FOUND"; })()`);
console.log("increase:", r);
await sleep(600);
console.log("storage after b.click():", await ev(`localStorage.getItem("hayaan_guest_cart")?.slice(0, 60)`));
// now a REAL CDP coordinate click on the same button
const pt = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").includes("Increase quantity")); if (!b) return null; const rc = b.getBoundingClientRect(); return { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2 }; })()`);
console.log("coords:", JSON.stringify(pt));
if (pt) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y });
  for (const t of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
}
await sleep(600);
console.log("storage after real click:", await ev(`localStorage.getItem("hayaan_guest_cart")?.slice(0, 60)`));
// React fiber inspection: is onClick attached to the Increase button?
const fiberInfo = await ev(`(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").includes("Increase quantity"));
  if (!b) return "no button";
  const key = Object.keys(b).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  const propsKey = Object.keys(b).find((k) => k.startsWith("__reactProps$"));
  const props = propsKey ? b[propsKey] : null;
  return {
    fiberKey: !!key,
    propsKey: !!propsKey,
    onClickType: props ? typeof props.onClick : "no-props",
    disabled: props ? props.disabled : null,
    ariaLabel: props ? props["aria-label"] : null,
  };
})()`);
console.log("fiber:", JSON.stringify(fiberInfo));
console.log("writes:", JSON.stringify(await ev(`window.__writes`)));
console.log("fetches:", JSON.stringify(await ev(`window.__fetches`)));
console.log("toasts:", JSON.stringify(await ev(`window.__toasts`)));
console.log("rejections:", JSON.stringify(await ev(`window.__rejections`)));
console.log("console/errors:", JSON.stringify(logs, null, 1));
// control: Remove button in the same drawer
const rm = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").includes("Remove")); if (b) { b.click(); return "clicked"; } return "NOT FOUND"; })()`);
await sleep(600);
console.log("remove:", rm, "storage after:", await ev(`localStorage.getItem("hayaan_guest_cart")`));
// re-add an item, then call the Increase button's onClick DIRECTLY via props
await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^add to cart$/i.test((x.textContent || "").trim())); if (b) b.click(); return !!b; })()`);
await sleep(1000);
const direct = await ev(`(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").includes("Increase quantity"));
  if (!b) return "no button";
  const propsKey = Object.keys(b).find((k) => k.startsWith("__reactProps$"));
  if (!propsKey) return "no props";
  try { b[propsKey].onClick(); return "onClick invoked ok"; } catch (e) { return "THREW: " + String(e && e.message).slice(0, 200); }
})()`);
await sleep(600);
console.log("direct onClick:", direct);
console.log("storage after direct:", await ev(`localStorage.getItem("hayaan_guest_cart")?.slice(0, 80)`));
console.log("writes now:", JSON.stringify(await ev(`window.__writes`)));
chrome.kill();
process.exit(0);
