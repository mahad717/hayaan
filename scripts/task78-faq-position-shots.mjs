// Task 78 evidence — FAQ repositioned from footer into homepage content flow.
// Lesson learned on this chrome build: main-thread CDP commands
// (Runtime.evaluate / DOM.getDocument) hang while the SPA homepage hydrates.
// Solution: settle 20s after the load event, then evaluate instantly.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const DEBUG_PORT = 9383;
const CHROME = "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome";
const OUT = "/home/z/my-project/download";
const VW = 1440, VH = 900;

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws connect timeout")); }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("ws error")); };
  });
}
let msgId = 0;
function sendCmd(ws, method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 90000);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}
async function evalJs(ws, sessionId, expression) {
  const { result, exceptionDetails } = await sendCmd(ws, "Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
}
async function scrollShot(ws, sessionId, path, scrollY) {
  await evalJs(ws, sessionId, `window.scrollTo(0, ${Math.max(0, scrollY)}); window.scrollY`);
  await sleep(1000);
  // plain compositor screenshot of the current viewport — proven reliable
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const { data } = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
      writeFileSync(path, Buffer.from(data, "base64"));
      console.log("saved", path);
      return;
    } catch (e) {
      console.log(`shot attempt ${attempt} failed: ${String(e).slice(0, 80)}`);
      await sleep(1500);
    }
  }
  throw new Error("captureScreenshot kept failing: " + path);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${DEBUG_PORT}`, `--window-size=${VW},${VH}`,
  "--user-data-dir=/tmp/task78-chrome-d", "about:blank",
], { stdio: "ignore" });
try {
  for (let i = 0; i < 30; i++) {
    try { await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`); break; } catch { await sleep(500); }
  }
  const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
  const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
  const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
  await sendCmd(ws, "Page.enable", {}, sessionId);
  await sendCmd(ws, "Runtime.enable", {}, sessionId);

  const waitLoad = () => new Promise((res) => {
    const onMsg = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
    ws.addEventListener("message", onMsg);
  });
  const nav = async (url) => {
    const loadP = waitLoad();
    await sendCmd(ws, "Page.navigate", { url }, sessionId);
    await Promise.race([loadP, sleep(30000)]);
    await sleep(20000); // let hydration settle — main-thread CDP hangs before this
  };

  console.log("step: homepage");
  await nav(`https://hayaan.co/?cb=${Date.now()}`);
  const pos = JSON.parse(await evalJs(ws, sessionId, `(() => {
    // dismiss the newsletter popup so it doesn't cover the evidence
    const btn = [...document.querySelectorAll("button")].find((b) => /no thanks/i.test(b.textContent || ""));
    if (btn) btn.click();
    return JSON.stringify({
    faqTop: Math.round(document.getElementById("faq-heading").getBoundingClientRect().top + window.scrollY),
    faqInMain: !!document.getElementById("faq-heading").closest("main"),
    faqInFooter: !!document.getElementById("faq-heading").closest("footer"),
    footerTop: Math.round(document.querySelector("footer").getBoundingClientRect().top + window.scrollY),
    footerH: Math.round(document.querySelector("footer").getBoundingClientRect().height),
    });
  })()`));
  console.log("homepage layout:", JSON.stringify(pos));
  // Shot 1: FAQ section with the footer starting right below it.
  await scrollShot(ws, sessionId, `${OUT}/task78-homepage-faq-in-content.png`, pos.faqTop - 60);
  // Shot 2: the footer region (clean columns, no FAQ inside).
  await scrollShot(ws, sessionId, `${OUT}/task78-homepage-footer-clean.png`, pos.footerTop + pos.footerH - VH + 10);

  console.log("step: category page (JS-disabled target — SSR only, no hydration)");
  // Category hydration pegs the main thread even longer than the homepage;
  // JS-disabled rendering avoids it entirely. The page is fully
  // server-rendered, so this shows the exact production layout.
  const { targetId: t2 } = await sendCmd(ws, "Target.createTarget", { url: "about:blank", javascriptEnabled: false });
  const { sessionId: s2 } = await sendCmd(ws, "Target.attachToTarget", { targetId: t2, flatten: true });
  await sendCmd(ws, "Page.enable", {}, s2);
  await sendCmd(ws, "Runtime.enable", {}, s2);
  const loadP2 = new Promise((res) => {
    const onMsg = (ev) => { const m = JSON.parse(ev.data); if (m.sessionId === s2 && m.method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
    ws.addEventListener("message", onMsg);
  });
  await sendCmd(ws, "Page.navigate", { url: `https://hayaan.co/category/computers-tv-gaming?cb=${Date.now()}` }, s2);
  await Promise.race([loadP2, sleep(30000)]);
  await sleep(4000);
  const pos2 = JSON.parse(await evalJs(ws, s2, `JSON.stringify({
    footerTop: Math.round(document.querySelector("footer").getBoundingClientRect().top + window.scrollY),
    footerH: Math.round(document.querySelector("footer").getBoundingClientRect().height),
    pageH: document.body.scrollHeight,
  })`));
  console.log("category layout:", JSON.stringify(pos2));
  await scrollShot(ws, s2, `${OUT}/task78-category-footer-clean.png`, pos2.footerTop + pos2.footerH - VH + 10);
  await sendCmd(ws, "Target.closeTarget", { targetId: t2 }).catch(() => {});
  console.log("done");
} finally {
  chrome.kill("SIGKILL");
}
