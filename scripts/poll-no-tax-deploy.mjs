#!/bin/mkscript
// Poll https://hayaan.co until the deployed client bundle no longer contains
// the tax strings ("Tax (8%)" / "Canshuur (8%)"), proving the no-tax build is
// live. Success also requires finding the pay-button dictionary string so we
// know we inspected the right chunk set.
const BASE = "https://hayaan.co";
const MARKERS_ABSENT = ["Tax (8%)", "Canshuur (8%)"];
const MARKER_PRESENT = "with Sifalo Pay";
const MAX_TRIES = 24;
const WAIT_MS = 25000;

function extractChunkUrls(html) {
  const urls = new Set();
  const re = /\/_next\/static\/chunks\/[A-Za-z0-9._%-]+\.js/g;
  for (const m of html.matchAll(re)) urls.add(new URL(m[0], BASE).href);
  return [...urls];
}

async function get(url) {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return await res.text();
}

let ok = false;
for (let i = 1; i <= MAX_TRIES; i++) {
  const html = await get(BASE + "/?nocache=" + Date.now());
  if (!html) { console.log(`[${i}] homepage fetch failed`); await new Promise(r => setTimeout(r, WAIT_MS)); continue; }
  const chunks = extractChunkUrls(html);
  let texts = [];
  for (const c of chunks) { const t = await get(c); if (t) texts.push(t); }
  const hasPay = texts.some(t => t.includes(MARKER_PRESENT));
  const absentHit = MARKERS_ABSENT.filter(m => texts.some(t => t.includes(m)));
  if (hasPay && absentHit.length === 0 && chunks.length > 0) {
    console.log(`[${i}] ✅ NEW BUILD LIVE: ${chunks.length} chunks checked, no tax strings, pay-button string present`);
    ok = true;
    break;
  }
  console.log(`[${i}] old build still live (tax strings found: ${absentHit.join(", ") || "none"}, chunks: ${chunks.length})`);
  await new Promise(r => setTimeout(r, WAIT_MS));
}
if (!ok) { console.log("❌ TIMEOUT: new build not detected in time"); process.exit(1); }
