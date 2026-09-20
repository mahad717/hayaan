// Task 72 SEO hardening — local E2E against the dev server (Prisma mode).
// Covers: dynamic robots.txt, /category/[slug] SSR pages (metadata, JSON-LD,
// product grid, cross-links, 404), PDP og:type=product + price meta +
// category breadcrumb URLs, homepage ItemList JSON-LD, branded 404, sitemap
// category entries.
const BASE = "http://localhost:3000";
const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(cond);
  console.log(line);
};

async function get(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...opts });
  const body = await res.text().catch(() => "");
  return { status: res.status, body };
}
const firstMatch = (re, s) => (s.match(re) ?? [])[1] ?? null;

// --- 1. robots.txt — dynamic route finally wins (stale public/robots.txt deleted)
const robots = await get("/robots.txt");
check("robots.txt 200", robots.status === 200, String(robots.status));
check("robots.txt disallows /admin", robots.body.includes("Disallow: /admin"));
check("robots.txt disallows /api", robots.body.includes("Disallow: /api"));
check("robots.txt disallows /payment", robots.body.includes("Disallow: /payment"));
check("robots.txt declares sitemap", robots.body.includes("Sitemap: https://hayaan.co/sitemap.xml"));

// --- 2. pick a category with products
const catsRes = await get("/api/categories");
const cats = (JSON.parse(catsRes.body).categories ?? []).filter((c) => c.slug !== "acct-test");
check("categories API returns rows", Array.isArray(cats) && cats.length > 0, `${cats.length}`);
let category = null;
const prods = (JSON.parse((await get("/api/products")).body).products ?? []).filter(
  (p) => !p.slug.includes("acct-test"),
);
for (const c of cats) {
  const inCat = prods.filter((p) => p.category?.slug === c.slug);
  if (inCat.length > 0) { category = { ...c, count: inCat.length, sample: inCat[0] }; break; }
}
check("found a category with products", !!category, category ? `${category.slug} x${category.count}` : "none");

// --- 3. /category/[slug] SSR page
if (category) {
  const page = await get(`/category/${category.slug}`);
  check("category page 200", page.status === 200, String(page.status));
  const title = firstMatch(/<title>([^<]*)<\/title>/, page.body);
  check("category title includes name", title?.toLowerCase().includes(category.name.toLowerCase()), title ?? "");
  check("category canonical", page.body.includes(`rel="canonical" href="https://hayaan.co/category/${category.slug}"`));
  check("category h1 present", page.body.includes("<h1"));
  check("category SSR product card", page.body.includes(`/product/${category.sample.slug}`));
  check("category ItemList JSON-LD", page.body.includes('"@type":"ItemList"'));
  check("category CollectionPage JSON-LD", page.body.includes('"@type":"CollectionPage"'));
  check("category BreadcrumbList JSON-LD", page.body.includes('"@type":"BreadcrumbList"'));
  const otherCat = cats.find((c) => c.slug !== category.slug);
  check("category cross-links present", otherCat ? page.body.includes(`href="/category/${otherCat.slug}"`) : false, otherCat?.slug ?? "");
  check("category og:type website", page.body.includes('property="og:type" content="website"'));
}

// --- 4. unknown category -> 404
const missing = await get("/category/definitely-not-a-real-category-xyz");
check("unknown category -> 404", missing.status === 404, String(missing.status));

// --- 5. PDP metadata
const slug = encodeURIComponent(category?.sample?.slug ?? "test");
const pdp = await get(`/product/${slug}`);
check("PDP 200", pdp.status === 200, String(pdp.status));
check("PDP product:price:amount", pdp.body.includes('name="product:price:amount"'));
check("PDP product:price:currency", pdp.body.includes('name="product:price:currency"'));
check("PDP price value correct", pdp.body.includes(`content="${category.sample.price.toFixed(2)}"`));
check("PDP BreadcrumbList -> /category/", /item":"https:\/\/hayaan\.co\/category\//.test(pdp.body) || /item":\s*"https:\/\/hayaan\.co\/category\//.test(pdp.body), "");
check("PDP visible category link", pdp.body.includes('href="/category/'));
check("PDP no hash breadcrumbs", !pdp.body.includes('item":"https://hayaan.co/#'));

// --- 6. homepage ItemList JSON-LD
const home = await get("/");
check("homepage 200", home.status === 200, String(home.status));
check("homepage ItemList JSON-LD", home.body.includes('"@type":"ItemList"'));
check("homepage product URLs in ItemList", home.body.includes('"url":"https://hayaan.co/product/'));

// --- 7. branded 404
const nf = await get("/nonexistent-page-404-test");
check("404 status", nf.status === 404, String(nf.status));
check("404 branded headline", nf.body.includes("wandered off the map"));
check("404 links to deals", nf.body.includes('href="/deals"'));
check("404 noindex", nf.body.includes("noindex"));

// --- 8. sitemap has category entries
const sm = await get("/sitemap.xml");
check("sitemap 200", sm.status === 200, String(sm.status));
check("sitemap contains /category/ URLs", sm.body.includes("<loc>https://hayaan.co/category/"));

const fails = results.filter((r) => !r).length;
console.error(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
