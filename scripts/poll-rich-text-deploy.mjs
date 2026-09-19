// Task 69 deploy poll: probe the content-hashed chunk carrying the toolbar
// hint string on the CDN (avoids stale /admin HTML incremental cache).
const CHUNK = "2ibhxl59ueiz9.js";
const MARKER = "Bold, lists &amp; headings show on the product page";
const ALT_MARKER = "Bold, lists & headings show on the product page";
const BASE = "https://hayaan.co";

for (let i = 1; i <= 40; i++) {
  try {
    const res = await fetch(`${BASE}/_next/static/chunks/${CHUNK}?cb=${Date.now()}`, { cache: "no-store" });
    const text = res.ok ? await res.text() : "";
    const hit = text.includes(MARKER) || text.includes(ALT_MARKER);
    console.log(`try ${i}: HTTP ${res.status}, marker=${hit}`);
    if (res.status === 200 && hit) { console.log("DEPLOYED"); process.exit(0); }
  } catch (e) { console.log(`try ${i}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log("TIMEOUT after 40 tries");
process.exit(1);
