// Task 149 — desktop + PDP visual check of the accent-foreground change.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3222";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

// Desktop home
const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await d.newPage();
await dp.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await dp.waitForTimeout(2500);
await dp.screenshot({ path: "/home/z/my-project/download/task149-home-desktop.png" });
await d.close();

// Mobile PDP (accent button + pill if discounted)
const m = await browser.newContext({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
});
const mp = await m.newPage();
const body = await (await fetch(BASE + "/")).text();
const slug = (body.match(/"url":"https:\/\/hayaan\.co\/product\/([a-z0-9-]+)"/) || [])[1];
if (slug) {
  await mp.goto(`${BASE}/product/${slug}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: "/home/z/my-project/download/task149-pdp-mobile.png" });
  console.log("PDP probed:", slug);
} else {
  console.log("NO SLUG FOUND");
}
await browser.close();
console.log("done");
