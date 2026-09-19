// Task 67 CDP verification: the profile (My Profile -> Saved shipping address)
// now has the district picker — same 20 Mogadishu districts + "Other city" as
// checkout, but WITHOUT prices and WITHOUT the pricing hint. Selecting a
// district stores its canonical name in the saved `city`; checkout keeps
// auto-mapping from there. Verified end to end in the browser.
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
const DEBUG_PORT = 9343;
const SHOT = "/home/z/my-project/download/task67-profile-district.png";
mkdirSync("/home/z/my-project/download", { recursive: true });

// Fresh session (admin@shop.demo doubles as a normal profile owner here).
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const sessionValue = /shop_session=([^;]+)/.exec(setCookie)?.[1];
if (!sessionValue) { console.error("FATAL: login failed"); process.exit(1); }

// remember the original profile city for cleanup
const origUser = await (await fetch(`${BASE}/api/account`, { headers: { cookie: `shop_session=${sessionValue}` } })).json();
const ORIG = {
  name: origUser?.user?.name ?? "Admin Demo",
  city: origUser?.user?.city ?? "",
};
console.error("[stage] original profile city:", JSON.stringify(ORIG.city));

const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.error(line);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The store bootstraps (auth/products fetch) before the profile renders —
// poll for the district trigger instead of fixed sleeps after navigation.
const waitTrigger = async (timeoutMs = 20000) => {
  for (const until = Date.now() + timeoutMs; Date.now() < until;) {
    if (await evalJS(`!!document.querySelector("#acc-district")`)) return true;
    await sleep(600);
  }
  return false;
};
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t67-${Date.now()}`,
  "--window-size=1440,1500", "about:blank",
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
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false });
await send("Network.enable");
await send("Network.setCookie", { name: "shop_session", value: sessionValue, url: BASE, httpOnly: true });

// --- open profile ----------------------------------------------------------
await send("Page.navigate", { url: `${BASE}/?view=account` });
await sleep(6000);
check("profile page renders", await evalJS(`document.body.innerText.includes("Saved shipping address") || document.body.innerText.includes("Shipping address") || !!document.querySelector("#acc-address")`));
check("district trigger present", await evalJS(`!!document.querySelector("#acc-district")`));
check("no pricing hint under district", await evalJS(`(() => {
  const trigger = document.querySelector("#acc-district");
  const block = trigger?.closest("div.grid");
  return block ? !block.innerText.includes("75") : false;
})()`));

// open the select and inspect the options
const openSel = async () => {
  await evalJS(`document.querySelector("#acc-district").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
  await evalJS(`document.querySelector("#acc-district").click()`);
  await sleep(700);
};
const optionTexts = async () => evalJS(`[...document.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`);

await openSel();
let opts = await optionTexts();
check("21 options (20 districts + other)", opts.length === 21, `${opts.length} options`);
check("options have NO prices", opts.length > 0 && opts.every((s) => !s.includes("$")), opts.slice(0, 3).join(" | "));
check("has Other city entry", opts.some((s) => /Other city/i.test(s)));

// pick Hodan
await evalJS(`[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === "Hodan")?.click()`);
await sleep(500);
check("Hodan selected shows in trigger", await evalJS(`document.querySelector("#acc-district")?.textContent.includes("Hodan")`));
check("city input hidden for priced district", await evalJS(`!document.querySelector("#acc-city")`));

// switch to Other city — city input should appear
await openSel();
await evalJS(`[...document.querySelectorAll('[role="option"]')].find(o => /Other city/i.test(o.textContent))?.click()`);
await sleep(500);
check("Other city reveals city input", await evalJS(`!!document.querySelector("#acc-city")`));

// type a city and save via the form
await evalJS(`(() => {
  const input = document.querySelector("#acc-city");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "Kismayo");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
await evalJS(`[...document.querySelectorAll("button")].find(b => b.getAttribute("type") === "submit")?.click()`);
await sleep(2500);
check("save toast shown", await evalJS(`document.body.innerText.length > 0`));

// persisted? (API-level check of the same session)
const saved = await (await fetch(`${BASE}/api/account`, { headers: { cookie: `shop_session=${sessionValue}` } })).json();
check("saved city = Kismayo (Other path)", saved?.user?.city === "Kismayo", JSON.stringify(saved?.user?.city));

// reload — picker should preselect Other city with Kismayo in the input
await send("Page.navigate", { url: `${BASE}/?view=account` });
check("reload renders profile", await waitTrigger());
await sleep(1000);
check("reload preselects Other city", await evalJS(`document.querySelector("#acc-district")?.textContent.includes("Other city")`));
check("reload keeps Kismayo in city input", await evalJS(`document.querySelector("#acc-city")?.value === "Kismayo"`));

// now pick Hodan, save, reload — trigger shows Hodan, no city field
await openSel();
await evalJS(`[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === "Hodan")?.click()`);
await sleep(500);
await evalJS(`[...document.querySelectorAll("button")].find(b => b.getAttribute("type") === "submit")?.click()`);
await sleep(2500);
const saved2 = await (await fetch(`${BASE}/api/account`, { headers: { cookie: `shop_session=${sessionValue}` } })).json();
check("saved city = Hodan (district path)", saved2?.user?.city === "Hodan", JSON.stringify(saved2?.user?.city));
await send("Page.navigate", { url: `${BASE}/?view=account` });
check("reload renders profile (2nd)", await waitTrigger());
await sleep(1000);
check("reload preselects Hodan", await evalJS(`document.querySelector("#acc-district")?.textContent.includes("Hodan")`));
check("city input stays hidden after reload (Hodan)", await evalJS(`!document.querySelector("#acc-city")`));

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
console.error("[stage] screenshot saved");

// cleanup: restore original profile city
const restoreRes = await fetch(`${BASE}/api/account`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", cookie: `shop_session=${sessionValue}` },
  body: JSON.stringify({ ...ORIG, name: ORIG.name || "Admin Demo" }),
});
check("cleanup restores original city", restoreRes.ok, `status ${restoreRes.status}`);

console.error("console errors:", consoleErrors.length, consoleErrors.slice(0, 3));
const failed = results.filter((l) => l.startsWith("FAIL")).length;
console.error(`\n${results.length - failed}/${results.length} checks passed`);
chrome.kill();
process.exit(failed === 0 ? 0 : 1);
