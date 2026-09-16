// Probe: does --headless=new Chrome 152 support Speculation Rules prerender?
// Serves /a.html (rules prerendering /b.html, eager) + /b.html on :8899,
// loads /a.html, waits, then checks /json/list for a /b.html target and
// evaluates document.prerendering inside any prerender target.
import { writeFileSync } from "node:fs";

const A_HTML = `<!doctype html><html><head>
<script type="speculationrules">{"prerender":[{"source":"list","urls":["/b.html"],"eagerness":"eager"}]}</script>
</head><body><h1>A</h1><a href="/b.html">go b</a></body></html>`;
const B_HTML = `<!doctype html><html><head></head><body><h1 id="b">B page</h1></body></html>`;

Bun.serve({
  port: 8899,
  fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/a.html") return new Response(A_HTML, { headers: { "content-type": "text/html" } });
    if (u.pathname === "/b.html") return new Response(B_HTML, { headers: { "content-type": "text/html" } });
    return new Response("nf", { status: 404 });
  },
});
writeFileSync("/tmp/prerender-probe-up", "1");
console.log("probe server on :8899");

const DEBUG_PORT = 9334;
await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
const ws = await new Promise((resolve, reject) => {
  const w = new WebSocket(versionInfo.webSocketDebuggerUrl);
  w.onopen = () => resolve(w);
  w.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const cmd = (method, params = {}, sessionId = null) =>
  new Promise((resolve) => {
    const i = ++id;
    const p = { id: i, method, params };
    if (sessionId) p.sessionId = sessionId;
    pending.set(i, resolve);
    ws.send(JSON.stringify(p));
  });

await cmd("Page.enable");
const { targetId } = await cmd("Target.createTarget", { url: "http://127.0.0.1:8899/a.html" });
const { sessionId } = await cmd("Target.attachToTarget", { targetId, flatten: true });
await cmd("Runtime.enable", {}, sessionId);
await new Promise((r) => setTimeout(r, 3000));
const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
console.log("targets:");
for (const t of list) console.log(`  type=${t.type} url=${t.url}`);
const bTarget = list.find((t) => t.url.endsWith("/b.html") && t.targetId !== targetId);
if (bTarget) {
  const att = await cmd("Target.attachToTarget", { targetId: bTarget.targetId, flatten: true }).catch((e) => null);
  if (att) {
    const ev = await cmd("Runtime.evaluate", { expression: "document.prerendering", returnByValue: true }, att.sessionId);
    console.log("prerender target found; document.prerendering =", ev.result?.result?.value);
  }
} else {
  console.log("NO prerender target after 3s -> headless likely does not support speculation prerender");
}
ws.close();
process.exit(0);
