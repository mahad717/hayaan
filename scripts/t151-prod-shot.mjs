// Task 151 — prod evidence: the two owner-circled long-name cards on hayaan.co
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto("https://hayaan.co/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

for (const name of ["Multivitamins", "EliteBook"]) {
  const a = page.locator(`h3 a[href^='/product/']`, { hasText: name }).first();
  if ((await a.count()) === 0) { console.log(`${name}: NOT on homepage`); continue; }
  const m = await a.evaluate((el) => ({
    h: el.getBoundingClientRect().height,
    h3: el.closest("h3").getBoundingClientRect().height,
    cls: el.className,
  }));
  console.log(`${name}: anchor ${Math.round(m.h)}px, h3 ${Math.round(m.h3)}px, class="${m.cls}" -> ${m.h <= 40 ? "CLEAN 2-LINE CLAMP" : "STILL BROKEN"}`);
}

// Screenshot the multivitamin card area (owner's circled case)
const mv = page.locator("h3 a", { hasText: "Multivitamins" }).first();
if ((await mv.count()) > 0) {
  await mv.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/home/z/my-project/download/task151-prod-evidence.png" });
}
await browser.close();
console.log("done");
