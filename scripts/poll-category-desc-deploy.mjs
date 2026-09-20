// Task 73 deploy poll #2 — waits until the category page serves the new
// SEO description (the second Task 73 commit replaces short DB stubs).
const URL = "https://hayaan.co/category/computers-tv-gaming";
const MARKER = "Buy TVs, laptops, projectors";
for (let i = 1; i <= 60; i++) {
  try {
    const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (res.status === 200) {
      const body = await res.text();
      if (body.includes(MARKER)) {
        console.error(`LIVE at poll ${i} (~${i * 30}s)`);
        process.exit(0);
      }
      console.error(`poll ${i}: 200, stub still served (bundle ${i === 1 ? "" : "still "}old)`);
    } else {
      console.error(`poll ${i}: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`poll ${i}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 30000));
}
console.error("TIMEOUT after 30 min");
process.exit(1);
