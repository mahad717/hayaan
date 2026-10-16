// Task 107 — observe the home-page hydration collapse seen in the S4 probe:
// docH 18373 -> 720 after hydration. Capture console errors, page errors,
// failed requests, and DOM state every 500ms.
import puppeteer from "puppeteer-core";

const BASE = "https://hayaan.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9339", defaultViewport: null });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
});
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
page.on("console", (m) => {
  const t = m.type();
  if (t === "error" || t === "warning") console.log(`CONSOLE.${t}:`, m.text().slice(0, 220));
});
page.on("requestfailed", (r) => console.log("REQFAIL:", r.url().slice(0, 90), r.failure()?.errorText));
page.on("response", (r) => {
  if (r.status() >= 400) console.log("HTTP", r.status(), r.url().slice(0, 90));
});

console.log("--- load 1: clean / (baseline hydration behavior) ---");
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 20; i++) {
  const d = await page.evaluate(() => ({
    y: window.scrollY | 0,
    path: location.pathname,
    docH: document.documentElement.scrollHeight | 0,
    cards: document.querySelectorAll('a[href^="/product/"]').length,
    gridEl: !!document.querySelector("#catalog"),
    mainKids: document.querySelector("main") ? document.querySelector("main").children.length : -1,
  }));
  console.log(`t+${i * 500}ms`, JSON.stringify(d));
  await sleep(500);
}
await page.close().catch(() => {});
browser.disconnect();
console.log("DONE");
process.exit(0);
