// Task 108b — reproduce the owner's journey on production (throttled):
// home -> scroll -> tap product (measure tap->PDP) -> Back to shop (measure
// return: overlay/cover, final y, top visible card) -> compare positions.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "https://hayaan.co";
const out = { steps: [] };
const log = (s) => { out.steps.push(s); console.log(JSON.stringify(s)); };

const browser = await puppeteer.launch({
  executablePath: SHELL,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932 }); // A18-class viewport
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction("document.querySelectorAll('a[href^=\"/product/\"]').length > 3", { timeout: 60000 });
// dismiss newsletter popup if present
try {
  await page.waitForSelector("button", { timeout: 5000 });
  const btns = await page.$$("button");
  for (const b of btns) {
    const txt = await b.evaluate((el) => el.textContent || "");
    if (/no thanks/i.test(txt)) { await b.click(); log({ step: "popup-dismissed" }); break; }
  }
} catch {}
log({ step: "home-ready", docH: await page.evaluate(() => document.documentElement.scrollHeight) });

// find the target card and scroll it to the top of the viewport
const slug = await page.evaluate(() => {
  const as = [...document.querySelectorAll('a[href^="/product/"]')];
  const a = as.find((x) => x.getAttribute("href").includes("nokia-5310")) || as[10];
  return a ? a.getAttribute("href").replace("/product/", "") : null;
});
await page.evaluate((s) => {
  const a = document.querySelector(`a[href="/product/${s}"]`);
  const y = a.getBoundingClientRect().top + window.scrollY - 130;
  window.scrollTo(0, y);
}, slug);
await new Promise((r) => setTimeout(r, 600)); // let the 250ms saver flush
const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("hayaanShopY") || "null"));
log({ step: "scrolled", slug, scrollY: await page.evaluate(() => window.scrollY), saved });

// tap the card (trusted click on the card link) — measure tap->PDP-content
const t0 = Date.now();
await page.evaluate((s) => {
  const a = document.querySelector(`a[href="/product/${s}"]`);
  a.scrollIntoView({ block: "center" });
}, slug);
const card = await page.$(`a[href="/product/${slug}"]`);
await card.click();
// URL flips on pushState
await page.waitForFunction("location.pathname.startsWith('/product/')", { timeout: 30000 });
const tUrl = Date.now();
// PDP content arrives when the product title node renders
await page.waitForFunction("!!document.querySelector('h1') && location.pathname.startsWith('/product/')", { timeout: 60000 });
const tPdp = Date.now();
log({ step: "card-click", tapToUrlMs: tUrl - t0, tapToPdpContentMs: tPdp - t0, pdp: page.url() });

// wait for back anchor
await page.waitForFunction("[...document.querySelectorAll('a')].some(a => a.textContent.trim().includes('Back to shop'))", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

// tap Back to shop
const r0 = Date.now();
const back = await page.evaluateHandle(() => [...document.querySelectorAll("a")].find((a) => a.textContent.trim().includes("Back to shop")));
await back.asElement().click();
// watch state every 100ms for 8s
let sawOverlay = 0, sawCover = 0, firstPosAt = null, finalY = null, topCard = null;
for (let i = 0; i < 80; i++) {
  let st = null;
  try {
    st = await page.evaluate(() => {
      const ov = !!document.getElementById("hayaan-nav-feedback");
      const cov = document.documentElement.classList.contains("hayaan-cov");
      return { path: location.pathname, ov, cov, y: window.scrollY | 0, ready: document.readyState };
    });
  } catch { await new Promise((r) => setTimeout(r, 100)); continue; }
  if (st.ov) sawOverlay++;
  if (st.cov) sawCover++;
  if (st.path === "/" && firstPosAt === null && st.y > 0) { firstPosAt = Date.now() - r0; }
  await new Promise((r) => setTimeout(r, 100));
}
const fin = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("a[href^='/product/']")];
  let top = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (r.top >= -10 && r.bottom > 0 && r.height > 60) { top = c.getAttribute("href"); break; }
  }
  return { y: window.scrollY | 0, saved: JSON.parse(sessionStorage.getItem("hayaanShopY") || "null"), topCard: top, docH: document.documentElement.scrollHeight };
});
finalY = fin.y;
topCard = fin.topCard;
log({ step: "return", overlaySamples: sawOverlay, coverSamples: sawCover, firstNonZeroYAtMs: firstPosAt, finalY, savedY: saved ? saved.y : null, yMatch: saved ? finalY === saved.y : null, topCard, docH: fin.docH, returnTotalMs: Date.now() - r0 });

await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-journey.json", JSON.stringify(out, null, 2));
