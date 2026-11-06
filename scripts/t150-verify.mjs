// Task 150 — verify the owner-requested restore of the accent buttons:
//   1. Card add button is 36x36 again (Task 149 made it 48x48)
//   2. Labels/icons on Market Orange are WHITE again (Task 149 made them #451a03)
//      — card "+", PDP add-to-cart, discount pills, cart/wishlist badges
// Asserts computed styles, not pixels. Screenshots saved for evidence.
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

// --- 1. Card add button: size 36x36 + white icon on Market Orange bg ---
// (mobile variant only: .h-9.w-9 classes; the desktop .card-hover-add copy
// precedes it in DOM order and is display:none under touch emulation)
const btn = page.locator("button.btn-accent.h-9.w-9").first();
await btn.waitFor({ state: "visible", timeout: 15000 });
const box = await btn.boundingBox();
ok(box && Math.abs(box.width - 36) <= 1 && Math.abs(box.height - 36) <= 1,
  `card add button 36x36 (got ${box ? `${box.width}x${box.height}` : "null"})`);
const styles = await btn.evaluate((el) => {
  const cs = getComputedStyle(el);
  const svg = el.querySelector("svg");
  return { color: cs.color, bg: cs.backgroundColor, svgColor: svg ? getComputedStyle(svg).color : null };
});
ok(styles.color === "rgb(255, 255, 255)", `button label color white (got ${styles.color})`);
ok(styles.bg === "rgb(242, 140, 40)", `button bg Market Orange (got ${styles.bg})`);
ok(styles.svgColor === "rgb(255, 255, 255)", `+ icon color white (got ${styles.svgColor})`);

// --- 2. Discount pill on card (first discounted product if any) ---
const pill = page.locator("span.bg-\\[\\#f28c28\\]").first();
if (await pill.count() > 0) {
  const pillColor = await pill.evaluate((el) => getComputedStyle(el).color);
  ok(pillColor === "rgb(255, 255, 255)", `card discount pill text white (got ${pillColor})`);
} else {
  console.log("  SKIP no discounted product on homepage grid");
}
// Evidence shot framed like the owner's screenshot: product grid + button in view
await page.locator("button.btn-accent.h-9.w-9").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/home/z/my-project/download/task150-home-mobile.png" });

// --- 3. Add to cart -> header badge appears with white text ---
await btn.click();
await page.waitForTimeout(1800);
const badge = page.locator("span.bg-\\[\\#f28c28\\].ring-2").first();
if (await badge.count() > 0) {
  const badgeColor = await badge.evaluate((el) => getComputedStyle(el).color);
  ok(badgeColor === "rgb(255, 255, 255)", `header cart badge text white (got ${badgeColor})`);
} else {
  console.log("  SKIP cart badge did not render after add");
}

// --- 4. PDP: add-to-cart white label + discount pill white ---
const body = await (await fetch(BASE + "/")).text();
const slug = (body.match(/"url":"https:\/\/hayaan\.co\/product\/([a-z0-9-]+)"/) || [])[1];
if (slug) {
  await page.goto(`${BASE}/product/${slug}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const addBtns = page.locator("button.btn-accent");
  const n = await addBtns.count();
  for (let i = 0; i < n; i++) {
    const b = addBtns.nth(i);
    if (!(await b.isVisible())) continue;
    const c = await b.evaluate((el) => getComputedStyle(el).color);
    ok(c === "rgb(255, 255, 255)", `PDP accent button #${i} label white (got ${c})`);
    break;
  }
  const ppill = page.locator("span.bg-\\[\\#f28c28\\]").first();
  if (await ppill.count() > 0) {
    const c = await ppill.evaluate((el) => getComputedStyle(el).color);
    ok(c === "rgb(255, 255, 255)", `PDP discount pill text white (got ${c})`);
  } else {
    console.log("  SKIP PDP has no discount pill (product not discounted)");
  }
  await page.screenshot({ path: "/home/z/my-project/download/task150-pdp-mobile.png" });
  console.log("  PDP probed:", slug);
} else {
  console.log("  SKIP no product slug found");
}

await browser.close();
console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
