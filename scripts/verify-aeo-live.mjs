// Task 77 — live verification of the AEO deployment on https://hayaan.co.
// Checks: robots.txt AI-crawler rules, /llms.txt, /llms-full.txt catalog,
// FAQPage JSON-LD + visible FAQ (home, category, blog), HowTo schema,
// quick-answer block, and that sitemap still resolves. Read-only GETs.
const BASE = "https://hayaan.co";
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { "User-Agent": "hayaan-task77-verify" } });
  return { status: r.status, text: await r.text() };
};

// 1. robots.txt
const robots = await get("/robots.txt");
ok("robots.txt 200", robots.status === 200);
for (const ua of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
  ok(`robots allows ${ua}`, robots.text.includes(`User-Agent: ${ua}`));
}
ok("robots keeps /admin disallowed", /User-Agent: \*[\s\S]*Disallow: \/admin/.test(robots.text));
ok("robots sitemap line", robots.text.includes("https://hayaan.co/sitemap.xml"));

// 2. llms.txt
const llms = await get("/llms.txt");
ok("llms.txt 200", llms.status === 200);
ok("llms.txt H1 brand", llms.text.startsWith("# Hayaan Market"));
ok("llms.txt has categories", (llms.text.match(/\(https:\/\/hayaan\.co\/category\//g) || []).length >= 5);
ok("llms.txt links full catalog", llms.text.includes("/llms-full.txt"));
ok("llms.txt payment+shipping facts", llms.text.includes("Sifalo Pay") && llms.text.includes("$75"));

// 3. llms-full.txt
const full = await get("/llms-full.txt");
ok("llms-full.txt 200", full.status === 200);
const bullets = (full.text.match(/^- \[/gm) || []).length;
ok("llms-full catalog size", bullets >= 90, `${bullets} bullets`);
ok("llms-full has product URLs", full.text.includes("https://hayaan.co/product/"));
ok("llms-full has categories", full.text.includes("## Computers & TV"));
ok("llms-full has buyer guides", full.text.includes("## Buyer guides"));

// 4. homepage FAQPage + visible footer FAQ
const home = await get("/");
ok("home 200", home.status === 200);
ok("home FAQPage JSON-LD", home.text.includes('"@type":"FAQPage"'));
ok("home visible FAQ (footer)", home.text.includes("How do I order from Hayaan Market?"));
ok("home schema has support answer", home.text.includes("support@hayaan.co"));

// 5. category page
const cat = await get("/category/computers-tv-gaming");
ok("category 200", cat.status === 200);
ok("category FAQPage JSON-LD", cat.text.includes('"@type":"FAQPage"'));
ok("category visible FAQ", cat.text.includes("How much does a smart TV cost in Somalia?"));
ok("category keeps CollectionPage", cat.text.includes('"@type":"CollectionPage"'));

// 6. blog post
const post = await get("/blog/online-shopping-in-somalia-how-it-works");
ok("post 200", post.status === 200);
ok("post HowTo JSON-LD", post.text.includes('"@type":"HowTo"'));
ok("post FAQPage JSON-LD", post.text.includes('"@type":"FAQPage"'));
ok("post Quick answer block", post.text.includes("Quick answer"));
const post2 = await get("/blog/where-to-buy-electronics-online-in-somalia");
ok("post2 FAQPage JSON-LD", post2.text.includes('"@type":"FAQPage"'));
ok("post2 Quick answer block", post2.text.includes("Quick answer"));

// 7. regression: other pages still fine
const sitemap = await get("/sitemap.xml");
ok("sitemap 200", sitemap.status === 200);
ok("sitemap has blog URLs", sitemap.text.includes("/blog/where-to-buy-electronics"));
const pdp = await get("/product/tv-samsung-85-inch-smart");
ok("PDP 200 + Product schema", pdp.status === 200 && pdp.text.includes('"@type":"Product"'));
const blogIndex = await get("/blog");
ok("blog index 200", blogIndex.status === 200);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
