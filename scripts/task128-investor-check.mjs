// Task 128 runtime check: /investors must ship fully — page renders, FAQPage
// JSON-LD carries the 6 investor FAQs, canonical + og wired, the EOI form is
// present, POST /api/leads accepts an investor lead (and rejects a nameless
// one), honeypot fakes ok, sitemap.xml lists /investors, and the footer link
// renders. Also captures desktop + mobile screenshots.
// Usage: node scripts/task128-investor-check.mjs  (env BASE, SHOT_PREFIX, NO_SHOT)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readdirSync } from "node:fs";

// Chrome version changes when the sandbox recycles — glob the known roots
// instead of hardcoding a version (155 vanished, 156 replaced it).
const chromeCandidates = () => {
  const roots = [
    ["/home/z/.cache/puppeteer/chrome", "chrome-linux64/chrome"],
    ["/home/z/.agent-browser/browsers", "chrome-linux64/chrome"],
    ["/home/z/.cache/ms-playwright", "chrome-linux/chrome"],
  ];
  const out = [];
  for (const [root, tail] of roots) {
    try { for (const v of readdirSync(root)) out.push(`${root}/${v}/${tail}`); } catch {}
  }
  return out;
};
const DEBUG_PORT = 9357;
const BASE = process.env.BASE || "http://127.0.0.1:3221";
const SHOT_PREFIX = process.env.SHOT_PREFIX || "/home/z/my-project/download/task128-investors-local";

const results = [];
const ok = (name, cond, extra = "") => { results.push([name, !!cond, extra]); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const get = async (url) => { try { const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) }); return { status: r.status, body: await r.text(), type: r.headers.get("content-type") || "" }; } catch (e) { return { status: 0, body: "", type: "", err: String(e) } } };
const post = async (url, data, ipSuffix = "0.1") => { try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.77.0.${ipSuffix}` }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) }); return { status: r.status, body: await r.json().catch(() => null) }; } catch (e) { return { status: 0, body: null, err: String(e) } } };

// ---- Phase A: page + API checks --------------------------------------------
const page = await get(`${BASE}/investors`);
ok("[investors] page 200", page.status === 200, `status ${page.status}`);
if (page.status === 200) {
  ok("[investors] h1", page.body.includes("Invest in Hayaan Market"));
  ok("[investors] key sections", page.body.includes("Why Hayaan, why now") && page.body.includes("What the round funds") && page.body.includes("How investing works") && page.body.includes("Investor FAQ"));
  ok("[investors] EOI form fields", page.body.includes(`id="inv-name"`) && page.body.includes(`id="inv-email"`) && page.body.includes(`id="inv-ticket"`) && page.body.includes(`id="invest-form"`));
  ok("[investors] securities disclaimer", page.body.includes("expression of interest only"));
  // FAQPage JSON-LD with the 6 visible FAQs
  let faqCount = 0;
  for (const m of page.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (j["@type"] === "FAQPage" && Array.isArray(j.mainEntity)) {
        faqCount = j.mainEntity.length;
        const names = j.mainEntity.map((q) => q.name);
        ok("[investors] FAQPage JSON-LD mirrors visible FAQs", names.some((n) => n.includes("How can I invest in Hayaan Market?")) && names.some((n) => n.includes("offer of securities?")), `${faqCount} questions`);
      }
    } catch {}
  }
  ok("[investors] FAQPage block exists", faqCount > 0, `${faqCount} questions`);
  ok("[investors] canonical", page.body.includes(`rel="canonical"`) && page.body.includes(`/investors`));
  ok("[investors] og meta", page.body.includes(`og:title`) && page.body.includes(`og:url`) && page.body.includes(`/investors`));
  ok("[investors] footer link", page.body.includes(`href="/investors"`));
}

const lead = {
  type: "investor", name: "Task 128 Verify", email: "invest-verify@hayaan.co",
  business: "Verify Capital", phone: "+252610000000",
  message: "Ticket size: $10k – $50k\nInvestor type: Angel investor\n\nAutomated verification lead — safe to delete.",
  source: "investors-page", website: "",
};
// Each test POST carries its own x-forwarded-for — otherwise every local
// request shares the "unknown" throttle bucket (5/10min) and the third POST
// trips 429 before its assertions even matter.
const posted = await post(`${BASE}/api/leads`, lead, "11");
ok("POST /api/leads investor accepted", posted.status === 200 && posted.body?.ok === true, `status ${posted.status}`);

const noName = await post(`${BASE}/api/leads`, { ...lead, name: "" }, "12");
ok("POST investor without name -> 400", noName.status === 400, `status ${noName.status} ${noName.body?.error ?? ""}`);

const noContact = await post(`${BASE}/api/leads`, { ...lead, name: "No Contact", email: "", phone: "" }, "13");
ok("POST investor without contact -> 400", noContact.status === 400, `status ${noContact.status}`);

const honeypot = await post(`${BASE}/api/leads`, { ...lead, name: "Bot Bot", website: "spam.example" }, "14");
ok("POST honeypot-filled -> fake ok", honeypot.status === 200 && honeypot.body?.ok === true, `status ${honeypot.status}`);

const sm = await get(`${BASE}/sitemap.xml`);
ok("sitemap.xml lists /investors", sm.body.includes(`${BASE.replace(/^https?:\/\//, "")}/investors`) || sm.body.includes("/investors"));

// ---- Phase B: screenshots (CDP) --------------------------------------------
// ONE chrome instance for both viewports — respawning on the same debug port
// left the first instance holding the port (and once wedged the whole run).
if (!process.env.NO_SHOT) {
  const CHROME = chromeCandidates().find((p) => existsSync(p));
  if (CHROME) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chrome = spawn(CHROME, [
      "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-sandbox", "--no-first-run", "--no-default-browser-check",
      "--disable-dev-shm-usage", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
      `--user-data-dir=/tmp/chrome-t128-${Date.now()}`,
      "--window-size=1440,2400", "about:blank",
    ], { stdio: "ignore" });
    let v = null;
    for (let i = 0; i < 24; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, { signal: AbortSignal.timeout(2000) })).json(); break; } catch {} }
    if (v) {
      function conn(url, t = 15000) { return new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; }); }
      let id = 0;
      function cmd(ws, m, p = {}, sid = null, to = 30000) { return new Promise((res, rej) => { const i = ++id; const pay = { id: i, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); }); }
      const ws = await conn(v.webSocketDebuggerUrl);
      const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
      const send = (m, p) => cmd(ws, m, p, sessionId);
      await send("Page.enable"); await send("Runtime.enable");
      for (const [mode, w, h] of [["desktop", 1440, 2400], ["mobile", 390, 2400]]) {
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: mode === "mobile" });
        await send("Page.navigate", { url: `${BASE}/investors` });
        await sleep(3500);
        const r = await send("Page.captureScreenshot", { format: "png" });
        writeFileSync(`${SHOT_PREFIX}-${mode}.png`, Buffer.from(r.data, "base64"));
        console.log(`screenshot: ${SHOT_PREFIX}-${mode}.png`);
      }
      ws.close();
    } else {
      console.log("chrome did not start — screenshots skipped");
    }
    chrome.kill();
  }
}

const failed = results.filter(([, pass]) => !pass);
console.log(`\ntotal checks: ${results.length}, failed: ${failed.length}`);
if (failed.length) { console.log("VERDICT: FAIL (" + failed.map(([n]) => n).join(", ") + ")"); process.exit(1); }
console.log("VERDICT: PASS");
