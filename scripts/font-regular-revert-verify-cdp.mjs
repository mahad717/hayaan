// Task 45 — Verify "retire Panton Regular" on https://hayaan.co
// Expect:
//   - body / regular text computes to the ORIGINAL system stack (no panton)
//   - hero h1, header logo, buttons compute to the panton family (Bold/Black)
//   - NO @font-face for the panton family declares weight 400
//   - .font-original spots unchanged (system stack)
// Same CDP pattern as logo-weight-verify-cdp.mjs; chrome launched in the SAME
// bash command.

const DEBUG_PORT = 9333;
const LAUNCH_URL = "https://hayaan.co";
const SHOT_PATH = "/home/z/my-project/download/font-regular-revert-homepage.png";

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
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
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

function waitEvent(ws, eventName, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${eventName}`)), timeoutMs);
    const onMsg = (ev) => {
      if (JSON.parse(ev.data).method === eventName) {
        clearTimeout(t);
        ws.removeEventListener("message", onMsg);
        resolve(true);
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

const versionInfo = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json());
console.log("browser: " + versionInfo.Browser);
const ws = await connectWs(versionInfo.webSocketDebuggerUrl);

const { targetId } = await sendCmd(ws, "Target.createTarget", { url: "about:blank" });
const { sessionId } = await sendCmd(ws, "Target.attachToTarget", { targetId, flatten: true });
await sendCmd(ws, "Page.enable", {}, sessionId);
await sendCmd(ws, "Runtime.enable", {}, sessionId);

const loadPromise = waitEvent(ws, "Page.loadEventFired", 45000).catch(() => null);
await sendCmd(ws, "Page.navigate", { url: LAUNCH_URL }, sessionId);
await loadPromise;
console.log("page loaded, waiting 4s for hydration/fonts…");
await new Promise((r) => setTimeout(r, 4000));

const { result } = await sendCmd(
  ws,
  "Runtime.evaluate",
  {
    expression: `(async () => {
      const fam = (el) => getComputedStyle(el).fontFamily;
      const isPanton = (f) => /panton/i.test(f);
      const body = document.body;
      const h1 = document.querySelector("h1");
      const logo = document.querySelector('button[aria-label="Hayaan Market home"]');
      const logoOuter = logo?.querySelector("span");
      const logoInner = logoOuter?.querySelector("span");
      const heroBtn = [...document.querySelectorAll("button.font-panton, a.font-panton")]
        .find((b) => !b.contains(logo) && b !== logo);
      const origSpot = document.querySelector(".font-original");
      const pinned = [...document.querySelectorAll(".font-panton")].slice(0, 6).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 24),
        weight: getComputedStyle(el).fontWeight,
        panton: isPanton(fam(el)),
      }));
      // @font-face inventory from every stylesheet on the page
      const faces = [];
      for (const sheet of [...document.styleSheets]) {
        let rules = [];
        try { rules = [...sheet.cssRules]; } catch { continue; }
        for (const r of rules) {
          if (r instanceof CSSFontFaceRule) {
            faces.push({
              family: r.style.getPropertyValue("font-family").replace(/["']/g, ""),
              weight: r.style.getPropertyValue("font-weight"),
            });
          }
        }
      }
      const pantonFaces = faces.filter((f) => /panton/i.test(f.family));
      return JSON.stringify({
        bodyFamily: fam(body).slice(0, 60),
        bodyPanton: isPanton(fam(body)),
        h1: h1 ? { weight: getComputedStyle(h1).fontWeight, panton: isPanton(fam(h1)) } : null,
        logo: logoOuter && logoInner ? {
          outerWeight: getComputedStyle(logoOuter).fontWeight, outerPanton: isPanton(fam(logoOuter)),
          innerWeight: getComputedStyle(logoInner).fontWeight, innerPanton: isPanton(fam(logoInner)),
        } : null,
        sampleButton: heroBtn ? { text: (heroBtn.textContent || "").trim().slice(0, 24), weight: getComputedStyle(heroBtn).fontWeight, panton: isPanton(fam(heroBtn)) } : null,
        origSpot: origSpot ? { panton: isPanton(fam(origSpot)), family: fam(origSpot).slice(0, 40) } : null,
        pinnedCount: document.querySelectorAll(".font-panton").length,
        pinnedSample: pinned,
        pantonFaces,
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  },
  sessionId
);
const v = JSON.parse(result.value);
console.log(JSON.stringify(v, null, 2));

const shot = await sendCmd(ws, "Page.captureScreenshot", { format: "png" }, sessionId);
await Bun.write(SHOT_PATH, Buffer.from(shot.data, "base64"));
console.log("screenshot saved: " + SHOT_PATH);

await sendCmd(ws, "Target.closeTarget", { targetId }).catch(() => {});
ws.close();

const pass =
  v.bodyPanton === false &&
  v.h1 && v.h1.panton === true && v.h1.weight === "900" &&
  v.logo && v.logo.outerPanton && v.logo.outerWeight === "900" && v.logo.innerWeight === "700" &&
  v.origSpot && v.origSpot.panton === false &&
  v.pantonFaces.length > 0 && v.pantonFaces.every((f) => f.weight !== "400");
console.log(pass ? "PASS: Panton Regular retired — body on original stack, brand spots still Panton Bold/Black, no 400 face shipped"
                 : "FAIL: see values above");
process.exit(pass ? 0 : 1);
