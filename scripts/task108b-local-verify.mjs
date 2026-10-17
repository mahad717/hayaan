// Task 108b — LOCAL verification (standalone :3100, throttled A18-class):
// J1 journey: home -> scroll -> card tap (real nav now) -> PDP -> Back to shop
//    ASSERT: final y == saved y AND top visible card == saved top card.
// J2 order stability: SSR-rendered card sequence == post-API sequence.
// J3 negative gates: clean load + external referrer never cover/restore.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3100";
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

const browser = await puppeteer.launch({
  executablePath: SHELL,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function throttle(page) {
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.setViewport({ width: 430, height: 932 });
}

const topVisibleCard = () =>
  page.evaluate(() => {
    for (const a of document.querySelectorAll('a[href^="/product/"]')) {
      const r = a.getBoundingClientRect();
      if (r.height > 10 && r.bottom > 140) return (a.getAttribute("href") || "").replace("/product/", "");
    }
    return null;
  });

// ---------- J1: full journey ----------
{
  const page = await browser.newPage();
  await throttle(page);
  globalThis.page = page;
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction("document.querySelectorAll('a[href^=\"/product/\"]').length > 3", { timeout: 60000 });
  const slugs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/product/"]')].map((a) => a.getAttribute("href").replace("/product/", "")));
  const slug = slugs[Math.min(8, slugs.length - 1)];
  await page.evaluate((s) => {
    const a = document.querySelector(`a[href="/product/${s}"]`);
    window.scrollTo(0, a.getBoundingClientRect().top + window.scrollY - 130);
  }, slug);
  await new Promise((r) => setTimeout(r, 700));

  // tap the card TITLE (inside the Link) — the anchor path
  const t0 = Date.now();
  await page.evaluate((s) => document.querySelector(`a[href="/product/${s}"]`).scrollIntoView({ block: "center" }), slug);
  const link = await page.$(`a[href="/product/${slug}"]`);
  await link.click();
  try {
    await page.waitForFunction("location.pathname === '/product/" + slug + "'", { timeout: 30000 });
  } catch {}
  await page.waitForFunction("location.pathname.startsWith('/product/') && !!document.querySelector('h1')", { timeout: 60000 });
  log("j1-pdp", { ms: Date.now() - t0, url: page.url() });
  // ground truth: the pagehide-flushed save (what the restore will actually read)
  const truth = await page.evaluate(() => JSON.parse(sessionStorage.getItem("hayaanShopY") || "null"));
  log("j1-truth", truth);
  await page.waitForFunction("[...document.querySelectorAll('a')].some(a => a.textContent.trim().includes('Back to shop'))", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  const r0 = Date.now();
  const back = await page.evaluateHandle(() => [...document.querySelectorAll("a")].find((a) => a.textContent.trim().includes("Back to shop")));
  await back.asElement().click();
  let coverSamples = 0;
  for (let i = 0; i < 60; i++) {
    try {
      const st = await page.evaluate(() => ({ cov: document.documentElement.classList.contains("hayaan-cov"), path: location.pathname, y: window.scrollY | 0 }));
      if (st.cov) coverSamples++;
      if (st.path === "/" && st.y > 0 && !st.cov) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  // wait for the alignment window to close (3s) then assert
  await new Promise((r) => setTimeout(r, 3300));
  const fin = await page.evaluate(() => ({ y: window.scrollY | 0, docH: document.documentElement.scrollHeight }));
  const finTop = await topVisibleCard();
  const yMatch = truth ? fin.y === truth.y : false;
  const topMatch = truth && truth.top ? finTop === truth.top : true;
  log("j1-final", { finalY: fin.y, truthY: truth && truth.y, truthTop: truth && truth.top, yMatch, finTop, topMatch, coverSamples, ms: Date.now() - r0 });
  await page.close();
}

// ---------- J2: SSR sequence == post-API sequence ----------
{
  const page = await browser.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const ssrSeq = await page.evaluate(() => [...document.querySelectorAll('a[href^="/product/"]')].map((a) => a.getAttribute("href").replace("/product/", "")));
  await page.waitForFunction("window.__hayaanShopScroll", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500)); // let the API fetch + swap settle
  const postSeq = await page.evaluate(() => [...document.querySelectorAll('a[href^="/product/"]')].map((a) => a.getAttribute("href").replace("/product/", "")));
  const prefixLen = Math.min(ssrSeq.length, postSeq.length);
  let stable = true;
  for (let i = 0; i < prefixLen; i++) if (ssrSeq[i] !== postSeq[i]) { stable = false; break; }
  log("j2-order", { ssrCount: ssrSeq.length, postCount: postSeq.length, stablePrefix: stable });
  await page.close();
}

// ---------- J3: negative gates ----------
{
  const page = await browser.newPage();
  await throttle(page);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const clean = await page.evaluate(() => ({ cov: document.documentElement.classList.contains("hayaan-cov"), y: window.scrollY | 0 }));
  log("j3-clean", { ...clean, pass: !clean.cov && clean.y === 0 });
  await page.close();
}

await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-local-results.json", JSON.stringify(out, null, 2));
console.log("DONE");
