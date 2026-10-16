// Task 107c — identify the element blocking card clicks on production home.
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
await sleep(2500);
await page.evaluate(() => window.scrollTo(0, 1500));
await sleep(900);

const report = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('a[href^="/product/"]'));
  const a = cards.find((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
  const r = a.getBoundingClientRect();
  const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
  const el = document.elementFromPoint(x, y);
  const chain = [];
  let n = el;
  while (n && chain.length < 8) {
    const cs = getComputedStyle(n);
    chain.push({
      tag: n.tagName, id: n.id || null, cls: (n.className || "").toString().slice(0, 60),
      pos: cs.position, z: cs.zIndex, pe: cs.pointerEvents, op: cs.opacity,
      rect: (() => { const b = n.getBoundingClientRect(); return [b.x | 0, b.y | 0, b.width | 0, b.height | 0].join(","); })(),
    });
    n = n.parentElement;
  }
  // everything stacked at that point
  const stack = document.elementsFromPoint(x, y).slice(0, 6).map((e) => {
    const cs = getComputedStyle(e);
    return `${e.tagName}#${e.id || ""}.${(e.className || "").toString().slice(0, 30)} pe=${cs.pointerEvents} z=${cs.zIndex}`;
  });
  // known suspects
  const suspects = {
    tapFeedback: !!document.getElementById("hayaan-tap-overlay") || !!window.__hayaanTapFeedback,
    loadingOverlay: Array.from(document.querySelectorAll("div")).filter((d) => /Loading the shop/i.test(d.textContent || "") && d.offsetParent !== null).length,
    fixedVisible: Array.from(document.querySelectorAll("body *")).filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.position === "fixed" || cs.position === "sticky") && cs.pointerEvents !== "none" && e.offsetWidth > 200 && e.offsetHeight > 100;
    }).slice(0, 8).map((e) => `${e.tagName}#${e.id || ""}.${(e.className || "").toString().slice(0, 40)}`),
  };
  return { point: [x, y], card: a.getAttribute("href"), chain, stack, suspects };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
