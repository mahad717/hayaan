// Task 69 CDP verification: WYSIWYG description editor in the admin form.
// Browser flow (dev server, Prisma mode, admin@shop.demo):
//  1. /admin -> New product -> fill name/price (native value setters).
//  2. In the rich editor: insertText intro + insertParagraph, REAL clicks on
//     the "Bullet list" and "Bold" toolbar buttons around inserted items.
//  3. Assert editor HTML carries <ul>/<li>/<b>; screenshot the dialog.
//  4. Create -> open the PDP -> assert rendered bold + 3 bullets; screenshot.
//  5. Reopen Edit on the product -> editor prefills with the formatted HTML.
//  6. Cleanup (delete probe product). 0 console exceptions expected.
// Note: physical key-event simulation is flaky in headless CDP (Enter
// swallowed) — editor typing uses execCommand insertText/insertParagraph,
// which fire the same input events React listens to. Toolbar actions stay
// real UI clicks.
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
const DEBUG_PORT = 9347;
const NAME = "Vitamin C 1000mg Formatting Demo";
mkdirSync("/home/z/my-project/download", { recursive: true });

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const sessionValue = /shop_session=([^;]+)/.exec(setCookie)?.[1];
if (!sessionValue) { console.error("FATAL: login failed"); process.exit(1); }

