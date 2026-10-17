// Task 108b — production probes:
// T1: does "/" get prerendered from a PDP (post-108 no-cache headers)?
// T2: does the SSR catalog order match /api/products order?
// Env: chrome-headless-shell + puppeteer-core (worklog-proven setup).
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const SHELL = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const BASE = "https://hayaan.co";
const out = {};

const browser = await puppeteer.launch({
  executablePath: SHELL,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ---------- T2: SSR order vs API order ----------
{
  const page = await browser.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const ssrSlugs = await page.evaluate(() => {
    const set = new Set();
    for (const a of document.querySelectorAll('a[href^="/product/"]')) {
      const m = a.getAttribute("href").match(/^\/product\/([^/?#]+)/);
      if (m) set.add(m[1]);
    }
    return [...set];
  });
  const api = await page.evaluate(async () => {
    const r = await fetch("/api/products?limit=500");
    const d = await r.json();
    return (d.products || []).map((p) => p.slug);
  });
  let samePrefix = true;
  for (let i = 0; i < Math.min(ssrSlugs.length, api.length); i++) {
    if (ssrSlugs[i] !== api[i]) { samePrefix = false; break; }
  }
  out.t2 = {
    ssrCount: ssrSlugs.length,
    apiCount: api.length,
    samePrefix,
    ssrFirst12: ssrSlugs.slice(0, 12),
    apiFirst12: api.slice(0, 12),
    firstDiff: (() => {
      for (let i = 0; i < Math.min(ssrSlugs.length, api.length); i++)
        if (ssrSlugs[i] !== api[i]) return { i, ssr: ssrSlugs[i], api: api[i] };
      return null;
    })(),
  };
  await page.close();
}

// ---------- T1: prerender of "/" from a PDP ----------
{
  const page = await browser.newPage();
  await page.goto(BASE + "/product/nokia-5310", { waitUntil: "domcontentloaded", timeout: 60000 });
  // wait up to 8s for a prerender target to appear
  let found = null;
  for (let i = 0; i < 16; i++) {
    const ts = browser.targets().map((t) => ({ type: t.type(), url: t.url() }));
    found = ts.find((t) => t.url === BASE + "/" && t.type === "page" && t !== undefined);
    const anyPrerender = ts.some((t) => t.type === "other" || (t.type === "page" && t.url.includes("hayaan.co")));
    if (found) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  out.t1 = {
    pdpUrl: page.url(),
    prerenderTargetFound: !!found,
    targets: browser.targets().map((t) => t.type() + " " + t.url()),
  };
  await page.close();
}

await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task108b-prod-probe.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
