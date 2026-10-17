// Task 109: visual verification of the live storefront after the image
// pipeline change — homepage grid (transform images render correctly?), a
// PDP, and a category page. Throttled like the standard harness.
import puppeteer from "puppeteer-core";

const EXE = "/home/z/.cache/puppeteer/chrome-headless-shell/linux-155.0.8059.39/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await puppeteer.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true });
page.setDefaultNavigationTimeout(60000);

// 1. homepage
await page.goto("https://hayaan.co/", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: "/home/z/my-project/download/task109-live-home-hero.png" });
// scroll to grid for card images
await page.evaluate(() => window.scrollTo(0, 900));
await new Promise(r => setTimeout(r, 3500));
await page.screenshot({ path: "/home/z/my-project/download/task109-live-home-grid.png" });

// broken-image census
const imgCensus = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")];
  return {
    total: imgs.length,
    broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 110)),
    transformLoaded: imgs.filter(i => i.complete && i.naturalWidth > 0 && i.currentSrc.includes("/render/image/")).length,
  };
});
console.log("home img census:", JSON.stringify(imgCensus));

// 2. PDP (A18 test product — JSON-LD price must stay "190.00")
await page.goto("https://hayaan.co/product/samsung-galaxy-a57-5g", { waitUntil: "networkidle2", timeout: 60000 }).catch(async () => {
  await page.goto("https://hayaan.co/product/iphone-18pro-max-256gb-black-esim", { waitUntil: "networkidle2", timeout: 60000 });
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: "/home/z/my-project/download/task109-live-pdp.png" });
const pdp = await page.evaluate(() => ({
  title: document.title.slice(0, 70),
  jsonLdPrice: (document.querySelector('script[type="application/ld+json"]')?.textContent.match(/"price":"([^"]+)"/) || [])[1] || "none",
  h1: document.querySelector("h1")?.textContent?.slice(0, 60),
}));
console.log("pdp:", JSON.stringify(pdp));

// 3. category
await page.goto("https://hayaan.co/category/computers-tv-gaming", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
const cat = await page.evaluate(() => ({
  productLinks: document.querySelectorAll('a[href^="/product/"]').length,
  broken: [...document.querySelectorAll("img")].filter(i => i.complete && i.naturalWidth === 0).length,
}));
console.log("category:", JSON.stringify(cat));
await browser.close();
console.log("DONE");
