// Task 107c — PRODUCTION verification of the early restore COVER (commit 410a080).
//   C1 real journey: home -> scroll 1500 -> card -> PDP -> "Back to shop"
//       EXPECT: during the new home doc parse <html> carries hayaan-cov
//       (cream+spinner mask, no hero flash), cover lifts in the same frame
//       as the restore => y==1500, no committed sample at y=0 uncovered.
//   C2 external referrer WITH a fresh valid save: cover must NEVER apply, y stays 0.
//   C3 clean direct load (no referrer): cover must NEVER apply, y stays 0.
// Throttle: CPU 4x, 300ms RTT, 1Mbps; images/fonts blocked (cards reserve boxes).
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "https://hayaan.co";
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars"],
});
console.log("browser:", await browser.version());

async function newScenario() {
  const ctx = await browser.createBrowserContext(); // isolated sessionStorage
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
  });
  await cdp.send("Network.setBlockedURLs", { urls: ["*://*.jpg", "*://*.jpeg", "*://*.png", "*://*.webp", "*://*.avif", "*://*.gif", "*://*.svg", "*://*.woff", "*://*.woff2"] });
  return { ctx, page, cdp };
}

// Sample y / cover / pathname as fast as the context allows; tolerate the
// context destruction during navigation.
async function sampleLoop(page, { maxMs = 20000, wantRestore = false, savedY = null } = {}) {
  const t0 = Date.now();
  const samples = [];
  let settled = null;
  while (Date.now() - t0 < maxMs) {
    try {
      const s = await page.evaluate(() => ({
        y: window.scrollY | 0,
        cov: document.documentElement.classList.contains("hayaan-cov"),
        path: location.pathname,
        prerendering: !!document.prerendering,
        ready: document.readyState,
        t: performance.now() | 0,
      }));
      samples.push(s);
      if (wantRestore && s.path === "/" && !s.cov && s.ready !== "uninitialized") {
        if (savedY == null || Math.abs(s.y - savedY) <= 2) { settled = { at: Date.now() - t0, ...s }; break; }
        if (s.ready === "complete" && samples.length > 8) { settled = { at: Date.now() - t0, ...s }; break; }
      }
      if (!wantRestore && s.ready === "complete" && samples.length > 12) break;
    } catch { /* context destroyed mid-navigation — expected */ }
    await sleep(80);
  }
  return { samples, settled };
}

function flashCheck(samples) {
  // hero flash = a sample on the home doc AFTER the early script could have
  // run (ready >= loading) showing y==0 with cover OFF before restore happens.
  return samples.filter((s) => s.path === "/" && s.ready !== "uninitialized" && s.cov === false && s.y === 0);
}

// ---------------- C1 ----------------
try {
  console.log("=== C1: real journey (cover -> restore) ===");
  const { ctx, page, cdp } = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(900);
  const saved = await page.evaluate(() => sessionStorage.getItem("hayaanShopY"));
  console.log("saved:", saved);
  const card = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/product/"]'))
      .find((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { href: a.getAttribute("href"), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!card) throw new Error("no fully-visible card");
  console.log("card:", JSON.stringify(card));
  await page.mouse.click(card.x, card.y);
  await page.waitForFunction(
    `location.pathname.indexOf("/product/") === 0 && Array.from(document.querySelectorAll('a[href="/"]')).some(a => /Back to shop/i.test(a.textContent||""))`,
    { timeout: 90000, polling: 400 },
  );
  await sleep(1500);
  console.log("on PDP:", page.url());
  const preNav = await page.evaluate(() => sessionStorage.getItem("hayaanShopY"));
  console.log("preNav sessionStorage:", preNav);

  const back = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!back) throw new Error("no back anchor");
  const clickT = Date.now();
  await page.mouse.click(back.x, back.y);

  const savedY = 1500;
  const { samples, settled } = await sampleLoop(page, { maxMs: 25000, wantRestore: true, savedY });
  const covSeen = samples.filter((s) => s.cov);
  const flashes = flashCheck(samples);
  const postSamples = samples.filter((s) => s.path === "/" && !s.cov && s.ready === "complete");
  const finalY = postSamples.length ? postSamples[postSamples.length - 1].y : null;
  results.C1 = {
    pass: !!(settled && settled.y === savedY && flashes.length === 0),
    coverSeen: covSeen.length > 0,
    firstCoverAt: covSeen.length ? `${covSeen[0].t}ms(page-time)` : null,
    settled, finalY, flashCount: flashes.length, flashes: flashes.slice(0, 3),
    sampleCount: samples.length,
    timeline: samples.filter((s, i) => i % 3 === 0 || s.cov || s.path === "/").slice(0, 24)
      .map((s) => `${s.t}ms y=${s.y} cov=${s.cov ? 1 : 0} ${s.path.slice(0, 18)}`),
    elapsedToSettle: settled?.at ?? null, wallMs: Date.now() - clickT,
  };
  console.log(JSON.stringify(results.C1, null, 1));
  await ctx.close();
} catch (e) { results.C1 = { pass: false, error: String(e) }; console.log("C1 ERR:", e); }

// ---------------- C2 ----------------
try {
  console.log("=== C2: external referrer + fresh save => no cover ===");
  const { ctx, page } = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(900);
  console.log("seeded:", await page.evaluate(() => sessionStorage.getItem("hayaanShopY")));
  await page.setExtraHTTPHeaders({ Referer: "https://www.google.com/" });
  const { samples } = await sampleLoop(page, { maxMs: 22000 });
  const covSamples = samples.filter((s) => s.cov);
  results.C2 = {
    pass: covSamples.length === 0 && samples.every((s) => s.y === 0),
    coverSeen: covSamples.length > 0,
    maxY: Math.max(...samples.map((s) => s.y)), sampleCount: samples.length,
  };
  console.log(JSON.stringify(results.C2));
  await ctx.close();
} catch (e) { results.C2 = { pass: false, error: String(e) }; console.log("C2 ERR:", e); }

// ---------------- C3 ----------------
try {
  console.log("=== C3: clean direct load => no cover ===");
  const { ctx, page } = await newScenario();
  const { samples } = await sampleLoop(page, { maxMs: 22000 });
  const covSamples = samples.filter((s) => s.cov);
  results.C3 = {
    pass: covSamples.length === 0 && samples.every((s) => s.y === 0),
    coverSeen: covSamples.length > 0,
    maxY: Math.max(...samples.map((s) => s.y)), sampleCount: samples.length,
  };
  console.log(JSON.stringify(results.C3));
  await ctx.close();
} catch (e) { results.C3 = { pass: false, error: String(e) }; console.log("C3 ERR:", e); }

await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task107c-prod-results.json", JSON.stringify(results, null, 2));
console.log("WROTE scripts/task107c-prod-results.json");
