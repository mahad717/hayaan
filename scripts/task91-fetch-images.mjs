// Task 91: fetch the featured image for each new sanguni mobile through a
// challenge-passing headless Chrome (Task 53 pattern: spawn chrome, pass the
// "One moment" challenge once on the homepage, then in-page fetch each image
// same-origin with cookies and return base64).
// Resumable: skips files that already exist and look like real images.
// Run: node scripts/task91-fetch-images.mjs  (re-run until 0 missing)

import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.agent-browser/browsers/chrome-155.0.8059.39/chrome",
  "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const DEBUG_PORT = 9341;
const PAYLOAD = "/home/z/my-project/scripts/task91-payload.json";
const OUT_DIR = "/home/z/my-project/scripts/task91-img-raw";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary"); process.exit(1); }
mkdirSync(OUT_DIR, { recursive: true });

const items = JSON.parse(readFileSync(PAYLOAD, "utf8"));
const MAGIC_OK = (buf) =>
  (buf[0] === 0xff && buf[1] === 0xd8) || // jpeg
  (buf[0] === 0x89 && buf[1] === 0x50) || // png
  (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46) || // riff/webp
  (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46); // gif

// ---------- chrome ----------
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  "--disable-blink-features=AutomationControlled",
  `--user-agent=${UA}`,
  "--lang=en-US",
  `--user-data-dir=/tmp/chrome-t91-${Date.now()}`,
  "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill(); } catch {} });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools never came up"); process.exit(1); }
console.log("[t91] chrome up");
const browserWS = versionInfo.webSocketDebuggerUrl;

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
    const onMsg = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); d.error ? reject(new Error(d.error.message)) : resolve(d.result); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}

const ws = await connectWs(browserWS);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);
await sendCmd(ws, "Network.enable", {}, sessionId);

// pass the challenge once
console.log("[t91] passing challenge on sanguni.so homepage…");
await sendCmd(ws, "Page.navigate", { url: "https://sanguni.so/" }, sessionId);
await sleep(9000); // challenge reloads itself once (~5s)
for (let i = 0; i < 10; i++) {
  const { result } = await sendCmd(ws, "Runtime.evaluate", {
    expression: "document.title + '|' + location.href", returnByValue: true,
  }, sessionId);
  const title = result?.value ?? "";
  if (!/one moment|just a moment/i.test(title) && title.length > 0) { console.log("[t91] challenge passed:", title); break; }
  await sleep(2000);
}

let ok = 0, skip = 0, fail = 0;
for (const [idx, it] of items.entries()) {
  const outPath = `${OUT_DIR}/${it.slug}${it.ext}`;
  if (existsSync(outPath) && MAGIC_OK(readFileSync(outPath).subarray(0, 4))) { skip++; continue; }
  const expr = `(async () => {
    try {
      const r = await fetch(${JSON.stringify(it.imageUrl)}, { credentials: "include" });
      if (!r.ok) return JSON.stringify({ ok: false, status: r.status });
      const b = await r.arrayBuffer();
      let s = "";
      const u = new Uint8Array(b);
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return JSON.stringify({ ok: true, b64: btoa(s) });
    } catch (e) { return JSON.stringify({ ok: false, error: String(e).slice(0, 120) }); }
  })()`;
  let saved = false;
  try {
    const { result } = await sendCmd(ws, "Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId, 90000);
    const d = JSON.parse(result.value);
    if (d.ok) {
      const buf = Buffer.from(d.b64, "base64");
      if (buf.length > 3000 && MAGIC_OK(buf.subarray(0, 4))) {
        writeFileSync(outPath, buf);
        ok++;
        saved = true;
        console.log(`  [${idx + 1}/${items.length}] ${it.slug}: ${(buf.length / 1024).toFixed(0)}KB`);
      }
    }
  } catch (e) { /* fallthrough */ }
  if (!saved) { fail++; console.log(`  [${idx + 1}/${items.length}] ${it.slug}: FAILED`); }
  await sleep(700);
}
console.log(`DONE ok=${ok} skip=${skip} fail=${fail}`);
chrome.kill();
process.exit(fail > 0 ? 2 : 0);
