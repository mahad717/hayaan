// Authentic hover verification: headed Chrome under Xvfb, CDP browser-level attach.
// Usage: DISPLAY=:99 bun scripts/hover-verify-cdp.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/home/z/.agent-browser/browsers/chrome-152.0.7977.64/chrome';
const PORT = 9333;
const OUT = '/home/z/my-project/download';
const BASE = 'https://hayaan.co';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-dev-shm-usage', '--disable-gpu',
  `--user-data-dir=/tmp/hover-verify-profile-${Date.now()}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore', env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' } });

let version;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 500));
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch {}
}
if (!version) { console.error('FATAL: devtools endpoint never came up'); chrome.kill(); process.exit(1); }
console.error('[stage] browser ws:', version.webSocketDebuggerUrl);

const ws = new WebSocket(version.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const waiters = [];
ws.onerror = (e) => console.error('[ws error]', e.message || e);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('ws open timeout')), 10000);
  ws.onopen = () => { clearTimeout(t); res(); };
});

function send(method, params = {}, sessionId) {
  console.error('[cdp >]', method);
  return new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej, method });
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('CDP timeout: ' + method)); } }, 15000);
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.method + ': ' + JSON.stringify(msg.error))) : res(msg.result);
  } else if (msg.method) {
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].match(msg)) { waiters[i].res(msg); waiters.splice(i, 1); }
    }
  }
};
function waitFor(method, timeout = 20000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout waiting ' + method)), timeout);
    waiters.push({ match: m => m.method === method, res: m => { clearTimeout(t); res(m); } });
  });
}

// fresh tab
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
console.error('[stage] attached, sessionId:', sessionId);
const S = sessionId;

await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S);
const loaded = waitFor('Page.loadEventFired', 30000);
await send('Page.navigate', { url: BASE + '/' }, S);
await loaded;
await new Promise(r => setTimeout(r, 4000)); // hydration settle

const mq = await send('Runtime.evaluate', { expression: `JSON.stringify({hoverHover: matchMedia('(hover: hover)').matches, pointerFine: matchMedia('(pointer: fine)').matches})`, returnByValue: true }, S);
console.log('media:', mq.result.value);

async function hoverAndRead(file, text, tag = 'button,a') {
  const box = await send('Runtime.evaluate', {
    expression: `(() => { const els=[...document.querySelectorAll('${tag}')]; const b=els.find(x=>x.textContent.trim()===${JSON.stringify(text)}); if(!b) return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2}); })()`,
    returnByValue: true,
  }, S);
  if (!box.result.value) { console.log(file, ': NOT FOUND'); return null; }
  const { x, y } = JSON.parse(box.result.value);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, S);
  await new Promise(r => setTimeout(r, 700));
  const read = await send('Runtime.evaluate', {
    expression: `(() => { const els=[...document.querySelectorAll('${tag}')]; const b=els.find(x=>x.textContent.trim()===${JSON.stringify(text)}); const cs=getComputedStyle(b); return JSON.stringify({hovered: b.matches(':hover'), color: cs.color, bg: cs.backgroundColor}); })()`,
    returnByValue: true,
  }, S);
  console.log(file, read.result.value);
  const shot = await send('Page.captureScreenshot', { format: 'png' }, S);
  writeFileSync(`${OUT}/${file}.png`, Buffer.from(shot.data, 'base64'));
  return JSON.parse(read.result.value);
}

const browse = await hoverAndRead('hover-fix-browse-categories', 'Browse categories');
await hoverAndRead('hover-regression-start-shopping', 'Start shopping');

// move mouse away, capture normal state
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 890 }, S);
await new Promise(r => setTimeout(r, 700));
const normal = await send('Runtime.evaluate', {
  expression: `(() => { const els=[...document.querySelectorAll('button')]; const b=els.find(x=>x.textContent.trim()==='Browse categories'); const cs=getComputedStyle(b); return JSON.stringify({hovered: b.matches(':hover'), color: cs.color, bg: cs.backgroundColor}); })()`,
  returnByValue: true,
}, S);
console.log('browse-categories NORMAL state:', normal.result.value);

const pass = browse && browse.hovered && browse.color === 'rgb(255, 255, 255)' && browse.bg === 'rgb(20, 83, 45)';
console.log(pass ? 'PASS: hover label is white on brand-green fill' : 'FAIL: unexpected hover state');

ws.close(); chrome.kill(); process.exit(pass ? 0 : 2);