const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.error(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expr, timeoutMs = 25000, everyMs = 600) => {
  for (const until = Date.now() + timeoutMs; Date.now() < until;) {
    try { if (await evalJS(expr)) return true; } catch {}
    await sleep(everyMs);
  }
  return false;
};

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t69-${Date.now()}`,
  "--window-size=1440,1600", "about:blank",
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
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
await send("Network.enable");
await send("Network.setCookie", { name: "shop_session", value: sessionValue, url: BASE, httpOnly: true });
const saveShot = async (path) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
};
const clickToolbar = async (label) => {
  await evalJS(`(() => {
    const btn = document.querySelector('[role="toolbar"] button[aria-label="${label}"]');
    btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    btn.click();
  })()`);
  await sleep(250);
};
// React-controlled inputs: set via native setter + input event.
const fillInput = (sel, text) => evalJS(`(() => {
  const el = document.querySelector("${sel}");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, "${text}");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el.value;
})()`);
const insertText = (text) => evalJS(`document.execCommand("insertText", false, ${JSON.stringify(text)})`);
const insertParagraph = () => evalJS(`document.execCommand("insertParagraph")`);

// --- 1. open the Create dialog ----------------------------------------------
await send("Page.navigate", { url: `${BASE}/admin` });
check("admin renders", await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.includes("New product"))`));
// openCreate pre-selects categories[0] at open time; the categories fetch is
// async client-side, so give it a beat or the save validation blocks (flaky
// race seen in Task 70 — toast expires before the failure is observable).
await sleep(2000);
let dialogOpen = false;
for (let i = 0; i < 15 && !dialogOpen; i++) {
  await evalJS(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("New product"))?.click()`).catch(() => {});
  // dialog is only usable once the category select carries a real value
  dialogOpen = await waitFor(`!!document.querySelector("#p-name") && document.querySelector("#p-cat")?.textContent?.trim() && document.querySelector("#p-cat")?.textContent?.trim() !== "Pick a category…"`, 3000, 400);
  if (!dialogOpen) {
    // close the half-initialized dialog and retry
    await evalJS(`[...document.querySelectorAll("[role='dialog'] button")].find(b => b.textContent.trim() === "Cancel")?.click()`).catch(() => {});
    await sleep(1200);
  }
}
check("create dialog opens (category preselected)", dialogOpen);

// fill name + price
check("name field set", (await fillInput("#p-name", NAME)) === NAME);
check("price field set", (await fillInput("#p-price", "9.99")) === "9.99");

// --- 2. drive the rich editor ------------------------------------------------
await evalJS(`document.querySelector("#p-desc").focus()`);
await insertText("Daily immune support in one tablet.");
await insertParagraph();
await clickToolbar("Bullet list");
await insertText("Vitamin C 1000mg per tablet");
await insertParagraph();
await insertText("Non-GMO formula");
await insertParagraph();
await insertText("60 tablets per bottle");
await evalJS(`document.execCommand("selectAll")`);
await clickToolbar("Bold (Ctrl+B)");
await sleep(300);

const editorHtml = await evalJS(`document.querySelector("#p-desc").innerHTML`);
check("editor HTML has bullet list", /<ul>/.test(editorHtml) && (editorHtml.match(/<li>/g) ?? []).length >= 3, editorHtml.slice(0, 130));
check("editor HTML has bold", /<(b|strong)>/.test(editorHtml));
check("editor keeps all item texts", ["Daily immune support", "Vitamin C 1000mg per tablet", "Non-GMO formula", "60 tablets per bottle"].every((s) => editorHtml.includes(s)));
await saveShot("/home/z/my-project/download/task69-editor-toolbar.png");

// --- 3. create and open the PDP ----------------------------------------------
await evalJS(`[...document.querySelectorAll("[role='dialog'] button")].find(b => b.textContent.trim() === "Create product")?.click()`);
const closed = await waitFor(`!document.querySelector("#p-desc")`, 15000);
if (!closed) {
  const toast = await evalJS(`document.querySelector("[data-sonner-toast]")?.textContent ?? ""`).catch(() => "");
  const priceVal = await evalJS(`document.querySelector("#p-price")?.value ?? "?"`).catch(() => "?");
  const nameVal = await evalJS(`document.querySelector("#p-name")?.value ?? "?"`).catch(() => "?");
  check("dialog closes after create", false, `toast="${toast}" price="${priceVal}" name="${nameVal}"`);
} else {
  check("dialog closes after create", true);
}

let slug = "";
for (let i = 0; i < 10 && !slug; i++) {
  const res = await fetch(`${BASE}/api/products`);
  const data = await res.json();
  const found = (data.products ?? []).find((p) => p.name === NAME);
  if (found) slug = found.slug;
  else await sleep(800);
}
check("probe product created", !!slug, slug);

if (slug) {
  await send("Page.navigate", { url: `${BASE}/product/${slug}` });
  check("PDP rich description renders", await waitFor(`!!document.querySelector(".rich-description")`));
  check("PDP shows bold text", await evalJS(`(() => {
    const el = document.querySelector(".rich-description b, .rich-description strong");
    return el ? Number(getComputedStyle(el).fontWeight) >= 600 : false;
  })()`));
  check("PDP shows 3 bullet items", await evalJS(`document.querySelectorAll(".rich-description ul li").length === 3`));
  check("PDP bullets have visible markers", await evalJS(`(() => {
    const ul = document.querySelector(".rich-description ul");
    return ul ? getComputedStyle(ul).listStyleType === "disc" : false;
  })()`));
  await saveShot("/home/z/my-project/download/task69-pdp-rich.png");

  // --- 4. reopen Edit: formatted HTML prefills the editor --------------------
  await send("Page.navigate", { url: `${BASE}/admin` });
  await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.includes("New product"))`);
  for (let i = 0; i < 8; i++) {
    const clicked = await evalJS(`(() => {
      const cell = [...document.querySelectorAll("*")].find(el => el.children.length === 0 && el.textContent.trim() === "${NAME}");
      if (!cell) return false;
      const container = cell.closest("tr") || cell.closest("[role='row']") || cell.parentElement?.parentElement;
      const btn = container && [...container.querySelectorAll("button")].find(b => b.querySelector(".lucide-pencil"));
      if (btn) { btn.click(); return true; }
      return false;
    })()`).catch(() => false);
    if (clicked && await waitFor(`!!document.querySelector("#p-desc")`, 2500, 300)) break;
    await sleep(800);
  }
  check("edit dialog opens for probe product", await evalJS(`!!document.querySelector("#p-desc")`));
  const prefillHtml = await evalJS(`document.querySelector("#p-desc")?.innerHTML ?? ""`);
  check("edit editor prefilled with formatted HTML", /<ul>/.test(prefillHtml) && /<(b|strong)>/.test(prefillHtml), prefillHtml.slice(0, 110));
  await saveShot("/home/z/my-project/download/task69-edit-prefill.png");
}

check("0 console exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

// --- 5. cleanup ---------------------------------------------------------------
if (slug) {
  const list = await (await fetch(`${BASE}/api/products`)).json();
  const probe = (list.products ?? []).find((p) => p.name === NAME);
  if (probe) {
    const del = await fetch(`${BASE}/api/products/${probe.id}`, { method: "DELETE", headers: { cookie: `shop_session=${sessionValue}` } });
    check("cleanup delete probe product", del.status === 200 || del.status === 204, `status ${del.status}`);
  }
}

const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.error(`\n${results.length - fails}/${results.length} checks passed`);
chrome.kill();
process.exit(fails ? 1 : 0);
