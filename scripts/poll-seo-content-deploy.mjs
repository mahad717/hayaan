// Task 73 deploy poll — the SEO posts live on NEW URLs that never existed
// before this deploy, so CDN state is clean: 404 = not deployed, 200 = live.
const URL = "https://hayaan.co/blog/where-to-buy-electronics-online-in-somalia";
for (let i = 1; i <= 40; i++) {
  try {
    const res = await fetch(`${URL}?cb=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.status === 200) {
      const body = await res.text();
      if (body.includes("Where to Buy Electronics Online in Somalia")) {
        console.error(`LIVE at poll ${i} (~${i * 15}s)`);
        process.exit(0);
      }
      console.error(`poll ${i}: 200 but title missing, len=${body.length}`);
    } else {
      console.error(`poll ${i}: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`poll ${i}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.error("TIMEOUT");
process.exit(1);
