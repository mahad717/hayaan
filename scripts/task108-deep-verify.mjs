// Task 108 — DEEP restore on production: save an offset that EXCEEDS the
// 36-card initial document, then PDP -> Back to shop. The cover must hold
// (no top flash) while the client fetch extends the grid, then reveal AT the
// deep offset.
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
// dismiss newsletter popup if open
await page.evaluate(() => {
  const opens = Array.from(document.querySelectorAll('[data-state="open"]'));
  if (!opens.length) return;
  const btn = Array.from(opens[opens.length - 1].querySelectorAll("button")).find((b) => /no thanks/i.test(b.textContent || ""));
  if (btn) btn.click();
});
await sleep(800);

// scroll DEEP — past the initial 36-card document (which ends around 11-12k),
// into territory that only exists after the client fetch appends the rest.
const deep = await page.evaluate(() => {
  const max = (document.documentElement.scrollHeight | 0) - innerHeight;
  window.scrollTo(0, max - 1500); // deep in the grid, still past the 36-card initial doc
  return max;
});
await sleep(1000);
const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("hayaanShopY") || "null"));
const initialDocH = await page.evaluate(() => document.documentElement.scrollHeight | 0);
console.log("initialDocH:", initialDocH, "saved:", JSON.stringify(saved));

// PDP via a real card at the deep position
const card = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/product/"]'))
    .find((x) => { const r = x.getBoundingClientRect(); return r.width >= 150 && r.top >= 0 && r.bottom <= innerHeight; });
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
if (!card) throw new Error("no card at deep position");
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
const bp = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
  const r = a.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(bp.x, bp.y);

// sample the return: cover state, y trajectory
const t0 = Date.now();
const samples = [];
let covSeen = false, topFlash = null, finalY = null;
while (Date.now() - t0 < 25000) {
  const s = await page.evaluate(() => ({
    y: window.scrollY | 0,
    cov: document.documentElement.classList.contains("hayaan-cov"),
    docH: document.documentElement.scrollHeight | 0,
    ready: document.readyState,
    t: Math.round(performance.now()),
  })).catch(() => null);
  if (s && s.path === undefined || s) {
    if (s) {
      samples.push(s);
      if (s.cov) covSeen = true;
      if (s.ready === "complete" && !s.cov && s.y === 0 && topFlash === null) topFlash = s.t;
      if (s.ready === "complete" && !s.cov && s.y > 1000) { finalY = s.y; break; }
    }
  }
  await sleep(70);
}
await sleep(2000);
const fin = await page.evaluate(() => ({ y: window.scrollY | 0, docH: document.documentElement.scrollHeight | 0 })).catch(() => null);
const verdict = {
  savedY: saved?.y ?? null, covSeen, topFlashAt: topFlash, finalY, fin,
  pass: covSeen && topFlash === null && finalY !== null && Math.abs((finalY) - (saved?.y ?? 0)) <= 400,
  timeline: samples.filter((_, i) => i % 5 === 0).slice(0, 30)
    .map((s) => `${s.t}ms y=${s.y} cov=${s.cov ? 1 : 0} docH=${s.docH} ${s.ready.slice(0, 4)}`),
};
console.log(JSON.stringify(verdict, null, 1));
fs.writeFileSync("/home/z/my-project/scripts/task108-deep-results.json", JSON.stringify(verdict, null, 2));
await browser.close();
