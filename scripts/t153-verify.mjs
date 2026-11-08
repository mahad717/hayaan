// Task 153 — owner: "Make the color of that button: #f28c28" (footer Subscribe,
// circled in the WhatsApp screenshot) + "below social buttons add our facebook
// page: https://www.facebook.com/hayaan20".
// Fix: Subscribe drops Task 149's burnt-orange #c2410c for .btn-accent (the
// exact Add-to-cart treatment: #f28c28 bg, white label, 88%-mix hover); the
// F4 social row gains a real Facebook tile (36px, same chrome as Mail).
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3222";
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  PASS ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`); }
};

// --- 1. SSR fingerprint: no burnt orange, btn-accent on Subscribe, FB link ---
const html = await (await fetch(BASE + "/")).text();
ok(!html.includes("#c2410c") && !html.includes("c2410c"), "burnt-orange #c2410c fully gone from SSR HTML");
ok(html.includes("https://www.facebook.com/hayaan20"), "SSR HTML carries the Facebook page link");
ok(html.includes('rel="noopener noreferrer"') && html.includes('target="_blank"'), "Facebook link opens safely in a new tab");
ok(html.includes('aria-label="Facebook"'), "Facebook tile has an accessible name");
// Subscribe button: among ALL SSR button tags, one must carry btn-accent +
// rounded-lg (the footer submit — the bottom-bar CTA is rounded-md).
const btnTags = html.match(/<button[^>]*>/g) || [];
ok(!!btnTags.find((t) => t.includes("btn-accent") && t.includes("rounded-lg")),
   "Subscribe button uses .btn-accent (brand CTA treatment)");

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

// --- 2. Computed styles: Subscribe is Market Orange + white ---
const sub = page.locator("form button[type='submit']").filter({ hasText: /Subscribe|Ku biir/ }).first();
await sub.scrollIntoViewIfNeeded();
const subStyle = await sub.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, color: cs.color, h: el.getBoundingClientRect().height };
});
console.log(`  subscribe: bg=${subStyle.bg} color=${subStyle.color} h=${Math.round(subStyle.h)}px`);
ok(subStyle.bg === "rgb(242, 140, 40)", `Subscribe background is #f28c28 Market Orange (got ${subStyle.bg})`);
ok(subStyle.color === "rgb(255, 255, 255)", `Subscribe label is white, same as Add-to-cart (got ${subStyle.color})`);
ok(Math.round(subStyle.h) === 36, `Subscribe stays 36px tall (got ${Math.round(subStyle.h)}px)`);

// --- 3. Facebook tile: real link, 36px, icon inside, sits beside Mail ---
const fb = page.locator("a[href='https://www.facebook.com/hayaan20']").first();
const fbInfo = await fb.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    border: cs.borderRadius, target: el.target, rel: el.rel,
    label: el.getAttribute("aria-label"),
    icon: !!el.querySelector("svg"),
    nextToMail: !!el.previousElementSibling && (el.previousElementSibling.href || "").startsWith("mailto:"),
  };
});
console.log(`  facebook tile: ${fbInfo.w}x${fbInfo.h} target=${fbInfo.target} rel=${fbInfo.rel} label=${fbInfo.label}`);
ok(fbInfo.w === 36 && fbInfo.h === 36, "Facebook tile is 36x36, identical chrome to the Mail tile");
ok(fbInfo.target === "_blank" && fbInfo.rel === "noopener noreferrer", "opens in new tab with noopener");
ok(fbInfo.label === "Facebook" && fbInfo.icon, "lucide Facebook icon present with accessible name");
ok(fbInfo.nextToMail, "Facebook tile sits in the social row right after the Mail tile");

// --- 4. Owner's framing screenshot: subscribe + social row together ---
await page.waitForTimeout(900);
await page.screenshot({ path: "/home/z/my-project/download/task153-footer.png" });

await browser.close();
console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
