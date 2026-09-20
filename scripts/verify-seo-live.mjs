// Task 72 live verification — production checks after deploy.
const BASE = "https://hayaan.co";
const results = [];
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
  results.push(cond);
};
const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }, redirect: "manual" });
  return { status: res.status, body: await res.text().catch(() => "") };
};
const firstMatch = (re, s) => (s.match(re) ?? [])[1] ?? null;

// 1. robots.txt — dynamic version finally serves (was shadowed by stale static file)
const robots = await get("/robots.txt");
check("live robots.txt 200", robots.status === 200, String(robots.status));
check("live robots Disallow /admin", robots.body.includes("Disallow: /admin"));
check("live robots Disallow /api", robots.body.includes("Disallow: /api"));
check("live robots Disallow /payment", robots.body.includes("Disallow: /payment"));
check("live robots Sitemap line", robots.body.includes("Sitemap: https://hayaan.co/sitemap.xml"));

// 2. category page on live data
const cats = (JSON.parse((await get("/api/categories")).body).categories ?? []);
check("live categories present", cats.length > 0, `${cats.length}`);
const prods = (JSON.parse((await get("/api/products")).body).products ?? []);
const cat = cats.find((c) => prods.some((p) => p.category?.slug === c.slug));
if (cat) {
  const page = await get(`/category/${cat.slug}`);
  check("live category page 200", page.status === 200, String(page.status));
  check("live category canonical", page.body.includes(`rel="canonical" href="https://hayaan.co/category/${cat.slug}"`));
  check("live category ItemList LD", page.body.includes('"@type":"ItemList"'));
  check("live category CollectionPage LD", page.body.includes('"@type":"CollectionPage"'));
  check("live category SSR products", page.body.includes('href="/product/'));
  const title = firstMatch(/<title>([^<]*)<\/title>/, page.body);
  check("live category title", title?.toLowerCase().includes(cat.name.toLowerCase()), title ?? "");
}

// 3. PDP product meta
const sample = prods.find((p) => p.category?.slug === cat?.slug);
if (sample) {
  const pdp = await get(`/product/${encodeURIComponent(sample.slug)}`);
  check("live PDP 200", pdp.status === 200, String(pdp.status));
  check("live PDP product:price:amount", pdp.body.includes('name="product:price:amount"'));
  check("live PDP price value", pdp.body.includes(`content="${sample.price.toFixed(2)}"`));
  check("live PDP breadcrumb -> /category/", pdp.body.includes("hayaan.co/category/"));
  check("live PDP no #hash breadcrumbs", !pdp.body.includes('item":"https://hayaan.co/#'));
}

// 4. homepage ItemList
const home = await get("/");
check("live homepage ItemList LD", home.body.includes('"@type":"ItemList"'));

// 5. branded 404
const nf = await get("/no-such-page-xyz-check");
check("live 404 status", nf.status === 404, String(nf.status));
check("live 404 branded", nf.body.includes("wandered off the map"));

// 6. sitemap category entries
const sm = await get("/sitemap.xml");
check("live sitemap /category/ URLs", sm.body.includes("<loc>https://hayaan.co/category/"));

const fails = results.filter((r) => !r).length;
console.error(`\n${results.length - fails}/${results.length} live checks passed`);
process.exit(fails ? 1 : 0);
