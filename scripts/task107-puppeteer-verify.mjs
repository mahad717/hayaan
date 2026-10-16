// Task 107 — S4 + S1 verification via puppeteer-core (raw CDP is flaky in
// this sandbox). Connects to the running chromium on :9339.
//   S4: seeded save + product referrer -> MUST restore to ~1500
//   S1: real journey (scroll 1500 -> A18 PDP -> Back to shop) -> position kept
import puppeteer from "puppeteer-core";

const BASE = "https://hayaan.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9339", defaultViewport: null });
console.log("connected; version:", await browser.version());

// Close stale hayaan tabs from earlier probes, keep one blank
const pages0 = await browser.pages();
for (const p of pages0) {
  const u = p.url();
  if (u.startsWith(BASE)) await p.close().catch(() => {});
}
console.log("stale tabs cleaned");

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
// Match the suite profile: CPU 4x, 300ms RTT, 1Mbps
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
});

const diag = () => page.evaluate(() => ({
  y: window.scrollY | 0,
  referrer: (document.referrer || "").slice(0, 80),
  marker: !!window.__hayaanShopScroll,
  seed: (sessionStorage.getItem("hayaanShopY") || "").slice(0, 60) || null,
  docH: document.documentElement.scrollHeight | 0,
}));

async function gotoWait(url, referrer) {
  await page.goto(url, { waitUntil: "load", timeout: 60000, ...(referrer ? { referer: referrer } : {}) });
}

// ---------------- S4: seeded save + product referrer ----------------
console.log("\n=== S4 (puppeteer) ===");
await gotoWait(`${BASE}/`);
await sleep(1500);
await page.evaluate(() => sessionStorage.setItem("hayaanShopY", JSON.stringify({ y: 1500, t: Date.now() })));
console.log("seeded:", JSON.stringify(await diag()));

await gotoWait(`${BASE}/`, `${BASE}/product/samsung-galaxy-a18`);
for (let i = 0; i < 12; i++) {
  const d = await diag();
  console.log(`t+${i * 250}ms`, JSON.stringify(d));
  if (i > 2 && d.y > 0) break;
  await sleep(250);
}
const s4 = await diag();
console.log("S4 FINAL:", JSON.stringify(s4), s4.y > 1000 ? "=> RESTORED (PASS)" : "=> NO RESTORE (FAIL)");

// ---------------- S1: real journey ----------------
console.log("\n=== S1 (puppeteer) ===");
await page.evaluate(() => sessionStorage.clear());
await gotoWait(`${BASE}/`);
await sleep(3000); // hydration
await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(800);
console.log("after scroll:", JSON.stringify(await diag()));

// click first product card (real navigation via Next Link)
const clicked = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a[href^="/product/"]'))
    .find(x => x.offsetParent !== null && x.getBoundingClientRect().width > 0);
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return { href: a.getAttribute("href"), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
console.log("card:", JSON.stringify(clicked));
if (clicked) {
  await page.mouse.click(clicked.x, clicked.y);
  await page.waitForFunction(
    `location.pathname.indexOf("/product/") === 0 && !!Array.from(document.querySelectorAll('a[href="/"]')).find(a => /Back to shop/i.test(a.textContent||""))`,
    { timeout: 45000, polling: 400 },
  );
  await sleep(1500); // PDP paint
  console.log("on PDP:", page.url(), JSON.stringify(await diag()));

  // real click on "Back to shop"
  const back = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]'))
      .find(x => /Back to shop/i.test(x.textContent || ""));
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  console.log("back anchor:", JSON.stringify(back));
  if (back) {
    await page.mouse.click(back.x, back.y);
    await page.waitForFunction(
      `location.pathname === "/" && !!document.querySelector("#catalog")`,
      { timeout: 45000, polling: 400 },
    );
    for (let i = 0; i < 12; i++) {
      const d = await diag();
      console.log(`t+${i * 250}ms`, JSON.stringify(d));
      await sleep(250);
    }
  }
}
const s1 = await diag();
console.log("S1 FINAL:", JSON.stringify(s1), s1.y > 800 ? "=> POSITION KEPT (PASS)" : "=> POSITION LOST (FAIL)");

await page.close().catch(() => {});
browser.disconnect();
console.log("\nDONE");
process.exit(0);
