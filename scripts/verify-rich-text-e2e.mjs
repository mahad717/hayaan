// Task 69 local E2E: rich-text product descriptions.
// Against the dev server (Prisma mode, admin@shop.demo):
//  1. POST with a hostile formatted description -> sanitized on save
//     (keeps b/i/ul/li/p; strips script/iframe/onclick/href/a).
//  2. Sanitized HTML persists (GET).
//  3. Legacy plain-text description round-trips UNCHANGED (no <p> injected).
//  4. Somali template translation still matches a FORMATTED description
//     (PDP with hayaan_lang=so renders the Somali template text).
//  5. PDP (en) renders the rich HTML; meta/JSON-LD carry plain text only.
//  6. Google feed carries plain text (no tags) in <description>.
//  7. PUT can replace a formatted description with plain text.
const BASE = "http://localhost:3000";
let cookie = "";

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

const results = [];
const check = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`;
  results.push(line);
  console.log(line);
};

await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }) });

const catRes = await api("/api/categories");
const categoryId = catRes.body?.categories?.[0]?.id;

// 1. hostile formatted description -------------------------------------------------
const HOSTILE = '<p><b>Energy boost</b> with <i>vitamins</i></p><script>alert("xss")</script>'
  + '<p onclick="evil()">Immune support</p><ul><li>Vitamin C</li><li>Zinc</li></ul>'
  + '<iframe src="http://evil.example"></iframe><p>Trust us <a href="javascript:alert(1)">click</a></p>';
const rich = await api("/api/products", {
  method: "POST",
  body: JSON.stringify({ name: "Rich Text Probe", description: HOSTILE, price: 9.99, categoryId }),
});
const rdesc = rich.body?.product?.description ?? "";
check("create rich product -> 200", rich.status === 200 && !!rich.body?.product?.id, `status ${rich.status}`);
check("keeps bold/italic/list markup", rdesc.includes("<b>Energy boost</b>") && rdesc.includes("<i>vitamins</i>") && rdesc.includes("<ul><li>Vitamin C</li><li>Zinc</li></ul>"), rdesc.slice(0, 90));
check("strips script tag + content", !rdesc.includes("script") && !rdesc.includes("alert"), "no script/alert");
check("strips iframe", !rdesc.includes("iframe") && !rdesc.includes("evil.example"));
check("strips event handlers", !rdesc.includes("onclick") && !rdesc.includes("evil()"));
check("strips link tags + javascript: urls", !rdesc.includes("<a") && !rdesc.includes("javascript:"));
const richId = rich.body?.product?.id;

// 2. persistence --------------------------------------------------------------------
const getRich = await api(`/api/products/${richId}`);
check("sanitized description persists", getRich.body?.product?.description === rdesc);

// 3. legacy plain text round-trip ----------------------------------------------------
const plain = await api("/api/products", {
  method: "POST",
  body: JSON.stringify({ name: "Plain Text Probe", description: "Line one\n\nLine two", price: 5, categoryId }),
});
check("plain-text description unchanged", plain.body?.product?.description === "Line one\n\nLine two", JSON.stringify(plain.body?.product?.description));
const plainId = plain.body?.product?.id;

// 4. Somali template matcher on a FORMATTED description ------------------------------
const SOMALI_DESC = "<p>Keep your phones and gear powered through every outage. <b>RichMatch Widget</b> is tested, genuine stock available now at Hayaan Market — order today for fast delivery across Somalia, paying by card or Sifalo.</p>";
const soProd = await api("/api/products", {
  method: "POST",
  body: JSON.stringify({ name: "Rich Somali Probe", description: SOMALI_DESC, price: 3, categoryId }),
});
const soSlug = soProd.body?.product?.slug;
const soId = soProd.body?.product?.id;
check("somali probe created", !!soSlug, soSlug ?? "");

const soPdp = await fetch(`${BASE}/product/${soSlug}`, { headers: { cookie: "hayaan_lang=so" } });
const soHtml = await soPdp.text();
check("so PDP shows Somali template for formatted desc", soHtml.includes("Korontada la&#x27;aanta") || soHtml.includes("Korontada"), "Somali marker");
// The raw English description still lives in the RSC flight payload (initial
// product prop — same as pre-Task-69); assert the RENDERED description
// element itself is Somali-only.
const soPEl = /<p class="max-w-prose whitespace-pre-line[^"]*">([\s\S]*?)<\/p>/.exec(soHtml);
check("so PDP description element is Somali-only", !!soPEl && soPEl[1].includes("Korontada") && !soPEl[1].includes("Keep your phones"), soPEl?.[1]?.slice(0, 60));

const enPdp = await fetch(`${BASE}/product/${soProd.body?.product?.slug}`);
const enHtml = await enPdp.text();
check("en PDP renders rich markup", enHtml.includes("<b>RichMatch Widget</b>"), "bold tag in SSR HTML");

// 5. PDP for hostile product: rich render + safe metadata ----------------------------
const richProd = (await api("/api/products")).body.products.find((p) => p.id === richId);
const pdp = await (await fetch(`${BASE}/product/${richProd.slug}`)).text();
check("PDP renders bold markup", pdp.includes("<b>Energy boost</b>"));
check("PDP renders bullet list", pdp.includes("<li>Vitamin C</li>"));
check("PDP HTML has no script/onclick/iframe from description", !pdp.includes("alert(") && !pdp.includes("onclick=\"evil()") && !pdp.includes("<iframe"));
check("PDP JSON-LD description is plain text", /"description":"[^"]*Energy boost with vitamins/.test(pdp) && !/"description":"[^"]*<b>/.test(pdp));
check("PDP meta description is plain text", !pdPMetaBad(pdp));
function pdPMetaBad(html) {
  const m = /<meta name="description" content="([^"]*)"/.exec(html);
  return !m || /[<>]/.test(m[1]);
}

// 6. Google feed clean ---------------------------------------------------------------
const feed = await (await fetch(`${BASE}/feeds/google-products.xml`)).text();
check("feed has plain description text", feed.includes("Energy boost with vitamins"));
check("feed description has no tags", !/<description>[^<]*<b>/.test(feed) && !/<description>[^<]*onclick/.test(feed));

// 7. PUT replaces formatted with plain ------------------------------------------------
const put = await api(`/api/products/${richId}`, {
  method: "PUT",
  body: JSON.stringify({ description: "Now a simple description" }),
});
check("PUT to plain description persists", put.body?.product?.description === "Now a simple description", JSON.stringify(put.body?.product?.description));

// 8. cleanup --------------------------------------------------------------------------
for (const id of [richId, plainId, soId].filter(Boolean)) {
  const del = await api(`/api/products/${id}`, { method: "DELETE" });
  check(`cleanup delete ${id.slice(-6)}`, del.status === 200 || del.status === 204, `status ${del.status}`);
}

const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
