// Task 70 REPRO: owner selects existing multi-line description text in the
// admin Edit dialog and clicks "Bullet list" -> reported "not working".
// Task 69's CDP test only clicked Bullet on an EMPTY paragraph, so the
// "convert existing blocks to list" path was never exercised.
//
// This script reproduces the owner flow with REAL input events:
//   - seed two probe products via POST /api/products with the two shapes the
//     owner's description plausibly had:
//       A: one <p> with <br>-separated feature lines (matches live stored HTML)
//       B: separate <p> blocks per feature (matches the screenshot gaps)
//   - open Edit dialog, monkeypatch document.execCommand to capture return
//     values, REAL mouse-drag over the feature lines, REAL click on Bullet.
//   - dump execCommand log + resulting DOM (ul parentage, li count, computed
//     list style) + screenshots. Cleanup deletes the probes.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome",
  "/home/z/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome binary"); process.exit(1); }

const BASE = "http://localhost:3000";
const DEBUG_PORT = 9349;
mkdirSync("/home/z/my-project/download", { recursive: true });

const sessionValue = await (async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
  });
  return /shop_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
})();
if (!sessionValue) { console.error("FATAL: login failed"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expr, timeoutMs = 25000, everyMs = 600) => {
  for (const until = Date.now() + timeoutMs; Date.now() < until;) {
    try { if (await evalJS(expr)) return true; } catch {}
    await sleep(everyMs);
  }
  return false;
};

// --- probe description shapes -------------------------------------------------
const feature = (b) =>
  `<b>${b} →</b> so what that means is the formula supports that part of your daily routine and therefore you can keep nutrition simple.`;
const FEATURES = ["Vitamins A, B12, C & D", "B-vitamins + minerals", "Antioxidants", "Men's daily formula", "Non-GMO formula"];

const shapeAHtml =
  `<p><b>Men's Daily Multivitamin — Daily Energy & Essential Nutrition</b></p>` +
  `<p>Give your body the daily nutritional support it needs to keep up with your day.</p>` +
  `<p>${feature(FEATURES[0])}<br>${FEATURES.slice(1).map(feature).join("<br>")}</p>`;

const shapeBHtml =
  `<p><b>Men's Daily Multivitamin — Daily Energy & Essential Nutrition</b></p>` +
  `<p>Give your body the daily nutritional support it needs to keep up with your day.</p>` +
  FEATURES.map((f) => `<p>${feature(f)}</p>`).join("");

const PROBES = [
  { name: "BRPROBE-A br-lines", desc: shapeAHtml, key: "B-vitamins", last: "Non-GMO" },
  { name: "BRPROBE-B paragraphs", desc: shapeBHtml, key: "B-vitamins", last: "Non-GMO" },
];

// --- create probes via the real (sanitizing) API ------------------------------
const cats = await (await fetch(`${BASE}/api/categories`)).json();
const categoryId = (cats.categories ?? cats)[0]?.id;
if (!categoryId) { console.error("FATAL: no categories"); process.exit(1); }
const created = [];
for (const p of PROBES) {
  const res = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `shop_session=${sessionValue}` },
    body: JSON.stringify({ name: p.name, description: p.desc, price: 9.99, categoryId, images: [] }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.product?.id) created.push({ ...p, id: body.product.id, slug: body.product.slug });
  else console.error(`WARN: create failed for ${p.name}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
}
if (created.length === 0) { console.error("FATAL: no probes created"); process.exit(1); }

// --- CDP plumbing --------------------------------------------------------------
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t70-${Date.now()}`,
  "--window-size=1440,1700", "about:blank",
], { stdio: "ignore" });

let versionInfo = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { versionInfo = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {}
}
if (!versionInfo) { console.error("FATAL: devtools never came up"); chrome.kill(); process.exit(1); }

function connectWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("ws timeout")); }, timeoutMs);
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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 45000);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { clearTimeout(t); ws.removeEventListener("message", onMsg); msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify(payload));
  });
}
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);
const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => sendCmd(ws, m, p, sessionId);
const consoleErrors = [];
const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.error(line);
};
await send("Page.enable");
await send("Runtime.enable");
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params?.exceptionDetails?.text ?? "exception");
});
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1700, deviceScaleFactor: 1, mobile: false });
await send("Network.enable");
await send("Network.setCookie", { name: "shop_session", value: sessionValue, url: BASE, httpOnly: true });
const saveShot = async (path) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
};

// Real input helpers -----------------------------------------------------------
const mouse = (type, x, y, opts = {}) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: opts.clickCount ?? 1, ...opts });
const realClick = async (x, y) => {
  await mouse("mouseMoved", x, y);
  await mouse("mousePressed", x, y);
  await sleep(60);
  await mouse("mouseReleased", x, y);
};
const realDrag = async (x1, y1, x2, y2) => {
  await mouse("mouseMoved", x1, y1);
  await mouse("mousePressed", x1, y1);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await mouse("mouseMoved", Math.round(x1 + ((x2 - x1) * i) / steps), Math.round(y1 + ((y2 - y1) * i) / steps));
    await sleep(20);
  }
  await sleep(80);
  await mouse("mouseReleased", x2, y2);
};

