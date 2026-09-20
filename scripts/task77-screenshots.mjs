// Task 77 — live screenshots of the AEO surfaces (read-only):
//  1. category page FAQ section  2. blog guide quick-answer block
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/download";
const exists = (p) => existsSync(p);
const CHROME = ["/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome", "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome"].find(exists);
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }

const PORT = 9377;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage", "--disable-gpu", `--user-data-dir=/tmp/chrome-t77-${Date.now()}`, "--window-size=1440,2600", "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const wsBase = `http://127.0.0.1:${PORT}`;
let id = 0;
let ws;
const targets = await (await fetch(`${wsBase}/json`)).json();
const page = targets.find((t) => t.type === "page");
const WebSocket = (await import("ws")).default;
ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on("open", r));
const pending = new Map();
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id;
  pending.set(msgId, resolve);
  ws.send(JSON.stringify({ id: msgId, method, params }));
});
await send("Page.enable");
await send("Runtime.enable");
const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const shot = async (path, fullPage = false) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const params = { format: "png" };
    if (fullPage) params.captureBeyondViewport = true;
    const r = await send("Page.captureScreenshot", params);
    if (r?.result?.data) {
      writeFileSync(path, Buffer.from(r.result.data, "base64"));
      return;
    }
    console.log(`  shot retry ${attempt + 1}:`, JSON.stringify(r).slice(0, 160));
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`screenshot failed: ${path}`);
};

// 1. Category page — scroll to the FAQ section
await send("Page.navigate", { url: `${BASE}/category/computers-tv-gaming` });
await new Promise((r) => setTimeout(r, 5000));
await evalJs(`document.querySelector('#faq-heading')?.scrollIntoView({ block: 'start' }) ?? 'no-faq'`);
await new Promise((r) => setTimeout(r, 1200));
const faqCount = await evalJs(`document.querySelectorAll('#faq-heading ~ div details').length`);
console.log("category FAQ items visible:", faqCount);
await shot(`${OUT}/task77-live-category-faq.png`);

// 2. Blog post — quick answer block
await send("Page.navigate", { url: `${BASE}/blog/online-shopping-in-somalia-how-it-works` });
await new Promise((r) => setTimeout(r, 5000));
await evalJs(`document.querySelectorAll('h2') && [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Quick answer')?.scrollIntoView({ block: 'center' })`);
await new Promise((r) => setTimeout(r, 1200));
await shot(`${OUT}/task77-live-blog-quick-answer.png`);

// 3. Footer site-wide FAQ (homepage bottom)
await send("Page.navigate", { url: `${BASE}/` });
await new Promise((r) => setTimeout(r, 5000));
await evalJs(`document.querySelector('#footer-faq')?.scrollIntoView({ block: 'start' }) ?? 'no-footer-faq'`);
await new Promise((r) => setTimeout(r, 1500));
await evalJs(`(() => { const d = document.querySelector('#footer-faq ~ div details'); if (d) d.open = true; return document.querySelectorAll('#footer-faq ~ div details').length; })()`);
await new Promise((r) => setTimeout(r, 600));
await shot(`${OUT}/task77-live-footer-faq.png`);

const consoleErrors = await evalJs(`window.__errs || 0`);
console.log("done, screenshots saved");
chrome.kill();
process.exit(0);
