// Task 150 — prod evidence: hayaan.co mobile grid, framed like the owner's screenshot
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto("https://hayaan.co/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
const btn = page.locator("button.btn-accent.h-9.w-9").first();
await btn.waitFor({ state: "visible", timeout: 20000 });
const box = await btn.boundingBox();
const s = await btn.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { color: cs.color, bg: cs.backgroundColor, svg: getComputedStyle(el.querySelector("svg")).color };
});
console.log(`prod button: ${box.width}x${box.height} color=${s.color} bg=${s.bg} icon=${s.svg}`);
await btn.scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/home/z/my-project/download/task150-prod-evidence.png" });
await browser.close();
console.log("done");
