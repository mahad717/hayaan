// Task 66 deploy poll: wait until the LIVE /admin page references a chunk
// containing the new marker strings from this fix, then verify the API route
// behavior markers. Admin chunks are route-split — the homepage HTML never
// references them, so we fetch /admin's HTML directly.
const BASE = "https://hayaan.co";
const MARKERS = ["Add the product manually with this URL", "anti-bot challenge"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const start = Date.now();
const deadline = 10 * 60 * 1000;

while (Date.now() - start < deadline) {
  try {
    const adminHtml = await (await fetch(`${BASE}/admin`, { cache: "no-store" })).text();
    const chunks = [...new Set([...adminHtml.matchAll(/\/_next\/static\/chunks\/([a-z0-9._-]+\.js)/gi)].map((m) => m[1]))];
    let found = [];
    for (const c of chunks) {
      const body = await (await fetch(`${BASE}/_next/static/chunks/${c}`, { cache: "no-store" })).text();
      for (const m of MARKERS) if (body.includes(m)) found.push(`${c} :: ${m.slice(0, 40)}`);
    }
    console.log(new Date().toISOString(), `chunks=${chunks.length} found=${found.length}`);
    if (found.length === MARKERS.length) {
      console.log("DEPLOYED ✓");
      found.forEach((f) => console.log("  ", f));
      process.exit(0);
    }
  } catch (e) {
    console.log("poll error:", String(e).slice(0, 100));
  }
  await sleep(25000);
}
console.log("TIMEOUT — markers not found within 10 min");
process.exit(1);
