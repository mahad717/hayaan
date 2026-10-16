// Task 107c — read the dialog that opens on fresh profiles (home page).
import puppeteer from "puppeteer-core";

const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto("https://hayaan.co/", { waitUntil: "load", timeout: 120000 });
await sleep(3000);

const dlg = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[data-state="open"]'));
  return els.map((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      tag: e.tagName, id: e.id || null, role: e.getAttribute("role"),
      rect: [r.x | 0, r.y | 0, r.width | 0, r.height | 0].join(","),
      pos: cs.position, pe: cs.pointerEvents,
      text: (e.textContent || "").replace(/\s+/g, " ").slice(0, 300),
      buttons: Array.from(e.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 40)).slice(0, 8),
      aria: e.getAttribute("aria-label"),
    };
  });
});
console.log(JSON.stringify(dlg, null, 1));
// keys it may use to remember consent
const storage = await page.evaluate(() => ({
  ls: Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => {
    const k = localStorage.key(i); return [k, (localStorage.getItem(k) || "").slice(0, 60)];
  })),
  ss: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => {
    const k = sessionStorage.key(i); return [k, (sessionStorage.getItem(k) || "").slice(0, 60)];
  })),
}));
console.log(JSON.stringify(storage, null, 1));
await browser.close();
