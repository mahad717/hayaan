// Task 65 local E2E: import-product API + fulfillment flow against the dev
// server (Prisma mode, admin@shop.demo).
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

// --- auth -----------------------------------------------------------------
await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }) });

// --- import-product: guards ----------------------------------------------
const unauth = await fetch(BASE + "/api/admin/import-product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://www.aliexpress.com/item/x.html" }) });
check("import unauthenticated -> 403", unauth.status === 403);

const bad = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url: "not-a-url" }) });
check("import invalid url -> 400", bad.status === 400);

const ssrf = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url: "http://localhost:3000/api/products" }) });
check("import SSRF guard -> 400", ssrf.status === 400, `got ${ssrf.status}`);

// --- import-product: happy path on a JSON-LD-rich Shopify listing ---------
let draft = null;
try {
  const listRes = await fetch("https://www.allbirds.com/products.json?limit=3", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (listRes.ok) {
    const list = await listRes.json();
    const p = list.products?.[0];
    if (p) {
      const url = `https://www.allbirds.com/products/${p.handle}`;
      const r = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url }) });
      check("import fetches draft -> 200", r.status === 200 && !!r.body?.draft, `status ${r.status}`);
      draft = r.body?.draft;
      if (draft) {
        check("draft has name", typeof draft.name === "string" && draft.name.length > 0, draft.name?.slice(0, 50));
        check("draft has supplierUrl", draft.supplierUrl === url);
        check("draft has images[]", Array.isArray(draft.images) && draft.images.length > 0, `${draft.images.length} imgs`);
        check("draft price parsed", draft.price !== "" && Number(draft.price) > 0, `price ${draft.price}`);
        check("draft source hostname", draft.source === "allbirds.com", draft.source);
      }
    } else check("import happy path", false, "products.json empty");
  } else check("import happy path", false, `products.json ${listRes.status}`);
} catch (e) {
  check("import happy path", false, String(e).slice(0, 80));
}

// blocked/irrelevant page -> graceful 422 (not a crash)
const junk = await api("/api/admin/import-product", { method: "POST", body: JSON.stringify({ url: "https://example.com/" }) });
check("import dataless page -> 422", junk.status === 422, `status ${junk.status}`);

// --- fulfillment flow ------------------------------------------------------
// 1. create a product with supplier sourcing via the admin API
const catRes = await api("/api/categories");
const categoryId = catRes.body?.categories?.[0]?.id;
const prod = await api("/api/products", {
  method: "POST",
  body: JSON.stringify({
    name: "DS Probe Item", description: "dropshipping e2e probe", price: 39.99, categoryId,
    cost: 12.5, supplierUrl: "https://www.aliexpress.com/item/1005006123456789.html", supplierSku: "1005006123456789-black",
  }),
});
check("create supplier product -> 200", prod.status === 200 && !!prod.body?.product?.id, `status ${prod.status} ${JSON.stringify(prod.body).slice(0, 120)}`);
const productId = prod.body?.product?.id;

// 2. public GET must NOT leak supplier fields
const pub = await api(`/api/products/${productId}`);
const pubJson = JSON.stringify(pub.body?.product ?? {});
check("public product hides supplier fields", !pubJson.includes("supplier_url") && !pubJson.includes("aliexpress"));

// 3. seed a PAID order directly via Prisma (Order requires a user relation)
const { default: Prisma } = await import("@prisma/client");
const db = new Prisma.PrismaClient();
let user = await db.user.findFirst({ where: { role: "customer" } });
if (!user) user = await db.user.create({ data: { email: "task65.probe@example.com", name: "DS Probe User", password: "x", role: "customer" } });
const order = await db.order.create({
  data: {
    userId: user.id,
    status: "paid", totalAmount: 41.49, currency: "USD",
    shippingName: "Probe Buyer", shippingPhone: "+252615550009",
    shippingAddress: "Jidka Sodonka", shippingCity: "Hodan", shippingZip: "60013", shippingCountry: "Somalia",
    paymentMethod: "sifalo", paymentStatus: "paid",
    items: { create: [{ productId, name: "DS Probe Item", price: 39.99, quantity: 1 }] },
  },
  include: { items: true },
});
await db.$disconnect();
check("seeded paid order", !!order?.id, order?.id?.slice(0, 8));

// 4. fulfillment GET shows it with supplier info + cost
const ful = await api("/api/admin/fulfillment");
const fo = (ful.body?.orders ?? []).find((o) => o.id === order.id);
check("fulfillment lists paid order", !!fo, `status ${ful.status}`);
check("fulfillment item has supplierUrl", fo?.items?.[0]?.supplierUrl?.includes("aliexpress.com"), fo?.items?.[0]?.supplierUrl ?? "none");
check("fulfillment item has cost", fo?.items?.[0]?.cost === 12.5, `cost ${fo?.items?.[0]?.cost}`);
check("fulfillment has customer block", fo?.customer?.name === "Probe Buyer" && fo?.customer?.city === "Hodan");

// 5. mark shipped -> moves to shipped group
const mv = await api("/api/admin/accounting/order-status", { method: "POST", body: JSON.stringify({ orderId: order.id, status: "shipped" }) });
check("mark shipped -> 200", mv.status === 200, `status ${mv.status}`);
const ful2 = await api("/api/admin/fulfillment");
const fo2 = (ful2.body?.orders ?? []).find((o) => o.id === order.id);
check("order now shipped", fo2?.status === "shipped");

// 5b. deleting a product that orders reference must fail with a clear message
const blockedDel = await api(`/api/products/${productId}`, { method: "DELETE" });
check("delete product with orders -> 400 + friendly message", blockedDel.status === 400 && /Hide it/.test(blockedDel.body?.error ?? ""), `status ${blockedDel.status}`);

// 6. cleanup probe: order first (FK), then product — verifies delete works
//    once references are gone
const { default: Prisma2 } = await import("@prisma/client");
const db2 = new Prisma2.PrismaClient();
await db2.orderItem.deleteMany({ where: { orderId: order.id } });
await db2.order.delete({ where: { id: order.id } });
await db2.$disconnect();
const delRes = await api(`/api/products/${productId}`, { method: "DELETE" });
check("cleanup: product deleted -> 200", delRes.status === 200, `status ${delRes.status} ${JSON.stringify(delRes.body).slice(0, 80)}`);

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
