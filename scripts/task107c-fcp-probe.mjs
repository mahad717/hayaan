// Task 107c — FCP-vs-cover adjudication for the pre-cover window, plus a
// mid-cover screenshot. FCP is the objective "did the hero actually paint".
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "https://hayaan.co";
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1280, height: 720 });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072 });

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
await sleep(2500);
await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(900);
// dismiss popup if open
await page.evaluate(() => {
  const opens = Array.from(document.querySelectorAll('[data-state="open"]'));
  if (!opens.length) return;
  const btn = Array.from(opens[opens.length - 1].querySelectorAll("button")).find((b) => /no thanks/i.test(b.textContent || ""));
  if (btn) btn.click();
});
await sleep(800);

const card = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/product/"]'))
    .find((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
  const r = a.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(card.x, card.y);
await page.waitForFunction(
  `location.pathname.indexOf("/product/") === 0 && Array.from(document.querySelectorAll('a[href="/"]')).some(a => /Back to shop/i.test(a.textContent||""))`,
  { timeout: 90000, polling: 400 },
);
await sleep(1500);
const back = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
  a.scrollIntoView({ block: "center" });
  return true;
});
await sleep(500);
const backPos = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
  const r = a.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(backPos.x, backPos.y);

// sample fast; when cover first seen, grab a screenshot immediately
let covAt = null, restoredAt = null, shotTaken = false;
const t0 = Date.now();
for (let i = 0; i < 400 && Date.now() - t0 < 25000; i++) {
  const s = await page.evaluate(() => ({
    y: window.scrollY | 0,
    cov: document.documentElement.classList.contains("hayaan-cov"),
    t: Math.round(performance.now()),
    ready: document.readyState,
  })).catch(() => null);
  if (s) {
    if (s.cov && covAt === null) {
      covAt = s.t;
      if (!shotTaken) {
        await page.screenshot({ path: "/home/z/my-project/scripts/task107c-cover-moment.png" }).catch(() => {});
        shotTaken = true;
      }
    }
    if (!s.cov && s.y === 1500 && s.ready === "complete" && restoredAt === null) { restoredAt = s.t; break; }
  }
  await sleep(45);
}
await sleep(1500);
const fcp = await page.evaluate(() => {
  const e = performance.getEntriesByName("first-contentful-paint")[0];
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    fcp: e ? Math.round(e.startTime) : null,
    ttfb: nav ? Math.round(nav.responseStart) : null,
    docBytes: nav ? Math.round(nav.transferSize) : null,
    finalY: window.scrollY | 0,
  };
});
const verdict = {
  covAppliedAtPageTime: covAt,
  restoredAtPageTime: restoredAt,
  fcp,
  flashReal: fcp.fcp !== null && covAt !== null && fcp.fcp < covAt,
  note: "flashReal=true would mean contentful paint happened BEFORE the cover applied",
};
console.log(JSON.stringify(verdict, null, 1));
fs.writeFileSync("/home/z/my-project/scripts/task107c-fcp-verdict.json", JSON.stringify(verdict, null, 2));
await browser.close();
