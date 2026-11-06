// Task 149 — local harness: SSR fingerprints for every fix + code-split proof
// + mobile screenshots. Plain fetch for HTML checks; playwright for the
// picture-source + screenshot pass.
import { writeFileSync } from "fs";

const BASE = "http://127.0.0.1:3222";
let pass = 0;
let fail = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function html(path) {
  const r = await fetch(BASE + path, { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 11) Chrome/120 Mobile" } });
  return { code: r.status, body: await r.text() };
}

function scriptSet(body) {
  return [...new Set([...body.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]))];
}

// ---- 1. Homepage SSR fingerprints ----
const home = await html("/");
check("home 200", home.code === 200, `code=${home.code}`);

check("a11y-1: no aria-expanded on any INPUT (the old search bug)", !/<input[^>]*aria-expanded/i.test(home.body));
check("a11y-2: rating count span has no opacity-70", !/opacity-70">\(/.test(home.body));
check("a11y-3: subscribe button #c2410c", home.body.includes("bg-%5B%23c2410c%5D") || home.body.includes("bg-[#c2410c]"));
check("a11y-4: 48px mobile add button (h-12 w-12 sm:hidden)", home.body.includes("h-12 w-12 sm:hidden"));
check("a11y-5: product-title link block py-1.5", home.body.includes("block py-1.5 hover:text-brand"));

check("perf-1: mobile hero source present", home.body.includes("hero-shopping-3d-m760.webp") && home.body.includes("<picture"));
check("perf-2: GA deferred loader present", home.body.includes("ga4-deferred"));
check("perf-3: no blocking gtag script src", !/<script[^>]+src="https:\/\/www\.googletagmanager\.com/.test(home.body));

check("a11y-6: discount pill deep-brown label", home.body.includes("text-%5B%23451a03%5D") || home.body.includes("text-[#451a03]"));
check("a11y-7: EN/SO toggle names carry visible label", home.body.includes("EN — English") && home.body.includes("SO — Soomaali"));

const homeScripts = scriptSet(home.body);
console.log(`   home first-load script URLs: ${homeScripts.length}`);

// ---- 2. Split proof: /?view=checkout and /?view=product pull their chunks ----
const co = await html("/?view=checkout");
check("checkout deep-link 200", co.code === 200, `code=${co.code}`);
const coScripts = scriptSet(co.body);
const coExtra = coScripts.filter((s) => !homeScripts.includes(s));
check("split: checkout route adds chunks", coExtra.length >= 1, `extra=${coExtra.length}`);

const pdp = await html("/?view=product");
check("product deep-link 200", pdp.code === 200, `code=${pdp.code}`);
const pdpScripts = scriptSet(pdp.body);
const pdpExtra = pdpScripts.filter((s) => !homeScripts.includes(s));
check("split: product route adds chunks", pdpExtra.length >= 1, `extra=${pdpExtra.length}`);

// PDP route (own shell) must still SSR product content: probe a real slug.
const blog = await html("/blog");
const slugMatch = blog.body.match(/\/blog\/[a-z0-9-]+/);
const cat = await html("/?view=home");
void cat;
// find any product slug from the ItemList JSON-LD on home
const item = home.body.match(/"url":"https:\/\/hayaan\.co\/product\/([a-z0-9-]+)"/);
if (item) {
  const pdpPage = await html(`/product/${item[1]}`);
  check("pdp route 200", pdpPage.code === 200, `slug=${item[1]} code=${pdpPage.code}`);
  check("pdp route still SSRs product content", pdpPage.body.includes("/product/" + item[1]) && pdpPage.body.length > 40000, `bytes=${pdpPage.body.length}`);
} else {
  check("pdp route probe", false, "no product slug found in home ItemList JSON-LD");
}

// ---- 3. Playwright pass: picture source + screenshots ----
const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "/home/z/my-project/download/task149-home-mobile-early.png" });
await page.waitForTimeout(4500);
await page.screenshot({ path: "/home/z/my-project/download/task149-home-mobile-loaded.png" });
const heroSrc = await page.evaluate(() => {
  const img = document.querySelector("section img");
  return img ? img.currentSrc : "NO-IMG";
});
check("picture: mobile hero resolves to m760", heroSrc.includes("hero-shopping-3d-m760.webp"), heroSrc.slice(-60));
const ariaExpandedInputs = await page.evaluate(() => document.querySelectorAll('input[aria-expanded]').length);
check("live DOM: zero aria-expanded inputs", ariaExpandedInputs === 0, `count=${ariaExpandedInputs}`);
await browser.close();

writeFileSync("/tmp/t149-harness.json", JSON.stringify(results, null, 2));
console.log(`\nTOTAL: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
