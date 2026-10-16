// Task 107c — PRODUCTION verification v2 (diagnostics + fixed C2).
//   C1 real journey: home -> scroll 1500 -> card -> PDP -> "Back to shop"
//   C2 external referrer WITH fresh valid save => no cover, y stays 0
//   C3 clean direct load => no cover, y stays 0   (already passed in v1 run)
// Throttle: CPU 4x, 300ms RTT, 1Mbps. Viewport 1280x720 (matches proven 107b V1).
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "https://hayaan.co";
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
console.log("browser:", await browser.version());

async function newScenario() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 300, downloadThroughput: 131072, uploadThroughput: 131072,
  });
  return { ctx, page, cdp };
}

const diag = (page) => page.evaluate(() => ({
  y: window.scrollY | 0,
  path: location.pathname,
  cov: document.documentElement.classList.contains("hayaan-cov"),
  ready: document.readyState,
  t: Math.round(performance.now()),
})).catch(() => null);

async function sampleLoop(page, { maxMs = 25000, wantRestore = true, savedY = 1500 } = {}) {
  const t0 = Date.now();
  const samples = [];
  let settled = null;
  while (Date.now() - t0 < maxMs) {
    const s = await diag(page);
    if (s) {
      samples.push(s);
      if (wantRestore && s.path === "/" && !s.cov && s.ready === "complete") {
        if (Math.abs(s.y - savedY) <= 2) { settled = { at: Date.now() - t0, ...s }; break; }
        if (samples.length > 30) { settled = { at: Date.now() - t0, ...s }; break; }
      }
      if (!wantRestore && s.ready === "complete" && samples.length > 14) break;
    }
    await sleep(70);
  }
  return { samples, settled };
}

// Fresh-profile newsletter popup ("New arrivals & deals") opens ~8-10s after
// load and swallows clicks. Returning users have it dismissed — close it here.
async function dismissPopup(page) {
  const st = await page.evaluate(() => {
    const open = document.querySelector('[data-state="open"][role="dialog"], [data-state="open"].bg-background, body > [data-state="open"]');
    const anyOpen = Array.from(document.querySelectorAll('[data-state="open"]'));
    if (!anyOpen.length) return { open: false };
    const root = anyOpen[anyOpen.length - 1];
    const btn = Array.from(root.querySelectorAll("button")).find((b) => /no thanks/i.test(b.textContent || ""))
      || root.querySelector("button[aria-label*=lose i], button[aria-label*=lose]");
    const r = btn ? btn.getBoundingClientRect() : null;
    return { open: true, text: (root.textContent || "").replace(/\s+/g, " ").slice(0, 60),
      btn: r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null };
  }).catch(() => ({ open: false }));
  if (!st.open) return { dismissed: false };
  if (st.btn) { await page.mouse.click(st.btn.x, st.btn.y); await sleep(800); }
  const after = await page.evaluate(() => document.querySelectorAll('[data-state="open"]').length).catch(() => -1);
  return { dismissed: after === 0, popupText: st.text, stillOpen: after };
}

const covOf = (samples) => samples.filter((s) => s.cov);
const flashOf = (samples) => samples.filter((s) => s.path === "/" && s.ready !== "uninitialized" && !s.cov && s.y === 0);

