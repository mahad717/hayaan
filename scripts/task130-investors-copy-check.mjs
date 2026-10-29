// Task 130: owner asked to SIMPLIFY the "Demand is compounding through content"
// card on /investors and to remove the acquisition methods (specific keyword
// targets, structured data for Google/AI answer engines) for privacy — the
// investor page is public and competitors could read the exact playbook.
// This harness asserts: new simplified copy present, old method copy absent
// page-wide (including FAQ schema text), page still structurally healthy.
// Screenshots via CDP chrome-glob (lesson: hardcoded versions rot).
import { spawn } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3222";
const DEBUG_PORT = process.env.DEBUG_PORT || "9360";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "download/task130-investors-local";

const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

const res = await fetch(`${BASE}/investors`, { redirect: "manual" });
const html = await res.text();
ok("GET /investors -> 200", res.status === 200, `status=${res.status}`);

// 1. simplified card copy present
ok("simplified card body present", html.includes("Buyers find Hayaan through the guides we publish") && html.includes("growth channel that compounds as the catalog grows"));

// 2. scrubbed FAQ + use-of-funds variants present
ok("FAQ use-of-funds scrubbed variant present", html.includes("backed by the buyer guides that already bring customers in"));
ok("use-of-funds card scrubbed variant present", html.includes("the bilingual guides that bring new customers in"));

// 3. method leaks ABSENT page-wide
const leaks = [
  "structured data built for both Google",
  "AI answer engines",
  "SEO and AEO",
  "laptop, Galaxy foldable",
  "appliance prices in Somalia, with",
  "turns searches into customers",
  "competitors simply don't operate",
  "customer-acquisition channel",
];
const foundLeaks = leaks.filter((s) => html.includes(s));
ok("no acquisition-method leaks on the page", foundLeaks.length === 0, foundLeaks.join(" | "));

// 4. page still structurally healthy
ok("h1 present", html.includes(">Invest in Hayaan Market</h1>"));
ok("FAQPage JSON-LD still present", html.includes('"FAQPage"'));
ok("canonical /investors", html.includes('hreflang') || html.includes('canonical'), "");
ok("canonical link exact", /rel="canonical"[^>]*href="[^"]*\/investors"/.test(html));
ok("EOI form anchor present", html.includes('id="invest-form"'));
ok("non-offer disclaimer intact", html.includes("does not constitute an offer"));
ok("stats band intact", html.includes("live listings on the storefront"));

// 5. screenshots (CDP)
if (!process.env.NO_SHOT) {
  const CHROME = [
    ...readdirSync("/home/z/.cache/puppeteer/chrome", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name).sort().reverse()
      .map((d) => `/home/z/.cache/puppeteer/chrome/${d}/chrome-linux64/chrome`),
    "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome-linux64/chrome",
  ].find((p) => existsSync(p));
  if (!CHROME) console.log("screenshots SKIPPED: no chrome binary found");
  if (CHROME) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chrome = spawn(CHROME, [
      "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-sandbox", "--no-first-run", "--no-default-browser-check",
      "--disable-dev-shm-usage",
      `--user-data-dir=/tmp/chrome-t130-${Date.now()}`,
      "--window-size=1440,2400", "about:blank",
    ], { stdio: "ignore" });
    let v = null;
    for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
    if (v) {
      const conn = (url, t = 15000) => new Promise((res2, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res2(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; });
      let id = 0;
      const cmd = (ws, m, p = {}, sid = null, to = 45000) => new Promise((res2, rej) => { const i2 = ++id; const pay = { id: i2, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i2) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res2(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); });
      const ws = await conn(v.webSocketDebuggerUrl);
      const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
      const send = (m, p) => cmd(ws, m, p, sessionId);
      await send("Page.enable"); await send("Runtime.enable");
      for (const [name, w, h, mobile] of [["desktop", 1440, 2400, false], ["mobile", 390, 3200, true]]) {
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
        await send("Page.navigate", { url: `${BASE}/investors` });
        await sleep(4000);
        const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(`${SHOT_PREFIX}-${name}.png`, Buffer.from(r.data, "base64"));
        console.log(`screenshot: ${SHOT_PREFIX}-${name}.png`);
      }
    }
    chrome.kill();
  }
}

const failed = results.filter(([, pass]) => !pass);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([n]) => n).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
