// Task 151 — verify product-card titles clamp cleanly at 2 lines again.
// Broken state (owner screenshot): Task 149's block+py anchor inside the h3's
// -webkit-box broke Chromium line counting -> 2 full lines + half-clipped 3rd.
// Fix (structure C): clamp on the padding-free anchor, py-1.5 on plain-block
// h3 — padding inside the clamp container makes Chromium paint the overflow
// line into the padding box even when the clamp engages.
// Deterministic test: inject a guaranteed-3-line name into a live card anchor
// and measure — anchor ~35px (2 lines), h3 ~47px; broken = anchor ~64px.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3222";
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
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);

// --- 1. Structure check: clamp on anchor (no py), py on the h3 ---
const cards = page.locator("h3:has(a[href^='/product/'])");
const n = await cards.count();
let good = 0;
for (let i = 0; i < n; i++) {
  const h3 = cards.nth(i);
  const a = h3.locator("a[href^='/product/']").first();
  const h3cls = (await h3.getAttribute("class")) || "";
  const acls = (await a.getAttribute("class")) || "";
  if (h3cls.includes("py-1.5") && acls.includes("line-clamp-2") && !acls.includes("py-1.5")) good++;
}
ok(n > 0, `card titles found (${n})`);
ok(good === n, `all titles use structure C (py on h3, padding-free clamp anchor) (${good}/${n})`);

// --- 2. Deterministic: inject a guaranteed-3-line name, clamp must hold 2 ---
const res = await page.evaluate(() => {
  const h3 = document.querySelector("h3");
  const a = h3.querySelector("a[href^='/product/']");
  const before = a.getBoundingClientRect().height;
  const orig = a.textContent;
  a.textContent = "Men's Multivitamins - Immune Boost with Vitamins A, B12, C, D, E and Zinc for Daily Energy Support 120 Tablets";
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const ah = a.getBoundingClientRect().height;
    const hh = h3.getBoundingClientRect().height;
    a.textContent = orig; // restore
    r({ before, ah, hh });
  })));
});
console.log(`  injected: anchor ${Math.round(res.before)}px -> ${Math.round(res.ah)}px, h3 ${Math.round(res.hh)}px`);
ok(res.ah <= 40, `anchor clamps to exactly 2 lines, no paint overflow (got ${Math.round(res.ah)}px; broken ~64px)`);
ok(res.hh <= 56, `h3 wraps 2 lines + py without spill (got ${Math.round(res.hh)}px)`);

// Ellipsis visual: re-inject and screenshot framed on that card
await page.evaluate(() => {
  const a = document.querySelector("h3 a[href^='/product/']");
  a.textContent = "Men's Multivitamins - Immune Boost with Vitamins A, B12, C, D, E and Zinc for Daily Energy Support 120 Tablets";
});
await page.locator("h3 a[href^='/product/']").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.screenshot({ path: "/home/z/my-project/download/task151-clamped-title.png" });

await browser.close();
console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