// ---------------- C1 ----------------
try {
  console.log("=== C1: real journey (cover -> restore) ===");
  const { ctx, page } = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(900);
  console.log("saved:", JSON.stringify(await diag(page)));
  const pop = await dismissPopup(page);
  console.log("popup:", JSON.stringify(pop));
  if (pop.stillOpen > 0) throw new Error("popup not dismissible");
  const hit = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a[href^="/product/"]'));
    const a = cards.find((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
    if (!a) return { err: "no fully-visible card", total: cards.length };
    const r = a.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
    const el = document.elementFromPoint(x, y);
    return { href: a.getAttribute("href"), x, y,
      hitTag: el ? el.tagName : null, hitText: el ? (el.textContent || "").slice(0, 30) : null,
      hitInCard: el ? !!a.contains(el) : false };
  });
  console.log("card probe:", JSON.stringify(hit));
  if (hit.err) throw new Error(hit.err + " total=" + hit.total);
  if (!hit.hitInCard) console.log("WARN: elementFromPoint not inside card:", hit.hitTag, hit.hitText);

  await page.mouse.click(hit.x, hit.y);

  // Post-click behavior trace (15s): did navigation happen at all?
  const trace = [];
  const t0 = Date.now();
  let onPdp = false;
  while (Date.now() - t0 < 15000) {
    const d = await diag(page);
    if (d) {
      trace.push(`${Math.round((Date.now() - t0) / 100) / 10}s:${d.path.slice(0, 14)}:y${d.y}:${d.ready.slice(0, 4)}`);
      if (d.path.indexOf("/product/") === 0 && d.ready === "complete") { onPdp = true; break; }
    }
    await sleep(300);
  }
  console.log("post-click trace:", trace.join(" | "));
  if (!onPdp) throw new Error("click did not reach a PDP within 15s — see trace");

  await page.waitForFunction(
    `Array.from(document.querySelectorAll('a[href="/"]')).some(a => /Back to shop/i.test(a.textContent||""))`,
    { timeout: 60000, polling: 400 },
  );
  await sleep(1200);
  console.log("on PDP:", page.url());
  console.log("preNav seed:", JSON.stringify(await page.evaluate(() => sessionStorage.getItem("hayaanShopY"))));

  const back = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
    if (!a) return null;
    a.scrollIntoView({ block: "center" });
    return true;
  });
  await sleep(500);
  const backPos = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href="/"]')).find((x) => /Back to shop/i.test(x.textContent || ""));
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!back || !backPos) throw new Error("no back anchor");
  const clickT = Date.now();
  await page.mouse.click(backPos.x, backPos.y);

  const { samples, settled } = await sampleLoop(page, { maxMs: 25000, wantRestore: true, savedY: 1500 });
  const covSeen = covOf(samples);
  const flashes = flashOf(samples);
  const post = samples.filter((s) => s.path === "/" && !s.cov && s.ready === "complete");
  const finalY = post.length ? post[post.length - 1].y : null;
  results.C1 = {
    pass: !!(settled && settled.y === 1500 && flashes.length === 0 && covSeen.length > 0),
    coverSeen: covSeen.length > 0,
    firstCoverAt: covSeen.length ? `${covSeen[0].t}ms(page-time)` : null,
    settled, finalY, flashCount: flashes.length,
    timeline: samples.slice(0, 40).map((s) => `${s.t}ms y=${s.y} cov=${s.cov ? 1 : 0} ${s.path.slice(0, 12)} ${s.ready.slice(0, 4)}`),
  };
  console.log(JSON.stringify(results.C1, null, 1));
  await ctx.close();
} catch (e) { results.C1 = { pass: false, error: String(e) }; console.log("C1 ERR:", String(e).slice(0, 300)); }

// ---------------- C2 (fixed: actually navigate with external referer) ----------------
try {
  console.log("=== C2: external referrer + fresh save => no cover ===");
  const { ctx, page } = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(900);
  console.log("seeded:", await page.evaluate(() => sessionStorage.getItem("hayaanShopY")));
  await page.setExtraHTTPHeaders({ Referer: "https://www.google.com/" });
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  const { samples } = await sampleLoop(page, { maxMs: 20000, wantRestore: false });
  const covSamples = covOf(samples);
  results.C2 = {
    pass: covSamples.length === 0 && samples.every((s) => s.y === 0),
    coverSeen: covSamples.length > 0,
    referrer: await page.evaluate(() => document.referrer || "(empty)"),
    maxY: Math.max(...samples.map((s) => s.y)), sampleCount: samples.length,
  };
  console.log(JSON.stringify(results.C2));
  await ctx.close();
} catch (e) { results.C2 = { pass: false, error: String(e) }; console.log("C2 ERR:", String(e).slice(0, 300)); }

// ---------------- C3 ----------------
try {
  console.log("=== C3: clean direct load => no cover ===");
  const { ctx, page } = await newScenario();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120000 });
  const { samples } = await sampleLoop(page, { maxMs: 20000, wantRestore: false });
  const covSamples = covOf(samples);
  results.C3 = {
    pass: covSamples.length === 0 && samples.every((s) => s.y === 0),
    coverSeen: covSamples.length > 0,
    maxY: Math.max(...samples.map((s) => s.y)), sampleCount: samples.length,
  };
  console.log(JSON.stringify(results.C3));
  await ctx.close();
} catch (e) { results.C3 = { pass: false, error: String(e) }; console.log("C3 ERR:", String(e).slice(0, 300)); }

await browser.close();
fs.writeFileSync("/home/z/my-project/scripts/task107c-prod-results.json", JSON.stringify(results, null, 2));
console.log("WROTE scripts/task107c-prod-results.json");
