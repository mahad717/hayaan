// Task 107c — verify the early restore COVER on a local standalone build.
//   C1 real journey: home -> scroll 1500 -> card -> PDP -> "Back to shop"
//       EXPECT: during the new home doc parse the <html> carries hayaan-cov
//       (cream+spinner mask, NO hero flash), then cover lifts and y==1500.
//   C2 external referrer: cover must NEVER apply, y stays 0.
//   C3 fresh direct load: cover must NEVER apply, y stays 0.
// Throttle: CPU 4x, 300ms RTT, 1Mbps (1MB home HTML => parse takes seconds,
// giving a wide observable window for the cover).
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3100";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

const browser = await puppeteer.connect({
  browserURL: "http://127.0.0.1:9339", defaultViewport: null, protocolTimeout: 120000,
});

async function newScenario() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
  });
  return page;
}

// ---- C1: real journey with cover observation ----
if (true) try {
  console.log("=== C1: real journey (cover -> restore) ===");
  const page = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000 });
  await sleep(2000);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(700);
  const saved = await page.evaluate(() => ({
    y: window.scrollY | 0,
    seed: sessionStorage.getItem("hayaanShopY") || null,
  }));
  console.log("saved:", JSON.stringify(saved));
  const card = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/product/"]'))
      .find(x => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { href: a.getAttribute("href"), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!card) throw new Error("no fully-visible card");
  console.log("card:", JSON.stringify(card));
  await page.mouse.click(card.x, card.y);
  await page.waitForFunction(
    `location.pathname.indexOf("/product/") === 0 && !!Array.from(document.querySelectorAll('a[href="/"]')).find(a => /Back to shop/i.test(a.textContent||""))`,
    { timeout: 60000, polling: 400 },
  );
  await sleep(1200);
  console.log("on PDP:", page.url());

  const backPos = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]'))
      .find(x => /Back to shop/i.test(x.textContent || ""));
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  const t0 = Date.now();
  let sawCoverAt = null, restoredAt = null, uncoveredAt = null, topFlash = null;
  await page.mouse.click(backPos.x, backPos.y);
  // Poll the NEW document through the whole parse window.
  while (Date.now() - t0 < 20000) {
    let s = null;
    try {
      s = await page.evaluate(() => ({
        cov: document.documentElement.classList.contains("hayaan-cov"),
        y: window.scrollY | 0,
        ready: !!document.querySelector("#catalog"),
        path: location.pathname,
      }));
    } catch { await sleep(80); continue; } // execution context swap mid-nav
    const t = Date.now() - t0;
    if (s.path === "/") {
      if (s.cov && sawCoverAt === null) sawCoverAt = t;
      if (!s.cov && sawCoverAt !== null && uncoveredAt === null) uncoveredAt = t;
      if (s.y >= 1400 && restoredAt === null) restoredAt = t;
      if (!s.cov && sawCoverAt === null && restoredAt === null && s.y === 0 && s.ready && topFlash === null && t > 500) topFlash = t;
      if (restoredAt !== null && uncoveredAt !== null) break;
    }
    await sleep(90);
  }
  const final = await page.evaluate(() => ({
    y: window.scrollY | 0,
    cov: document.documentElement.classList.contains("hayaan-cov"),
    docH: document.documentElement.scrollHeight | 0,
  }));
  results.c1 = {
    sawCoverAt, restoredAt, uncoveredAt, topFlash, ...final,
    pass: sawCoverAt !== null && final.y >= 1400 && final.cov === false && topFlash === null,
  };
  console.log("C1:", JSON.stringify(results.c1), results.c1.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.c1 = { error: String(e).slice(0, 200) }; console.log("C1 ERROR:", String(e).slice(0, 200)); }

// ---- C2: external referrer — cover must never apply ----
if (true) try {
  console.log("\n=== C2: external referrer (no cover, no restore) ===");
  const page = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000 });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await sleep(600);
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000, referer: "https://example.com/somewhere" });
  let everCovered = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const c = await page.evaluate(() => document.documentElement.classList.contains("hayaan-cov")).catch(() => false);
    if (c) { everCovered = true; break; }
    await sleep(120);
  }
  await sleep(2500);
  const d = await page.evaluate(() => ({ y: window.scrollY | 0, cov: document.documentElement.classList.contains("hayaan-cov") }));
  results.c2 = { ...d, everCovered, pass: !everCovered && d.y === 0 && !d.cov };
  console.log("C2:", JSON.stringify(results.c2), results.c2.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.c2 = { error: String(e).slice(0, 200) }; console.log("C2 ERROR:", String(e).slice(0, 200)); }

// ---- C3: fresh direct load — cover must never apply ----
if (true) try {
  console.log("\n=== C3: fresh direct load (no referrer) ===");
  const page = await newScenario();
  let everCovered = false;
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    const c = await page.evaluate(() => document.documentElement.classList.contains("hayaan-cov")).catch(() => false);
    if (c) { everCovered = true; break; }
    await sleep(100);
  }
  await page.waitForFunction(`!!document.querySelector("#catalog")`, { timeout: 60000, polling: 300 });
  const d = await page.evaluate(() => ({ y: window.scrollY | 0, cov: document.documentElement.classList.contains("hayaan-cov") }));
  results.c3 = { ...d, everCovered, pass: !everCovered && d.y === 0 && !d.cov };
  console.log("C3:", JSON.stringify(results.c3), results.c3.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.c3 = { error: String(e).slice(0, 200) }; console.log("C3 ERROR:", String(e).slice(0, 200)); }

fs.writeFileSync("/home/z/my-project/scripts/task107c-results.json", JSON.stringify(results, null, 2));
browser.disconnect();
console.log("\nSUMMARY:", JSON.stringify(results));
process.exit(0);
