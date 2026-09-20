// Task 72 deploy poll — probe the content-hashed chunk that carries the new
// category-page code ("Browse other categories" string). /admin-style HTML
// caches are irrelevant here: the marker lives in a content-hash chunk, so
// CDN 200 = new deploy is live.
const MARKER_CHUNK = "0semlxi287im_.js";
const MARKER = "Browse%20other%20categories";
const URL = `https://hayaan.co/_next/static/chunks/${MARKER_CHUNK}`;

for (let i = 1; i <= 40; i++) {
  try {
    const res = await fetch(`${URL}?cb=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.status === 200) {
      const body = await res.text();
      if (body.includes("Browse other categories")) {
        console.error(`LIVE at poll ${i} (~${i * 15}s): ${URL} contains marker`);
        process.exit(0);
      }
      console.error(`poll ${i}: 200 but marker missing (stale?) len=${body.length}`);
    } else {
      console.error(`poll ${i}: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`poll ${i}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.error("TIMEOUT: chunk not live after 40 polls");
process.exit(1);
