// Task 109: throttled paint forensics on live hayaan.co
// CPU 4x + 300ms RTT/1Mbps (LH-like), filmstrip + FCP/LCP + font timings.
import puppeteer from "puppeteer-core";

const EXE = "/home/z/.cache/puppeteer/chrome-headless-shell/linux-155.0.8059.39/chrome-headless-shell-linux64/chrome-headless-shell";
const URL = process.argv[2] || "https://hayaan.co/";

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars"],
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 300, downloadThroughput: (1 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true });
page.setDefaultNavigationTimeout(60000);

// paint snapshots
const shots = [];
let t0 = null;
const snap = async (label) => {
  try {
    const buf = await page.screenshot();
    shots.push({ label, at: Date.now() - t0, buf });
  } catch {}
};

// observe paint events live
await page.evaluateOnNewDocument(() => {
  window.__paints = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__paints.push({ type: e.entryType, t: Math.round(e.startTime), id: e.id || "" });
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__paints.push({ type: "LCP", t: Math.round(e.startTime), tag: (e.element && e.element.tagName) || "?" });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  document.addEventListener("securitypolicyviolation", () => {});
});

t0 = Date.now();
const loader = page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
// filmstrip: every 500ms for 12s
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 500));
  snap(`t+${Date.now() - t0}ms`);
}
await loader;
const resp = await page.evaluate(() => ({
  paints: window.__paints || [],
  y: window.scrollY,
  cov: document.documentElement.className.includes("hayaan-cov"),
}));
console.log("paint events:", JSON.stringify(resp.paints));
console.log("coverApplied:", resp.cov, "scrollY:", resp.y);

// save contact sheet strips
const fs = await import("fs");
fs.mkdirSync("/home/z/my-project/scripts/task109-frames", { recursive: true });
for (const s of shots) {
  fs.writeFileSync(`/home/z/my-project/scripts/task109-frames/${String(s.at).padStart(6, "0")}.png`, s.buf);
}
console.log("frames saved:", shots.length, "->", "/home/z/my-project/scripts/task109-frames");
await browser.close();
