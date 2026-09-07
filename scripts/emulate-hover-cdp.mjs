// Emulate hover/pointer media features on the agent-browser managed page via CDP.
// After this runs, Tailwind's @media (hover: hover) styles apply in that tab.
const BROWSER_WS = process.argv[2];

const targets = await (await fetch(BROWSER_WS.replace('ws://', 'http://').replace(/\/devtools\/browser\/.*$/, '/json/list'))).json();
const page = targets.find(t => t.type === 'page' && t.url.includes('hayaan.co'));
if (!page) { console.error('no hayaan page target', targets.map(t => t.type + ' ' + t.url)); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  }
};
await new Promise(r => ws.onopen = r);

await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Emulation.setEmitTouchEventsForMouse', { enabled: false, configuration: 'desktop' });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'hover', value: 'hover' },
    { name: 'pointer', value: 'fine' },
  ],
});
const check = await send('Runtime.evaluate', { expression: `JSON.stringify({hoverHover: matchMedia('(hover: hover)').matches, pointerFine: matchMedia('(pointer: fine)').matches})`, returnByValue: true });
console.log('media features now:', check.result.value);
ws.close();
process.exit(0);
