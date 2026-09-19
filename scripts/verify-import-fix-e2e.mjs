// Task 66 local E2E: "Fetch details does nothing" fix verification.
// Against the dev server (Prisma mode, admin@shop.demo):
//  1. Import guards still hold (403/400).
//  2. Alibaba URL -> 422 with blocked=true + actionable anti-bot message.
//  3. AliExpress URL -> 422 with blocked=true (tiny JS shell page).
//  4. Shopify listing -> 200 draft extraction still works (regression).
//  5. Product create + update with supplier fields still persist (Prisma).
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

// --- auth ------------------------------------------------------------------
await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }) });

const unauth = await fetch(BASE + "/api/admin/import-product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://www.alibaba.com/product-detail/x.html" }) });
check("import unauthenticated -> 403", unauth.status === 403);

// --- Alibaba: anti-bot punish page (HTTP 200, zero product data) -----------
const ALIBABA_URL = "https://www.alibaba.com/product-detail/100000mAh-Large-Capacity-PD-22-5W-Portable-Battery-Power-Station-With-Cable-1600111931204.html";
const alibaba = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url: ALIBABA_URL }) });
check("alibaba import -> 422", alibaba.status === 422, `got ${alibaba.status}`);
check("alibaba response blocked=true", alibaba.body?.blocked === true, JSON.stringify(alibaba.body?.blocked));
check(
  "alibaba message names anti-bot + manual shortcut",
  /anti-bot challenge/.test(alibaba.body?.error ?? "") && /Add the product manually/.test(alibaba.body?.error ?? ""),
  (alibaba.body?.error ?? "").slice(0, 90),
);

// --- AliExpress: tiny JS shell --------------------------------------------
const ali = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url: "https://www.aliexpress.com/item/1005006459270729.html" }) });
check("aliexpress import -> 422", ali.status === 422, `got ${ali.status}`);
check("aliexpress response blocked=true", ali.body?.blocked === true);

// --- Shopify listing regression -------------------------------------------
let draft = null;
try {
  const listRes = await fetch("https://www.allbirds.com/products.json?limit=3", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (listRes.ok) {
    const p = (await listRes.json()).products?.[0];
    if (p) {
      const url = `https://www.allbirds.com/products/${p.handle}`;
      const r = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url }) });
      check("shopify import -> 200 draft", r.status === 200 && !!r.body?.draft, `status ${r.status}`);
      draft = r.body?.draft;
      if (draft) {
        check("draft has name + supplierUrl", typeof draft.name === "string" && draft.supplierUrl === url, draft.name?.slice(0, 40));
        check("draft has images", Array.isArray(draft.images) && draft.images.length > 0, `${draft.images?.length} imgs`);
      }
    } else check("shopify regression", false, "products.json empty");
  } else check("shopify regression", false, `products.json ${listRes.status}`);
} catch (e) {
  check("shopify regression", false, String(e).slice(0, 80));
}

// --- product create/update with supplier fields (Prisma path) -------------
const cats = await api("/api/categories");
const categoryId = cats.body?.categories?.[0]?.id;
const stamp = Date.now();
const created = await api("/api/products", {
  method: "POST",
  body: JSON.stringify({
    name: `T66 SupCol Check ${stamp}`,
    description: "Temporary product created by the task 66 E2E — deleted at the end of the run.",
    price: 49.5,
    categoryId,
    images: [],
    tags: [],
    supplierUrl: "https://www.alibaba.com/product-detail/test-check.html",
    supplierSku: "T66-SKU-1",
  }),
});
check("create with supplierUrl -> ok", created.status === 200 && !!created.body?.product?.id, `status ${created.status}`);
const pid = created.body?.product?.id;
if (pid) {
  check("created product keeps supplierUrl", created.body.product.supplierUrl === "https://www.alibaba.com/product-detail/test-check.html");
  const upd = await api(`/api/products/${pid}`, { method: "PUT", body: JSON.stringify({ supplierSku: "T66-SKU-2", price: 55 }) });
  check("update supplierSku -> ok", upd.status === 200 && upd.body?.product?.supplierSku === "T66-SKU-2", `status ${upd.status}`);
  const del = await api(`/api/products/${pid}`, { method: "DELETE" });
  check("cleanup delete -> ok", del.status === 200, `status ${del.status}`);
}

const failed = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(0);
