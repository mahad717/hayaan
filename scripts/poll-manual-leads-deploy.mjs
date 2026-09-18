// Poll https://hayaan.co until the manual-lead-entry build is live:
// some client chunk must contain "Add a lead manually" (unique to Task 64).
const BASE = "https://hayaan.co";
const MARKER = "Add a lead manually";
const MAX_TRIES = 24;
const WAIT_MS = 25000;

function chunkUrls(html) {
  return [...new Set((html.match(/\/_next\/static\/chunks\/[A-Za-z0-9._%-]+\.js/g) ?? [])
    .map((p) => new URL(p, BASE).href))];
}
async function get(url) {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" }).catch(() => null);
  return res && res.ok ? res.text() : null;
}

let ok = false;
for (let i = 1; i <= MAX_TRIES; i++) {
  const html = await get(`${BASE}/?nocache=${Date.now()}`);
  if (html) {
    const chunks = chunkUrls(html);
    for (const c of chunks) {
      const t = await get(c);
      if (t && t.includes(MARKER)) {
        console.log(`[${i}] ✅ NEW BUILD LIVE — manual lead entry found in ${c.split("/").pop()}`);
        ok = true;
        break;
      }
    }
    if (ok) break;
    console.log(`[${i}] not live yet (${chunks.length} chunks checked)`);
  } else console.log(`[${i}] homepage fetch failed`);
  await new Promise((r) => setTimeout(r, WAIT_MS));
}
if (!ok) { console.log("❌ TIMEOUT"); process.exit(1); }
