// Task 71 deploy poll: probe the content-hashed chunk carrying the new City
// picker (marker: acc-city-select) on the CDN, dodging stale HTML caching.
const URL = "https://hayaan.co/_next/static/chunks/23wx76gwmmxt9.js";
const MARKER = "acc-city-select";
for (let i = 1; i <= 40; i++) {
  try {
    const res = await fetch(`${URL}?cb=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const body = await res.text();
    if (res.status === 200 && body.includes(MARKER)) {
      console.error(`LIVE after ${i * 15}s — ${URL} 200 + marker present (${body.length} bytes)`);
      process.exit(0);
    }
    console.error(`try ${i}: status=${res.status} marker=${body.includes(MARKER)}`);
  } catch (e) {
    console.error(`try ${i}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.error("TIMEOUT: marker not found after 10 min");
process.exit(1);
