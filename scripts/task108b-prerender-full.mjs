// T1b: prerender detection with FULL chromium (headless shell may lack prerendering).
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = process.env.HOME + "/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";
const BASE = "https://hayaan.co";
const out = {};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, // new headless
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const events = [];
page.on("console", (m) => { if (m.text().includes("prerender")) events.push(m.text()); });

await page.goto(BASE + "/product/nokia-5310", { waitUntil: "domcontentloaded", timeout: 60000 });
let found = null;
for (let i = 0; i < 20; i++) {
  const ts = browser.targets().map((t) => ({ type: t.type(), url: t.url() }));
  found = ts.find((t) => t.url === BASE + "/" );
  if (found) break;
  await new Promise((r) => setTimeout(r, 500));
}
out.prerenderTargetFound = !!found;
out.targets = browser.targets().map((t) => t.type() + " " + t.url());

// control: does a fresh "/" load itself show as prerenderable? also check main doc UA/features
out.features = await page.evaluate(() => ({
  ua: navigator.userAgent,
  prerenderingSupported: "onprerenderingchange" in document || document.prerendering === false,
}));
await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-prerender-full.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
