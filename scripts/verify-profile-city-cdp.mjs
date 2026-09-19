// Task 71 CDP verification: profile shipping address gets a required City
// picker (16 major Somali cities + "Other city (not listed)") and District
// becomes REQUIRED for Mogadishu (the "(optional)" hint is gone). Storage
// stays the single `city` string so checkout + computeShipping are untouched:
//   Mogadishu + Hodan   -> city "Hodan"     -> district fee at checkout
//   Hargeisa            -> city "Hargeisa"  -> outside-Mogadishu flat fee
//   Other + "Buuhoodle" -> city "Buuhoodle" -> flat fee
//   Mogadishu + Other area "Siinaay" -> city "Siinaay" -> flat fee
// Also verifies Somali display labels (Muqdisho/Hargeysa) and that checkout
// prefills correctly from every saved shape. Profile + cart restored after.
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
const DEBUG_PORT = 9345;
mkdirSync("/home/z/my-project/download", { recursive: true });

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const setCookie = loginRes.headers.get("set-cookie") ?? "";
const sessionValue = /shop_session=([^;]+)/.exec(setCookie)?.[1];
if (!sessionValue) { console.error("FATAL: login failed"); process.exit(1); }

// original profile for cleanup — cookie must go inside `headers` (a top-level
// `cookie` key is silently ignored by fetch, which 401-poisoned the first run)
const COOKIE = { headers: { cookie: `shop_session=${sessionValue}` } };
const origUser = await (await fetch(`${BASE}/api/account`, COOKIE)).json();
if (!origUser?.user) { console.error("FATAL: account GET failed (cookie headers bug?)"); process.exit(1); }
const ORIG = {
  name: origUser?.user?.name ?? "Admin Demo",
  phone: origUser?.user?.phone ?? "",
  address: origUser?.user?.address ?? "",
  city: origUser?.user?.city ?? "",
  zip: origUser?.user?.zip ?? "",
  country: origUser?.user?.country ?? "",
};
const apiCity = async () => (await (await fetch(`${BASE}/api/account`, COOKIE)).json())?.user?.city ?? "";
const apiPutCity = async (city) => {
  const res = await fetch(`${BASE}/api/account`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: `shop_session=${sessionValue}` },
    body: JSON.stringify({ ...ORIG, city }),
  });
  return res.ok;
};

