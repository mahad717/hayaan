// Task 74 live verification — owner Google-admin allowlist + profile password setter.
// API proofs (Node fetch) + browser CDP flow (signup -> set password via UI -> re-login).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome",
  "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome",
];
const DEBUG_PORT = 9351;
const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/download";
const TEST_EMAIL = "hayaan.task74@hayaan-testing.com";
const TEST_PASS = "task74-first-pass";
const NEW_PASS = "task74-new-pass-9";

const results = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
  results.push(cond);
};

// ---------- 1. API-level proofs ----------
const anon = await fetch(`${BASE}/api/auth/password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "whatever1" }),
});
check("POST /api/auth/password unauthenticated -> 401", anon.status === 401, String(anon.status));

const hint = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "gabeyre80@gmail.com", password: "definitely-wrong" }),
});
const hintBody = await hint.json().catch(() => ({}));
check(
  "owner-email wrong-password login -> 401 with Google hint",
  hint.status === 401 && /Continue with Google/.test(hintBody.error ?? ""),
  hintBody.error?.slice(0, 110) ?? String(hint.status),
);

const cb = await fetch(`${BASE}/auth/callback`, { redirect: "manual" });
check("/auth/callback route live (30x without code)", cb.status >= 300 && cb.status < 400, `${cb.status} -> ${cb.headers.get("location") ?? ""}`);

const authz = await fetch(`https://mqyhgyakhfhuctnvezby.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(BASE + "/auth/callback")}`, { redirect: "manual" });
check("Supabase Google provider enabled (authorize 302 -> accounts.google.com)", authz.status === 302 && (authz.headers.get("location") ?? "").includes("accounts.google.com"), `${authz.status}`);

// ---------- 2. Browser flow ----------
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-dev-shm-usage", "--disable-gpu",
  `--user-data-dir=/tmp/chrome-t74-${Date.now()}`,
  "--window-size=1440,2600", "about:blank",
], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); break; } catch {} }
if (!v) { chrome.kill(); process.exit(1); }
function conn(url, t = 15000) { return new Promise((res, rej) => { const ws = new WebSocket(url); const to = setTimeout(() => { ws.close(); rej(new Error("ws timeout")); }, t); ws.onopen = () => { clearTimeout(to); res(ws); }; ws.onerror = () => { clearTimeout(to); rej(new Error("ws err")); }; }); }
let id = 0;
function cmd(ws, m, p = {}, sid = null, to = 45000) { return new Promise((res, rej) => { const i = ++id; const pay = { id: i, method: m, params: p }; if (sid) pay.sessionId = sid; const to2 = setTimeout(() => rej(new Error("to " + m)), to); const on = (ev) => { const ms = JSON.parse(ev.data); if (ms.id === i) { clearTimeout(to2); ws.removeEventListener("message", on); ms.error ? rej(new Error(m)) : res(ms.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify(pay)); }); }
const ws = await conn(v.webSocketDebuggerUrl);
const { targetId } = await cmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await cmd(ws, "Target.attachToTarget", { targetId, flatten: true });
const send = (m, p) => cmd(ws, m, p, sessionId);
await send("Page.enable"); await send("Runtime.enable");
const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text ?? "exception");
});
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result?.value; };
const shot = async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); };
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2600, deviceScaleFactor: 1, mobile: false });

// Trusted clicks (Radix components ignore synthetic .click())
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
};
const clickElement = async (findExpr, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const rect = await ev(`(() => { const el = ${findExpr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 }; })()`);
    if (rect?.vis) { await clickAt(rect.x, rect.y); return true; }
    await sleep(700);
  }
  return false;
};
const byText = (txt, sel = "button") => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(b => b.textContent.trim().includes(${JSON.stringify(txt)}))`;
const fill = (id, val) => ev(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return "MISSING:" + ${JSON.stringify(id)};
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
  desc.set.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return "filled";
})()`);

await send("Page.navigate", { url: BASE });
await sleep(8000);

// 2a. auth modal with Continue with Google — sign-in lives inside the
// account icon dropdown (aria-label "Account menu") → Sign in item.
check("open account menu", await clickElement(`document.querySelector("button[aria-label='Account menu']")`));
await sleep(1000);
check("click Sign in menu item", await clickElement(byText("Sign in", "[role='menuitem']")));
await sleep(1500);
const modal = await ev(`(() => {
  const dlg = document.querySelector("[role='dialog']");
  const google = [...document.querySelectorAll("button")].some(b => b.textContent.includes("Continue with Google"));
  return JSON.stringify({ open: !!dlg, google });
})()`);
const modalData = JSON.parse(modal);
check("auth modal opens", modalData.open);
check("Continue with Google button present", modalData.google);
await shot(`${OUT}/task74-live-auth-modal.png`);

// 2b. create the test account
check("switch to Create account tab", await clickElement(byText("Create account", "[role='tab']")));
await sleep(900);
check("fill signup form", (await fill("name-signup", "Task74 Verify")) === "filled" && (await fill("email-signup", TEST_EMAIL)) === "filled" && (await fill("pwd-signup", TEST_PASS)) === "filled");
await sleep(300);
check("submit signup", await clickElement(`document.querySelector("[role='dialog'] form button[type='submit']")`));
await sleep(4500);
const me1 = await ev(`fetch("/api/auth/me", { credentials: "include" }).then(r => r.json())`);
check("test account created + signed in", me1?.user?.email === TEST_EMAIL, JSON.stringify(me1?.user?.email ?? "null"));

// 2c. account view shows the Password card
await send("Page.navigate", { url: `${BASE}/?view=account` });
await sleep(5000);
const acc = await ev(`(() => {
  const pwd = document.getElementById("acc-pwd");
  const pwd2 = document.getElementById("acc-pwd2");
  const note = [...document.querySelectorAll("p")].some(p => p.textContent.includes("sign up with Google"));
  return JSON.stringify({ hasPwd: !!pwd, hasPwd2: !!pwd2, note, email: document.body.innerText.includes(${JSON.stringify(TEST_EMAIL)}) });
})()`);
const accData = JSON.parse(acc);
check("account view shows email", accData.email);
check("Password card present (new + confirm)", accData.hasPwd && accData.hasPwd2);
check("password note visible", accData.note);
await shot(`${OUT}/task74-live-account-password.png`);

// 2d. set the new password via the UI
check("fill new password", (await fill("acc-pwd", NEW_PASS)) === "filled" && (await fill("acc-pwd2", NEW_PASS)) === "filled");
await sleep(300);
check("submit new password via card", await clickElement(`document.getElementById("acc-pwd").closest("form").querySelector("button[type='submit']")`));
await sleep(3500);
const toastText = await ev(`document.body.innerText`);
check("success toast shown", /Password set/.test(toastText), toastText.match(/Password set[^\n]*/)?.[0] ?? "no toast text");

// 2e. sign out server-side, then re-login WITH THE NEW PASSWORD (proves Supabase was updated)
await ev(`fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json())`);
await sleep(1000);
const relog = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: TEST_EMAIL, password: NEW_PASS }),
});
const relogBody = await relog.json().catch(() => ({}));
check("re-login with the NEW password -> 200", relog.status === 200 && relogBody?.user?.email === TEST_EMAIL, `${relog.status} ${JSON.stringify(relogBody?.user?.email ?? "")}`);
const oldlog = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
});
check("old (signup) password no longer valid", oldlog.status === 401, String(oldlog.status));

check("zero console exceptions", errors.length === 0, errors.slice(0, 2).join(" | "));
chrome.kill();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
