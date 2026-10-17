import puppeteer from "puppeteer-core";
const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await puppeteer.launch({ executablePath: SHELL, headless: "shell", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932 });
await page.goto("http://127.0.0.1:3100/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction("document.querySelectorAll('a[href^=\"/product/\"]').length > 3", { timeout: 30000 });
await page.evaluate(() => window.scrollTo(0, 3872));
await new Promise((r) => setTimeout(r, 400));
const info = await page.evaluate(() => {
  const as = [...document.querySelectorAll('a[href^="/product/"]')];
  const vis = as.slice(0, 30).map((a) => { const r = a.getBoundingClientRect(); return { href: (a.getAttribute("href")||"").slice(0,40), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  return { count: as.length, y: window.scrollY, vis: vis.filter(v => v.h>60 && v.bottom>140).slice(0,4), sample: vis.slice(0,6) };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
