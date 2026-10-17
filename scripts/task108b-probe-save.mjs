import puppeteer from "puppeteer-core";
const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await puppeteer.launch({ executablePath: SHELL, headless: "shell", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932 });
page.on("console", (m) => console.log("PAGE:", m.text()));
await page.goto("http://127.0.0.1:3100/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction("document.querySelectorAll('a[href^=\"/product/\"]').length > 3", { timeout: 30000 });
await page.evaluate(() => {
  const a = document.querySelectorAll('a[href^="/product/"]')[8];
  a.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 1200)); // let the throttled save run
const res = await page.evaluate(() => {
  const saved = sessionStorage.getItem("hayaanShopY");
  // replicate the save loop manually
  const as = document.querySelectorAll('a[href^="/product/"]');
  let found = null;
  for (let i = 0; i < as.length; i++) {
    const r = as[i].getBoundingClientRect();
    if (r.height > 10 && r.bottom > 140) { found = { i, href: as[i].getAttribute("href"), dy: Math.round(r.top), h: Math.round(r.height) }; break; }
  }
  return { saved: saved ? JSON.parse(saved) : null, manual: found, y: window.scrollY | 0 };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
