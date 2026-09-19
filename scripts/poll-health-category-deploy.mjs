// Task 68 deploy poll: probe the content-hashed chunk that carries the new
// Somali label ("Caafimaad & Vitamiinada") directly on the CDN. Avoids the
// stale /admin HTML incremental-cache behavior seen in Tasks 65/66.
const CHUNK = "1kpgeh0azw5y-.js";
const MARKER = "Caafimaad & Vitamiinada";
const BASE = "https://hayaan.co";

for (let i = 1; i <= 40; i++) {
  try {
    const res = await fetch(`${BASE}/_next/static/chunks/${CHUNK}?cb=${Date.now()}`, { cache: "no-store" });
    const text = res.ok ? await res.text() : "";
    console.log(`try ${i}: HTTP ${res.status}, marker=${text.includes(MARKER)}`);
    if (res.status === 200 && text.includes(MARKER)) { console.log("DEPLOYED"); process.exit(0); }
  } catch (e) { console.log(`try ${i}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log("TIMEOUT after 40 tries");
process.exit(1);
