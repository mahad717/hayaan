// Task 107c — under throttle: what is the stuck dialog, does it ever close?
import puppeteer from "puppeteer-core";

const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072 });

await page.goto("https://hayaan.co/", { waitUntil: "load", timeout: 120000 });
const t0 = Date.now();
let closed = null;
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => {
    const open = Array.from(document.querySelectorAll('[data-state="open"]'));
    const dlg = open.find((e) => e.getAttribute("role") === "dialog" || e.className?.toString?.().includes("data-[state"));
    return {
      n: open.length,
      text: dlg ? (dlg.textContent || "").replace(/\s+/g, " ").slice(0, 120) : null,
      role: dlg?.getAttribute("role") || null,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  }).catch(() => null);
  const el = Math.round((Date.now() - t0) / 100) / 10;
  console.log(`${el}s`, JSON.stringify(s));
  if (s && s.n === 0 && closed === null) { closed = el; console.log(">>> dialog closed at", el, "s"); break; }
  await sleep(700);
}
if (closed === null) console.log(">>> dialog NEVER closed within window");
await page.screenshot({ path: "/home/z/my-project/scripts/task107c-stuck-dialog.png" });
await browser.close();
