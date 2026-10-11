// Task 87 — live screenshots (read-only):
//  1. Mogadishu guide (cover + quick answer)
//  2. AC guide (price list section)
//  3. Product page "Before you order" buying-guides section
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/download";
const exists = (p) => existsSync(p);
const CHROME = ["/home/z/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome", "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome"].find(exists);
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }

const PORT = 9381;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage", "--disable-gpu", `--user-data-dir=/tmp/chrome-t87-${Date.now()}`, "--window-size=1440,2400", "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const wsBase = `http://127.0.0.1:${PORT}`;
let id = 0;
const targets = await (await fetch(`${wsBase}/json`)).json();
const page = targets.find((t) => t.type === "page");
const WebSocket = (await import("ws")).default;
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
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
const dismissPopups = async () => {
  await evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => /no thanks|close|skip/i.test(x.textContent || ''));
    if (b) { b.click(); return 'dismissed'; }
    return 'none';
  })()`);
  await new Promise((r) => setTimeout(r, 800));
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
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`screenshot failed: ${path}`);
};

// 1. Mogadishu guide — top (cover + quick answer + first section)
await send("Page.navigate", { url: `${BASE}/blog/online-shopping-in-mogadishu` });
await new Promise((r) => setTimeout(r, 5500));
await dismissPopups();
await evalJs(`window.scrollTo(0, 0)`);
await new Promise((r) => setTimeout(r, 1200));
await shot(`${OUT}/task87-mogadishu-guide-top.png`);
console.log("shot 1: mogadishu top");

// 2. AC guide — scrolled to the price list
await send("Page.navigate", { url: `${BASE}/blog/air-conditioner-price-in-somalia` });
await new Promise((r) => setTimeout(r, 5500));
await dismissPopups();
await evalJs(`(() => { const h = [...document.querySelectorAll('h2')].find((x) => /prices in somalia right now/i.test(x.textContent || '')); h?.scrollIntoView({ block: 'start' }); return h ? 'found' : 'no-h2'; })()`);
await new Promise((r) => setTimeout(r, 1200));
await shot(`${OUT}/task87-ac-guide-prices.png`);
console.log("shot 2: ac prices");

// 3. Product page — "Before you order" guides section
await send("Page.navigate", { url: `${BASE}/product/tv-lg-55-inch-smart` });
await new Promise((r) => setTimeout(r, 5500));
await dismissPopups();
await evalJs(`document.querySelector('#pdp-guides-heading')?.scrollIntoView({ block: 'start' }) ?? 'no-guides'`);
await new Promise((r) => setTimeout(r, 1500));
const guideCards = await evalJs(`document.querySelectorAll('#pdp-guides-heading ~ div a').length`);
console.log("guide cards on page:", guideCards);
await shot(`${OUT}/task87-product-page-guides.png`);
console.log("shot 3: product guides");

await send("Browser.close").catch(() => {});
chrome.kill();
console.log("done");