// --- run the flow per probe -----------------------------------------------------
await send("Page.navigate", { url: `${BASE}/admin` });
await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.includes("New product"))`);

const openEdit = async (name) => {
  for (let i = 0; i < 8; i++) {
    const clicked = await evalJS(`(() => {
      const cell = [...document.querySelectorAll("*")].find(el => el.children.length === 0 && el.textContent.trim() === ${JSON.stringify(name)});
      if (!cell) return false;
      const container = cell.closest("tr") || cell.closest("[role='row']") || cell.parentElement?.parentElement;
      const btn = container && [...container.querySelectorAll("button")].find(b => b.querySelector(".lucide-pencil"));
      if (btn) { btn.click(); return true; }
      return false;
    })()`).catch(() => false);
    if (clicked && (await waitFor(`!!document.querySelector("#p-desc") && !!document.querySelector('[role="toolbar"] button[aria-label="Bullet list"]')`, 2500, 300))) return true;
    await sleep(800);
  }
  return false;
};

const patchExecLog = () => evalJS(`(() => {
  window.__ecLog = [];
  const orig = document.execCommand.bind(document);
  document.execCommand = function(name, ui, val) {
    const sel = window.getSelection();
    const root = document.querySelector("#p-desc");
    const before = sel && sel.rangeCount ? {
      ranges: sel.rangeCount,
      text: String(sel).slice(0, 50),
      anchorInEditor: !!(root && sel.anchorNode && root.contains(sel.anchorNode)),
    } : null;
    const r = orig(name, ui, val);
    window.__ecLog.push({ name, ret: r, before });
    return r;
  };
  return true;
})()`);

const dump = async () => evalJS(`(() => {
  const root = document.querySelector("#p-desc");
  if (!root) return null;
  const lists = [...root.querySelectorAll("ul,ol")];
  const sel = window.getSelection();
  return {
    ecLog: window.__ecLog ?? null,
    html: root.innerHTML,
    listCount: lists.length,
    lists: lists.map(u => ({
      tag: u.tagName,
      parentTag: u.parentElement?.tagName ?? null,
      insideP: !!u.closest("p"),
      liCount: u.querySelectorAll(":scope > li").length,
      listStyleType: getComputedStyle(u).listStyleType,
      paddingLeft: getComputedStyle(u).paddingLeft,
      firstLiText: (u.querySelector(":scope > li")?.textContent ?? "").slice(0, 40),
    })),
    selectionAfter: sel && sel.rangeCount ? String(sel).slice(0, 50) : "",
  };
})()`);

for (const probe of created) {
  console.error(`\n=== PROBE ${probe.name} ===`);
  if (!(await openEdit(probe.name))) { console.error("FAIL — could not open edit dialog"); continue; }
  await patchExecLog();

  // Prefill sanity + scroll editor into view
  const prefill = await evalJS(`document.querySelector("#p-desc").innerHTML.slice(0, 160)`);
  console.error(`prefill: ${prefill}`);
  await evalJS(`(() => {
    const root = document.querySelector("#p-desc");
    root.scrollIntoView({ block: "center" });
    const b = [...root.querySelectorAll("b")].find(x => x.textContent.includes(${JSON.stringify(probe.key)}));
    b && b.scrollIntoView({ block: "center" });
    return true;
  })()`);
  await sleep(400);

  // Measure real viewport coordinates: start of ${probe.key} line -> end of ${probe.last} line
  const coords = await evalJS(`(() => {
    const root = document.querySelector("#p-desc");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let startPt = null, endPt = null;
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.textContent;
      const si = t.indexOf(${JSON.stringify(probe.key)});
      if (si !== -1 && !startPt) {
        const r = document.createRange(); r.setStart(n, si); r.setEnd(n, si + 1);
        const rect = r.getBoundingClientRect();
        startPt = { x: rect.left + 2, y: rect.top + rect.height / 2 };
      }
      const li = t.lastIndexOf(${JSON.stringify(probe.last)});
      if (li !== -1 && t.indexOf("→", li) !== -1) {
        const r = document.createRange(); r.setStart(n, li); r.setEnd(n, t.indexOf("→", li) + 1);
        const rect = r.getBoundingClientRect();
        endPt = { x: rect.right - 2, y: rect.top + rect.height / 2 };
      }
    }
    return { startPt, endPt };
  })()`);
  console.error(`drag coords: ${JSON.stringify(coords)}`);
  if (!coords.startPt || !coords.endPt) { console.error("FAIL — could not locate drag endpoints"); continue; }

  await saveShot(`/home/z/my-project/download/task70-repro-${probe.name.startsWith("BRPROBE-A") ? "shapeA" : "shapeB"}-before.png`);
  await realDrag(coords.startPt.x, coords.startPt.y, coords.endPt.x, coords.endPt.y);
  await sleep(250);

  const selNow = await evalJS(`(() => { const s = getSelection(); return { text: String(s).slice(0, 80), ranges: s.rangeCount }; })()`);
  console.error(`selection after drag: ${JSON.stringify(selNow)}`);

  // REAL click on the Bullet list button
  const btn = await evalJS(`(() => {
    const b = document.querySelector('[role="toolbar"] button[aria-label="Bullet list"]');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await realClick(Math.round(btn.x), Math.round(btn.y));
  await sleep(350);

  const result = await dump();
  console.error(JSON.stringify(result, null, 1).slice(0, 2600));
  await saveShot(`/home/z/my-project/download/task70-repro-${probe.name.startsWith("BRPROBE-A") ? "shapeA" : "shapeB"}-after.png`);

  // Task 70 assertions: ONE clean top-level list, no p-wrapping, no fragmentation
  const shape = probe.name.startsWith("BRPROBE-A") ? "shapeA" : "shapeB";
  check(`${shape}: list created`, result.listCount === 1, `count=${result.listCount}`);
  check(`${shape}: list is top-level (NOT inside <p>)`, result.listCount === 1 && result.lists[0].parentTag === "DIV" && !result.lists[0].insideP, JSON.stringify(result.lists[0] ?? {}));
  check(`${shape}: all selected lines became items`, result.listCount === 1 && result.lists[0].liCount >= 4, `li=${result.lists[0]?.liCount}`);
  check(`${shape}: first selected line converted too`, result.listCount === 1 && ((result.lists[0].firstLiText ?? "").includes("B-vitamins") || (result.lists[0].firstLiText ?? "").includes("Vitamins A")), `first=${(result.lists[0]?.firstLiText ?? "").slice(0, 40)}`);
  check(`${shape}: bullet marker styled`, result.listCount === 1 && result.lists[0].listStyleType === "disc");
  check(`${shape}: no execCommand used for lists`, (result.ecLog ?? []).length === 0, JSON.stringify(result.ecLog));

  // also try Numbered list on the same selection for completeness (Shape A only)
  if (probe.name.startsWith("BRPROBE-A")) {
    const ol = await evalJS(`(() => {
      const b = document.querySelector('[role="toolbar"] button[aria-label="Numbered list"]');
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await realClick(Math.round(ol.x), Math.round(ol.y));
    await sleep(350);
    const r2 = await dump();
    console.error("after Numbered click:", JSON.stringify({ listCount: r2.listCount, lists: r2.lists, ecLog: r2.ecLog }, null, 1).slice(0, 1600));
    await saveShot("/home/z/my-project/download/task70-repro-shapeA-after-ol.png");
    check("shapeA: numbered switch keeps ONE list (no fragmentation)", r2.listCount === 1 && r2.lists[0].tag === "OL" && r2.lists[0].liCount >= 4, JSON.stringify(r2.lists[0] ?? {}));
    check("shapeA: switched list stays top-level", r2.listCount === 1 && r2.lists[0].parentTag === "DIV");
    // toggle back to bullets, then OFF (unwrap)
    const bl = await evalJS(`(() => {
      const b = document.querySelector('[role="toolbar"] button[aria-label="Bullet list"]');
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await realClick(Math.round(bl.x), Math.round(bl.y));
    await sleep(300);
    const r3 = await dump();
    check("shapeA: ol -> ul switch stays single top-level list", r3.listCount === 1 && r3.lists[0].tag === "UL" && r3.lists[0].parentTag === "DIV", JSON.stringify(r3.lists[0] ?? {}));
    await realClick(Math.round(bl.x), Math.round(bl.y));
    await sleep(300);
    const r4 = await dump();
    check("shapeA: second bullet click unwraps list back to paragraphs", r4.listCount === 0 && !/<ul|<ol/.test(r4.html), r4.html.slice(0, 120));
    check("shapeA: text survives toggle round-trip", r4.html.includes("B-vitamins") && r4.html.includes("Non-GMO"));
  }

  // Close dialog (Cancel) before next probe
  await evalJS(`[...document.querySelectorAll("[role='dialog'] button")].find(b => b.textContent.trim() === "Cancel")?.click()`);
  await sleep(500);
}

console.error(`\nconsole exceptions: ${consoleErrors.length}`);
check("0 console exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.error(`\n${results.length - fails}/${results.length} checks passed`);
chrome.kill();

// --- cleanup probes --------------------------------------------------------------
for (const p of created) {
  const del = await fetch(`${BASE}/api/products/${p.id}`, { method: "DELETE", headers: { cookie: `shop_session=${sessionValue}` } });
  console.error(`cleanup ${p.name}: ${del.status}`);
}
process.exit(fails ? 1 : 0);
