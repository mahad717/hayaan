// Debug: trace the scroll trajectory during the back-to-shop restore.
import puppeteer from "puppeteer-core";

const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "http://127.0.0.1:3100";

const browser = await puppeteer.launch({ executablePath: SHELL, headless: "shell", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.setViewport({ width: 430, height: 932 });

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction("document.querySelectorAll('a[href^=\"/product/\"]').length > 3", { timeout: 60000 });
await page.evaluate(() => {
  const a = document.querySelectorAll('a[href^="/product/"]')[8];
  a.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 700));
const link = await page.evaluateHandle(() => document.querySelectorAll('a[href^="/product/"]')[8]);
await link.asElement().click();
await page.waitForFunction("location.pathname.startsWith('/product/') && !!document.querySelector('h1')", { timeout: 60000 });
const truth = await page.evaluate(() => JSON.parse(sessionStorage.getItem("hayaanShopY") || "null"));
console.log("truth:", JSON.stringify(truth));
await new Promise((r) => setTimeout(r, 600));
const back = await page.evaluateHandle(() => [...document.querySelectorAll("a")].find((a) => a.textContent.trim().includes("Back to shop")));
await back.asElement().click();
for (let i = 0; i < 45; i++) {
  try {
    const st = await page.evaluate(() => {
      const first = document.querySelector('a[href^="/product/"]');
      return {
        y: window.scrollY | 0,
        path: location.pathname,
        cov: document.documentElement.classList.contains("hayaan-cov"),
        rs: document.readyState,
        docH: document.documentElement.scrollHeight,
        firstCardTop: first ? Math.round(first.getBoundingClientRect().top + window.scrollY) : null,
      };
    });
    console.log(i * 100 + "ms", JSON.stringify(st));
  } catch (e) { console.log(i * 100 + "ms nav"); }
  await new Promise((r) => setTimeout(r, 100));
}
await page.screenshot({ path: "/home/z/my-project/scripts/task108b-restore-trace.png" });
await browser.close();