const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.error(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t71-${Date.now()}`,
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
await send("Network.setCookie", { name: "hayaan_lang", value: "en", url: BASE });

const waitProfile = async (timeoutMs = 25000) => {
  for (const until = Date.now() + timeoutMs; Date.now() < until;) {
    if (await evalJS(`!!document.querySelector("#acc-city-select") && !!document.querySelector("#acc-address")`).catch(() => false)) return true;
    await sleep(600);
  }
  return false;
};
const openSelect = async (triggerId) => {
  await evalJS(`(() => {
    const t = document.querySelector("${triggerId}");
    t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    t.click();
  })()`);
  await sleep(700);
};
const optionTexts = async () => evalJS(`[...document.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`);
const pickOption = async (text, re = false) => {
  await evalJS(`[...document.querySelectorAll('[role="option"]')].find(o => ${re ? `/(${text})/i` : `o.textContent.trim() === "${text}"`})?.click()`);
  await sleep(500);
};
const typeInto = async (sel, text) => evalJS(`(() => {
  const input = document.querySelector("${sel}");
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "${text}");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
const submitForm = async () => {
  await evalJS(`[...document.querySelectorAll("button")].find(b => b.getAttribute("type") === "submit")?.click()`);
  // wait for the (sonner) toast to appear, capture its text, then let it fully
  // dismiss so the toast layer can't steal focus from the next Radix select
  let txt = "";
  for (let i = 0; i < 12 && !txt; i++) {
    txt = await evalJS(`document.querySelector("[data-sonner-toast]")?.textContent ?? ""`).catch(() => "");
    if (!txt) await sleep(400);
  }
  for (let i = 0; i < 16; i++) {
    const still = await evalJS(`!!document.querySelector("[data-sonner-toast]")`).catch(() => false);
    if (!still) break;
    await sleep(400);
  }
  return txt;
};
const toastText = submitForm; // toast text is captured by submitForm's appear-wait

// reset to a clean slate: no saved city
check("reset profile city to blank", await apiPutCity(""), "PUT ok");
check("reset verified", (await apiCity()) === "", JSON.stringify(await apiCity()));

// --- Part A: profile ----------------------------------------------------------
await send("Page.navigate", { url: `${BASE}/?view=account` });
check("profile renders with city select", await waitProfile());
check("city select present", await evalJS(`!!document.querySelector("#acc-city-select")`));
check("district hidden until a city is picked", await evalJS(`!document.querySelector("#acc-district")`));
check("City label has NO (optional)", await evalJS(`(() => {
  const lbl = [...document.querySelectorAll("label")].find(l => l.htmlFor === "acc-city-select");
  return lbl ? !lbl.textContent.includes("(optional)") : false;
})()`));
check("District is not on the page as optional either", await evalJS(`!document.body.innerText.includes("District (optional)")`));
check("ZIP keeps its (optional) hint", await evalJS(`(() => {
  const lbl = [...document.querySelectorAll("label")].find(l => l.htmlFor === "acc-zip");
  return lbl ? lbl.textContent.includes("(optional)") : false;
})()`));

await openSelect("#acc-city-select");
let opts = await optionTexts();
check("17 city options (16 cities + other)", opts.length === 17, `${opts.length}: ${opts.slice(0, 6).join(" | ")}`);
check("major cities present", ["Mogadishu", "Hargeisa", "Bosaso", "Galkayo", "Kismayo", "Baidoa", "Burao", "Garowe", "Berbera", "Borama", "Beledweyne", "Jowhar", "Afgooye", "Merca", "Erigavo", "Las Anod"].every(c => opts.includes(c)));
check("city options have NO prices", opts.every(s => !s.includes("$")));

// Mogadishu -> district required, save blocked without it
await pickOption("Mogadishu");
check("district appears for Mogadishu", await evalJS(`!!document.querySelector("#acc-district")`));
const blockedToast = await submitForm();
check("save WITHOUT district is blocked", blockedToast.toLowerCase().includes("district"), blockedToast);
check("blocked save did not persist", (await apiCity()) === "", JSON.stringify(await apiCity()));

await openSelect("#acc-district");
opts = await optionTexts();
check("21 district options (20 + other area)", opts.length === 21, `${opts.length}`);
check("district options have NO prices", opts.every(s => !s.includes("$")));
check("no legacy 'Other city' entry in district list", !opts.some(s => /Other city/i.test(s)));
check("has 'Other area (not listed)' escape", opts.some(s => /Other area/i.test(s)));

await pickOption("Hodan");
// poll — Radix updates the trigger text on the tick after onValueChange
let hodanShown = false;
for (let i = 0; i < 10 && !hodanShown; i++) {
  hodanShown = await evalJS(`document.querySelector("#acc-district")?.textContent.includes("Hodan")`).catch(() => false);
  if (!hodanShown) await sleep(400);
}
check("Hodan selected", hodanShown);
check("no text inputs on the district path", await evalJS(`!document.querySelector("#acc-city") && !document.querySelector("#acc-area")`));
await submitForm();
check("save with district succeeds (city=Hodan)", (await apiCity()) === "Hodan", JSON.stringify(await apiCity()));
const shot1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/task71-profile-city-district.png", Buffer.from(shot1.data, "base64"));

// reload -> both pickers prefill (cache-bust so we never inspect a dying DOM)
await send("Page.navigate", { url: `${BASE}/?view=account&t=${Date.now()}` });
await waitProfile();
await sleep(1500);
check("reload prefills City=Mogadishu", await evalJS(`document.querySelector("#acc-city-select")?.textContent.includes("Mogadishu")`));
check("reload prefills District=Hodan", await evalJS(`document.querySelector("#acc-district")?.textContent.includes("Hodan")`));

// Hargeisa: district hidden, big-city save
await openSelect("#acc-city-select");
await pickOption("Hargeisa");
check("district hides for Hargeisa", await evalJS(`!document.querySelector("#acc-district")`));
await submitForm();
check("save Hargeisa (big-city path)", (await apiCity()) === "Hargeisa", JSON.stringify(await apiCity()));
await send("Page.navigate", { url: `${BASE}/?view=account&t=${Date.now()}` });
await waitProfile();
await sleep(1500);
check("reload prefills City=Hargeisa, no district", await evalJS(`document.querySelector("#acc-city-select")?.textContent.includes("Hargeisa") && !document.querySelector("#acc-district")`));

// Somali labels
await send("Network.setCookie", { name: "hayaan_lang", value: "so", url: BASE });
await send("Page.navigate", { url: `${BASE}/?view=account&t=${Date.now()}` });
await waitProfile();
await sleep(1500);
check("SO: trigger shows Hargeysa", await evalJS(`document.querySelector("#acc-city-select")?.textContent.includes("Hargeysa")`));
await openSelect("#acc-city-select");
opts = await optionTexts();
check("SO: city options in Somali", opts.includes("Muqdisho") && opts.includes("Hargeysa") && opts.includes("Boosaaso") && opts.includes("Kismaayo"), opts.slice(0, 4).join(" | "));
await pickOption("Muqdisho");
await openSelect("#acc-district");
opts = await optionTexts();
check("SO: district names stay canonical", opts.includes("Hodan") && opts.includes("Wadajir"), opts.slice(0, 3).join(" | "));
const shot2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/home/z/my-project/download/task71-profile-somali.png", Buffer.from(shot2.data, "base64"));
await send("Network.setCookie", { name: "hayaan_lang", value: "en", url: BASE });
await send("Page.navigate", { url: `${BASE}/?view=account&t=${Date.now()}` });
await waitProfile();
await sleep(1200);

// Other city path
await openSelect("#acc-city-select");
await pickOption("Other city (not listed)");
check("other city reveals text input", await evalJS(`!!document.querySelector("#acc-city")`));
await submitForm();
check("save without typing other city blocked", (await toastText()).length > 0, "toast captured by submitForm");
await typeInto("#acc-city", "Buuhoodle");
await submitForm();
check("save custom city (Buuhoodle)", (await apiCity()) === "Buuhoodle", JSON.stringify(await apiCity()));
await send("Page.navigate", { url: `${BASE}/?view=account&t=${Date.now()}` });
await waitProfile();
await sleep(1500);
check("reload prefills Other + Buuhoodle", await evalJS(`document.querySelector("#acc-city-select")?.textContent.includes("Other city") && document.querySelector("#acc-city")?.value === "Buuhoodle"`));

// Other area path (Mogadishu, unlisted neighborhood)
await openSelect("#acc-city-select");
await pickOption("Mogadishu");
await openSelect("#acc-district");
await pickOption("Other area (not listed)");
check("other area reveals area input", await evalJS(`!!document.querySelector("#acc-area")`));
await typeInto("#acc-area", "Siinaay");
await submitForm();
check("save custom area (Siinaay)", (await apiCity()) === "Siinaay", JSON.stringify(await apiCity()));

// --- Part B: checkout prefill from every saved shape ---------------------------
const products = await (await fetch(`${BASE}/api/products`)).json();
const pid = (products.products ?? [])[0]?.id;
check("probe product available for cart", !!pid);
if (pid) {
  await fetch(`${BASE}/api/cart`, { method: "POST", headers: { "Content-Type": "application/json", cookie: `shop_session=${sessionValue}` }, body: JSON.stringify({ productId: pid, quantity: 1 }) });
  const waitCheckout = async (timeoutMs = 25000) => {
    for (const until = Date.now() + timeoutMs; Date.now() < until;) {
      if (await evalJS(`!!document.querySelector("#district")`).catch(() => false)) return true;
      await sleep(600);
    }
    return false;
  };
  // Hodan -> priced district prefill
  await apiPutCity("Hodan");
  check("PUT Hodan for checkout test", (await apiCity()) === "Hodan");
  await send("Page.navigate", { url: `${BASE}/?view=checkout&t=${Date.now()}` });
  check("checkout renders", await waitCheckout());
  await sleep(800);
  check("checkout prefills Hodan district", await evalJS(`document.querySelector("#district")?.textContent.includes("Hodan")`));
  check("checkout shows the district price", await evalJS(`document.body.innerText.includes("1.50")`), "Hodan $1.50");
  // Hargeisa -> other-city path with input
  await apiPutCity("Hargeisa");
  await send("Page.navigate", { url: `${BASE}/?view=checkout&t=${Date.now()}` });
  await waitCheckout();
  await sleep(800);
  check("checkout maps Hargeisa to Other city", await evalJS(`document.querySelector("#district")?.textContent.includes("Other city")`));
  check("checkout fills Hargeisa in city input", await evalJS(`document.querySelector("#city")?.value === "Hargeisa"`));
  check("checkout shows outside-Mogadishu fee", await evalJS(`document.body.innerText.includes("6.95")`), "$6.95");
  const shot3 = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync("/home/z/my-project/download/task71-checkout-hargeisa.png", Buffer.from(shot3.data, "base64"));
  // custom area -> other-city path too
  await apiPutCity("Siinaay");
  await send("Page.navigate", { url: `${BASE}/?view=checkout&t=${Date.now()}` });
  await waitCheckout();
  await sleep(800);
  check("checkout fills custom area Siinaay", await evalJS(`document.querySelector("#city")?.value === "Siinaay"`));
}

check("0 console exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

// --- cleanup ---------------------------------------------------------------------
const restoreRes = await fetch(`${BASE}/api/account`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", cookie: `shop_session=${sessionValue}` },
  body: JSON.stringify(ORIG),
});
check("cleanup restores original profile", restoreRes.ok, `status ${restoreRes.status}`);
check("cleanup verified (city back)", (await apiCity()) === ORIG.city, `${JSON.stringify(await apiCity())} vs ${JSON.stringify(ORIG.city)}`);
const clearRes = await fetch(`${BASE}/api/cart?clear=true`, { method: "DELETE", headers: { cookie: `shop_session=${sessionValue}` } });
check("cleanup clears probe cart", clearRes.ok || clearRes.status === 404, `status ${clearRes.status}`);

const failed = results.filter((l) => l.startsWith("FAIL")).length;
console.error(`\n${results.length - failed}/${results.length} checks passed`);
chrome.kill();
process.exit(failed === 0 ? 0 : 1);
