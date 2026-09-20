// Task 73 live verification — SEO content on production.
const BASE = "https://hayaan.co";
const results = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
  results.push(cond);
};
const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { "User-Agent": "Mozilla/5.0" } });
  return { status: res.status, body: await res.text().catch(() => "") };
};

const POSTS = [
  "where-to-buy-electronics-online-in-somalia",
  "how-to-buy-phones-online-in-somalia",
  "buying-health-supplements-online-in-somalia",
  "setting-up-a-home-office-in-somalia",
  "online-shopping-in-somalia-how-it-works",
];

// 1. blog index lists all 5 guides (+ any owner posts)
const idx = await get("/blog");
check("blog index 200", idx.status === 200, String(idx.status));
for (const p of POSTS) check(`blog index lists ${p}`, idx.body.includes(`/blog/${p}`));

// 2. each post: 200, BlogPosting LD, internal category links, canonical
for (const p of POSTS) {
  const page = await get(`/blog/${p}`);
  check(`post ${p} 200`, page.status === 200, String(page.status));
  check(`post ${p} BlogPosting LD`, page.body.includes('"@type":"BlogPosting"'));
  check(`post ${p} internal /category/ links`, page.body.includes('href="https://hayaan.co/category/'));
  check(`post ${p} canonical`, page.body.includes(`rel="canonical" href="${BASE}/blog/${p}"`));
}

// 3. category pages now carry the SEO descriptions (meta + visible + JSON-LD)
const catChecks = [
  ["computers-tv-gaming", "Buy TVs, laptops, projectors"],
  ["health-supplements", "Buy genuine vitamins"],
  ["home-office", "Set up your home office"],
  ["phones-wearables", "Buy smartphones, smartwatches"],
  ["power-charging-audio", "Buy power banks, chargers"],
];
for (const [slug, marker] of catChecks) {
  const page = await get(`/category/${slug}`);
  check(`category ${slug} 200`, page.status === 200, String(page.status));
  check(`category ${slug} meta description`, page.body.includes(marker));
  check(`category ${slug} CollectionPage LD`, page.body.includes('"@type":"CollectionPage"'));
}

// 4. sitemap: posts + categories
const sm = await get("/sitemap.xml");
for (const p of POSTS) check(`sitemap has /blog/${p}`, sm.body.includes(`<loc>${BASE}/blog/${p}</loc>`));
check("sitemap has categories", sm.body.includes("<loc>https://hayaan.co/category/"));

const fails = results.filter((r) => !r).length;
console.error(`\n${results.length - fails}/${results.length} live checks passed`);
process.exit(fails ? 1 : 0);
