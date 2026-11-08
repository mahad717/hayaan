// Task 153 — prod evidence on https://hayaan.co (owner's framing):
// Subscribe button computed bg = #f28c28, Facebook tile live beside Mail.
import { chromium } from "playwright";

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  PASS ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`); }
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto("https://hayaan.co/", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);

const sub = page.locator("form button[type='submit']").filter({ hasText: /Subscribe|Ku biir/ }).first();
await sub.scrollIntoViewIfNeeded();
const subStyle = await sub.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, color: cs.color };
});
console.log(`  prod subscribe: bg=${subStyle.bg} color=${subStyle.color}`);
ok(subStyle.bg === "rgb(242, 140, 40)", `LIVE Subscribe background #f28c28 (got ${subStyle.bg})`);
ok(subStyle.color === "rgb(255, 255, 255)", `LIVE Subscribe label white (got ${subStyle.color})`);

const fb = page.locator("a[href='https://www.facebook.com/hayaan20']").first();
const fbBox = await fb.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), icon: !!el.querySelector("svg") };
});
ok(fbBox.w === 36 && fbBox.h === 36 && fbBox.icon, `LIVE Facebook tile 36x36 with icon (got ${fbBox.w}x${fbBox.h})`);

await page.waitForTimeout(900);
await page.screenshot({ path: "/home/z/my-project/download/task153-prod-evidence.png" });

await browser.close();
console.log(`\nPROD RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
