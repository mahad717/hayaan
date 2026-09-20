// Task 75 live verification — shipped SEO guides now visible in the admin blog.
// Uses the owner's credentials (provided in chat for exactly this purpose).
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";

const BASE = "https://hayaan.co";
const OUT = "/home/z/my-project/download";
const EMAIL = "gabeyre80@gmail.com";
const PASSWORD = ":LSQR:h8846gA.w";

const results = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
  results.push(cond);
};

// ---------- 1. API: owner login + admin blog list ----------
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const loginBody = await login.json().catch(() => ({}));
check("owner email+password login works", login.status === 200 && loginBody?.user?.email === EMAIL, `${login.status} role=${loginBody?.user?.role ?? "?"}`);
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

const blog = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie } });
const blogBody = await blog.json().catch(() => ({}));
const posts = blogBody?.posts ?? [];
check("GET /api/admin/blog 200", blog.status === 200, String(blog.status));
check("admin blog lists 6 posts (1 DB + 5 shipped)", posts.length === 6, String(posts.length));
const shipped = posts.filter((p) => p.source === "shipped");
check("5 posts flagged source=shipped", shipped.length === 5, shipped.map((p) => p.slug).join(", "));
const dbPost = posts.find((p) => p.source === "db");
check("owner's DB post present", Boolean(dbPost), dbPost?.slug ?? "none");
check("shipped rows carry full content", shipped.length > 0 && shipped.every((p) => (p.content ?? "").length > 200), String(shipped[0]?.content?.length ?? 0) + " chars first");
check("sorted by activity desc", posts.every((p, i) => i === 0 || new Date(posts[i - 1].updatedAt) >= new Date(p.updatedAt)));

// ---------- 2. Browser: admin dashboard screenshot ----------
const CHROME = ["/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome", "/home/z/.agent-browser/browsers/chrome-153.0.8010.47/chrome-linux64/chrome"].find(existsSync);
if (!CHROME) { console.error("FATAL: no chrome"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9357", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage", "--disable-gpu", `--user-data-dir=/tmp/chrome-t75-${Date.now()}`, "--window-size=1440,3000", "about:blank"], { stdio: "ignore" });
let v = null;
for (let i = 0; i < 40; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:9357/json/version`)).json(); break; } catch {} }
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
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 3000, deviceScaleFactor: 1, mobile: false });

await send("Page.navigate", { url: BASE });
await sleep(7000);
// login through the API inside the page (sets shop_session cookie for the browser)
const pageLogin = await ev(`fetch("/api/auth/login", { method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include", body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} }) }).then(r => r.json())`);
check("browser login as owner", pageLogin?.user?.email === EMAIL, pageLogin?.user?.role ?? "?");

await send("Page.navigate", { url: `${BASE}/admin` });
await sleep(6000);
const admin = await ev(`(() => {
  const text = document.body.innerText;
  const rows = [...document.querySelectorAll("table tbody tr")];
  const blogRow = rows.filter(r => r.textContent.includes("/blog/"));
  const badges = [...document.querySelectorAll("span")].filter(s => s.textContent.trim() === "Built-in").length;
  return JSON.stringify({
    isAdmin: text.includes("Hayaan Market admin") || text.includes("Dashboard"),
    signedAs: text.includes(${JSON.stringify(EMAIL)}),
    blogRows: blogRow.map(r => (r.textContent.match(/\\/blog\\/([a-z0-9-]+)/) || [])[1]).filter(Boolean),
    builtinBadges: badges,
  });
})()`);
const adminData = JSON.parse(admin);
check("admin dashboard renders", adminData.isAdmin);
check("signed in as owner", adminData.signedAs);
check("blog table shows 6 rows", adminData.blogRows.length === 6, adminData.blogRows.join(" | "));
check("5 Built-in badges rendered", adminData.builtinBadges === 5, String(adminData.builtinBadges));
// scroll the blog section into view and screenshot it
await ev(`document.querySelectorAll("table tbody tr").forEach(() => {}); const tbl = [...document.querySelectorAll("table")].find(t => t.textContent.includes("/blog/")); tbl?.scrollIntoView({ block: "center" }); "ok"`);
await sleep(800);
await shot(`${OUT}/task75-live-admin-blog.png`);
check("zero console exceptions", errors.length === 0, errors.slice(0, 2).join(" | "));
chrome.kill();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
