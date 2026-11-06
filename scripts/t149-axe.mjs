// Task 149 — element-level a11y probe of the LIVE homepage with axe-core.
// Reproduces the three Lighthouse a11y failures (aria-allowed-attr,
// color-contrast, target-size) and dumps exact selectors, HTML snippets and
// computed colors so the fixes can be surgical. Also measures CLS via
// PerformanceObserver on a fresh load.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const OUT = "/tmp/t149-axe.json";
const BASE = process.argv[2] || "https://hayaan.co/";
const axeSource = readFileSync("/home/z/my-project/node_modules/axe-core/axe.min.js", "utf8");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
});

// Pass 1: CLS measurement on a fresh load.
const page = await ctx.newPage();
let cls = 0;
await page.addInitScript(() => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) window.__cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
});
await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(6000);
cls = await page.evaluate(() => window.__cls || 0);

// Pass 2: axe on the settled page.
await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: axeSource });
const results = await page.evaluate(() =>
  window.axe.run(document, {
    runOnly: { type: "rule", values: ["aria-allowed-attr", "color-contrast", "target-size"] },
    resultTypes: ["violations"],
  })
);

const slim = results.violations.map((v) => ({
  id: v.id,
  impact: v.impact,
  help: v.help,
  nodes: v.nodes.slice(0, 12).map((n) => ({
    target: n.target,
    html: (n.html || "").slice(0, 220),
    failureSummary: n.failureSummary,
    data: n.data
      ? {
          fgColor: n.data.fgColor,
          bgColor: n.data.bgColor,
          contrastRatio: n.data.contrastRatio,
          expectedContrastRatio: n.data.expectedContrastRatio,
          fontSize: n.data.fontSize,
          fontWeight: n.data.fontWeight,
          message: n.data.message,
        }
      : undefined,
  })),
}));

const out = { cls, url: BASE, violations: slim };
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log("CLS:", cls);
for (const v of slim) {
  console.log(`\n=== ${v.id} (${v.impact}) — ${v.nodes.length} nodes ===`);
  for (const n of v.nodes) {
    console.log("  target:", JSON.stringify(n.target));
    if (n.data) console.log("  data:", JSON.stringify(n.data));
    console.log("  html:", n.html.replace(/\s+/g, " ").slice(0, 160));
  }
}
await browser.close();
