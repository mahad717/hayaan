// Task 107 — FINAL verification on production (hardened build live), v2:
//   V1 real journey : / -> scroll 1500 -> visible PDP card -> "Back to shop" -> y≈1500
//   V2 seeded gate  : consistent seed + PDP referrer -> y≈1500  (S4, fixed)
//   V3 negative     : same journey but EXTERNAL referrer -> y=0 (S3)
// One fresh page per scenario (renderer wedges kill shared pages). Throttle:
// CPU 4x, 300ms RTT, 1Mbps. Re-anchor window ≈ 3s — watch 6-7s.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "https://hayaan.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({
  browserURL: "http://127.0.0.1:9339", defaultViewport: null, protocolTimeout: 120000,
});
const ONLY = process.argv[2] || "ALL";
const results = {};

async function newScenario() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
  });
  return page;
}
const diag = (page) => page.evaluate(() => ({
  y: window.scrollY | 0,
  path: location.pathname,
  seed: (sessionStorage.getItem("hayaanShopY") || "").slice(0, 48) || null,
  docH: document.documentElement.scrollHeight | 0,
}));
async function watch(page, target, secs = 7) {
  const t0 = Date.now();
  let firstHit = null;
  const out = [];
  while (Date.now() - t0 < secs * 1000) {
    const d = await diag(page);
    out.push(`${Math.round((Date.now() - t0) / 100) / 10}s:y${d.y}`);
    if (target !== null && Math.abs(d.y - target) <= 100 && firstHit === null) firstHit = Date.now() - t0;
    await sleep(400);
  }
  return { samples: out.join(" "), firstHit, final: await diag(page) };
}

if (ONLY === "ALL" || ONLY === "V1") try { // V1: real journey
  console.log("=== V1: real journey ===");
  const page = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(700);
  console.log("saved:", JSON.stringify(await diag(page)));
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
    { timeout: 40000, polling: 400 },
  );
  await sleep(1200);
  console.log("on PDP:", page.url());
  const back = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]'))
      .find(x => /Back to shop/i.test(x.textContent || ""));
    a.scrollIntoView({ block: "center" });
    return "scrolled";
  });
  await sleep(400);
  const backPos = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]'))
      .find(x => /Back to shop/i.test(x.textContent || ""));
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  const backTarget = backPos;
  await page.mouse.click(backTarget.x, backTarget.y);
  await page.waitForFunction(`location.pathname === "/" && !!document.querySelector("#catalog")`, { timeout: 40000, polling: 400 });
  const w = await watch(page, 1500);
  console.log("V1 samples:", w.samples);
  results.v1 = { firstHitMs: w.firstHit, ...w.final, pass: w.final.y >= 1400 };
  console.log("V1 FINAL:", JSON.stringify(results.v1), results.v1.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.v1 = { error: String(e).slice(0, 150) }; console.log("V1 ERROR:", String(e).slice(0, 150)); }

if (ONLY === "ALL" || ONLY === "V2") try { // V2: seeded + PDP referrer
  console.log("\n=== V2: seeded gate (PDP referrer) ===");
  const page = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(600);
  console.log("pre-nav:", JSON.stringify(await diag(page)));
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000, referer: `${BASE}/product/samsung-galaxy-a18` });
  const w = await watch(page, 1500);
  console.log("V2 samples:", w.samples);
  results.v2 = { firstHitMs: w.firstHit, ...w.final, pass: w.final.y >= 1400 };
  console.log("V2 FINAL:", JSON.stringify(results.v2), results.v2.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.v2 = { error: String(e).slice(0, 150) }; console.log("V2 ERROR:", String(e).slice(0, 150)); }

if (ONLY === "ALL" || ONLY === "V3") try { // V3: external referrer negative
  console.log("\n=== V3: external referrer (must NOT restore) ===");
  const page = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(600);
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000, referer: "https://example.com/blog-post" });
  await sleep(2500);
  const d = await diag(page);
  results.v3 = { ...d, pass: d.y === 0 };
  console.log("V3 FINAL:", JSON.stringify(results.v3), results.v3.pass ? "PASS" : "FAIL");
  await page.close();
} catch (e) { results.v3 = { error: String(e).slice(0, 150) }; console.log("V3 ERROR:", String(e).slice(0, 150)); }

fs.writeFileSync("/home/z/my-project/scripts/task107-final-results.json", JSON.stringify(results, null, 2));
browser.disconnect();
console.log("\nSUMMARY[" + ONLY + "]:", JSON.stringify(results));
process.exit(0);
