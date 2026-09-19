// Task 70 live verification: the owner's multivitamin product has mangled
// stored HTML (<p>…<br><ul>…</ul></p>). After deploy, the PDP render path
// sanitizes + hoists, so the served page must show a clean top-level list.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
const SLUG = "multivitamines-pour-hommes--boost-immunitaire-aux-vitamines-a-b12-c-d--nergie-quotidienne-et-non-ogm";
const results = [];
const check = (n, c, x = "") => { const l = `${c ? "PASS" : "FAIL"} — ${n}${x ? ` (${x})` : ""}`; results.push(l); console.error(l); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`https://hayaan.co/api/products`, { headers: { "User-Agent": "Mozilla/5.0" } });
const data = await res.json();
const p = (data.products ?? []).find((x) => /multivitamin/i.test(x.name));
check("live API reachable + product found", !!p);
check("stored description still carries the legacy mangle (until owner re-saves)", !!p && /<br><ul>/.test(p.description));

const html = await (await fetch(`https://hayaan.co/product/${SLUG}`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
check("live PDP 200", html.length > 5000, `${html.length} bytes`);
check("PDP SSR renders bullet list", html.includes("<ul>") && (html.match(/<li>/g) ?? []).length >= 4, `li=${(html.match(/<li>/g) ?? []).length}`);
check("PDP SSR no <p>-wrapped <ul> (hoisted)", !/<p>(?:(?!<\/p>)[\s\S])*<ul>/.test(html));

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9351", "--no-sandbox", "--no-first-run", "--disable-dev-shm-usage", "--disable-gpu", `--user-data-dir=/tmp/chrome-t70live-${Date.now()}`, "--window-size=1280,2400", "about:blank"], { stdio: "ignore" });
let vi = null;
for (let i = 0; i < 40 && !vi; i++) { await sleep(500); try { vi = await (await fetch("http://127.0.0.1:9351/json/version")).json(); } catch {} }
const ws = new WebSocket(vi.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const s = (m, p) => sendCmd(m, p, sessionId);
function sendCmd(method, params = {}, sid) { return new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); }); }
const evalJS = async (expr) => (await s("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable");
await s("Emulation.setDeviceMetricsOverride", { width: 1280, height: 2400, deviceScaleFactor: 1, mobile: false });
await s("Page.navigate", { url: `https://hayaan.co/product/${SLUG}` });
for (let i = 0; i < 30; i++) { await sleep(1000); if (await evalJS(`!!document.querySelector(".rich-description ul li")`).catch(() => false)) break; }
check("PDP shows list items", await evalJS(`document.querySelectorAll(".rich-description ul li").length >= 4`));
check("PDP bullet markers visible", await evalJS(`(() => { const ul = document.querySelector(".rich-description ul"); return ul ? getComputedStyle(ul).listStyleType === "disc" : false; })()`));
const shot = await s("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/task70-live-pdp-bullets.png", Buffer.from(shot.data, "base64"));
chrome.kill();
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.error(`\n${results.length - fails}/${results.length} live checks passed`);
process.exit(fails ? 1 : 0);
