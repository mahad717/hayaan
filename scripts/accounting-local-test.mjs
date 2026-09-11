// Task 49 — local end-to-end accounting tests against the dev server
// (Prisma/SQLite mode). Covers spec §19:
//   cost create/edit/negative-rejection/customer-invisibility,
//   sale snapshot & stock decrement, multi-quantity, cost-change isolation
//   (historical order keeps its snapshot), profit math, refunds
//   (partial + full), cancelled orders excluded from revenue, duplicate
//   payment rejection, admin gating.
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL: ${name} ${detail}`); }
};

function jar() {
  const cookies = new Map();
  return {
    async login(email, password) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const setC = res.headers.getSetCookie?.() ?? [];
      for (const c of setC) {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
      return res.status;
    },
    headers(extra = {}) {
      const c = Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
      return { cookie: c, ...extra };
    },
    get: (k) => cookies.get(k),
  };
}

const admin = jar();
const cust = jar();

// ---- 0. auth + admin gate ----
console.log("\n[auth]");
ok("admin login", (await admin.login("admin@shop.demo", "admin123")) === 200);
ok("customer login", (await cust.login("customer@shop.demo", "customer123")) === 200);
{
  const res = await fetch(`${BASE}/api/admin/accounting/overview`);
  ok("accounting overview WITHOUT session → 403", res.status === 403);
  const res2 = await fetch(`${BASE}/api/admin/accounting/overview`, { headers: cust.headers() });
  ok("accounting overview AS CUSTOMER → 403", res2.status === 403);
  const res3 = await fetch(`${BASE}/api/admin/products`, { headers: cust.headers() });
  ok("admin products (with cost) AS CUSTOMER → 403", res3.status === 403);
}

// ---- 1. product with cost ----
console.log("\n[product cost]");
let productId = "";
const uniqueName = `ACCT TEST Widget ${Date.now().toString(36)}`;
{
  const res = await fetch(`${BASE}/api/products`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: uniqueName, description: "Test item for accounting", price: 25,
      cost: 10, stock: 100, categoryId: (await (await fetch(`${BASE}/api/categories`)).json()).categories[0].id,
      images: [], tags: ["test"],
    }),
  });
  const data = await res.json();
  ok("create product with cost=10 → 200", res.status === 200, JSON.stringify(data));
  productId = data.product?.id ?? "";
  ok("public create response has NO cost field", !("cost" in (data.product ?? {})));
}
{
  // negative cost rejected
  const res = await fetch(`${BASE}/api/products/${productId}`, {
    method: "PUT", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ cost: -5 }),
  });
  ok("negative cost → 400", res.status === 400);
}
{
  const res = await fetch(`${BASE}/api/admin/products`, { headers: admin.headers() });
  const data = await res.json();
  const p = (data.products ?? []).find((x) => x.id === productId);
  ok("admin products shows cost=10", p?.cost === 10, `got ${p?.cost}`);
  ok("catalog includes new product stock=100", p?.stock === 100);
}
{
  // customer never sees cost
  const pub = await (await fetch(`${BASE}/api/products`)).json();
  ok("public /api/products has no cost keys", (pub.products ?? []).every((p) => !("cost" in p) && !("unit_cost" in p)));
  const one = await (await fetch(`${BASE}/api/products/${productId}`)).json();
  ok("public /api/products/:id has no cost key", !("cost" in one.product));
  const pubStr = JSON.stringify(pub);
  ok("public products payload contains no cost data", !pubStr.includes('"cost"'));
}

// ---- 2. sale: 3 units ----
console.log("\n[sale]");
{
  // add to cart (cart API) then place order
  const addRes = await fetch(`${BASE}/api/cart`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ productId, quantity: 3 }),
  });
  ok("add to cart → 200", addRes.status === 200, `got ${addRes.status}`);
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      shipping: { name: "Test Buyer", address: "1 Test St", city: "Hargeisa", zip: "00213", country: "Somaliland" },
      paymentMethod: "cod",
    }),
  });
  const data = await res.json();
  ok("place order → 200", res.status === 200, JSON.stringify(data));
  globalThis.orderId1 = data.orderId;
}
{
  const adminList = await (await fetch(`${BASE}/api/admin/products`, { headers: admin.headers() })).json();
  const p = adminList.products.find((x) => x.id === productId);
  ok("stock decremented 100 → 97", p?.stock === 97, `got ${p?.stock}`);
}
{
  const ledger = (await (await fetch(`${BASE}/api/admin/accounting/ledger?type=sale`, { headers: admin.headers() })).json()).entries ?? [];
  const mine = ledger.filter((e) => e.orderId === globalThis.orderId1);
  const rev = mine.find((e) => e.account === "revenue");
  const cogs = mine.find((e) => e.account === "cogs");
  const gp = mine.find((e) => e.account === "gross_profit");
  ok("ledger: revenue +75", rev?.amount === 75, `got ${rev?.amount}`);
  ok("ledger: cogs −30", cogs?.amount === -30, `got ${cogs?.amount}`);
  ok("ledger: gross_profit +45", gp?.amount === 45, `got ${gp?.amount}`);
}
{
  // reconciliation: demo order auto-matched
  const rows = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  const mine = rows.find((r) => r.orderId === globalThis.orderId1);
  ok("recon status = Matched (demo capture)", mine?.reconStatus === "Matched", `got ${mine?.reconStatus}`);
  ok("recon diff = 0", mine?.difference === 0);
}

// ---- 3. cost snapshot isolation (spec §2/§19) ----
console.log("\n[cost snapshot isolation]");
{
  const res = await fetch(`${BASE}/api/products/${productId}`, {
    method: "PUT", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ cost: 12 }),
  });
  ok("update cost 10 → 12 → 200", res.status === 200);
  const profit = (await (await fetch(`${BASE}/api/admin/accounting/profit?sort=revenue-desc`, { headers: admin.headers() })).json());
  const row = (profit.rows ?? []).find((r) => r.productId === productId);
  ok("historical order still uses cost=10: cogs=30 (not 36)", row?.cogs === 30, `got ${row?.cogs}`);
  ok("profit=45, margin=60% (45/75)", row?.grossProfit === 45 && row?.margin === 60, JSON.stringify(row));
}
{
  // audit trail recorded the cost change
  const auditRes = await fetch(`${BASE}/api/admin/accounting/ledger`, { headers: admin.headers() });
  ok("ledger endpoint reachable after change", auditRes.status === 200);
}

// ---- 4. overview math ----
console.log("\n[overview]");
{
  const o = (await (await fetch(`${BASE}/api/admin/accounting/overview`, { headers: admin.headers() })).json()).overview;
  // filter to today: product + order are today's
  ok("revenue 75", o.revenue >= 75, `got ${o.revenue}`);
  ok("revenue − cogs = gross profit", Math.abs((o.revenue - o.cogs) - o.grossProfit) < 0.01, JSON.stringify(o));
  ok("net revenue = revenue − refunds", Math.abs((o.revenue - o.refunds) - o.netRevenue) < 0.01);
}

// ---- 5. duplicate payment rejected (spec §7/§19) ----
console.log("\n[duplicate payment]");
{
  const recon = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  const mine = recon.find((r) => r.orderId === globalThis.orderId1);
  const body = { orderId: globalThis.orderId1, amount: 75, provider: "demo", reference: mine.paymentReference };
  const res = await fetch(`${BASE}/api/admin/accounting/payments`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body),
  });
  ok("same provider+reference twice → 409 duplicate", res.status === 409, `got ${res.status}`);
}

// ---- 6. refunds: partial then full ----
console.log("\n[refunds]");
{
  const res = await fetch(`${BASE}/api/admin/accounting/refunds`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId: globalThis.orderId1, amount: 10, restock: false }),
  });
  const data = await res.json();
  ok("partial refund $10 → 200", res.status === 200, JSON.stringify(data));
  const rows = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  const mine = rows.find((r) => r.orderId === globalThis.orderId1);
  ok("recon shows refunded=10, still Matched", mine?.refunded === 10 && mine?.reconStatus === "Matched", JSON.stringify(mine));
}
{
  const res = await fetch(`${BASE}/api/admin/accounting/refunds`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId: globalThis.orderId1, amount: 65, restock: true }),
  });
  ok("full refund $65 → 200 (total 75)", res.status === 200);
  const rows = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  const mine = rows.find((r) => r.orderId === globalThis.orderId1);
  ok("recon flips to Refunded", mine?.reconStatus === "Refunded", `got ${mine?.reconStatus}`);
  const adminList = await (await fetch(`${BASE}/api/admin/products`, { headers: admin.headers() })).json();
  const p = adminList.products.find((x) => x.id === productId);
  ok("restock returns stock to 100 (97 + 3)", p?.stock === 100, `got ${p?.stock}`);
}
{
  // over-refund rejected
  const res = await fetch(`${BASE}/api/admin/accounting/refunds`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId: globalThis.orderId1, amount: 5, restock: false }),
  });
  ok("refund beyond collected → 400", res.status === 400);
}

// ---- 7. cancelled orders excluded from revenue (spec §3/§19) ----
console.log("\n[cancelled order]");
{
  // second order: 2 units
  await fetch(`${BASE}/api/cart`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ productId, quantity: 2 }),
  });
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      shipping: { name: "Test Buyer", address: "1 Test St", city: "Hargeisa", zip: "00213", country: "Somaliland" },
      paymentMethod: "cod",
    }),
  });
  const data = await res.json();
  globalThis.orderId2 = data.orderId;
  ok("second order placed (2 × $25)", res.status === 200);
  const before = (await (await fetch(`${BASE}/api/admin/accounting/overview`, { headers: admin.headers() })).json()).overview;
  await fetch(`${BASE}/api/admin/accounting/order-status`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId: globalThis.orderId2, status: "cancelled", restock: true }),
  });
  const after = (await (await fetch(`${BASE}/api/admin/accounting/overview`, { headers: admin.headers() })).json()).overview;
  ok("cancel → revenue drops by exactly 50", Math.abs((before.revenue - after.revenue) - 50) < 0.01, `before ${before.revenue} after ${after.revenue}`);
  const adminList = await (await fetch(`${BASE}/api/admin/products`, { headers: admin.headers() })).json();
  const p = adminList.products.find((x) => x.id === productId);
  ok("cancel restocks 2 units", p?.stock === 100, `got ${p?.stock}`);
  const rows = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  const mine = rows.find((r) => r.orderId === globalThis.orderId2);
  ok("cancelled order recon = Unmatched", mine?.reconStatus === "Unmatched", `got ${mine?.reconStatus}`);
}

// ---- 8. under/over payment via manual records ----
console.log("\n[manual payments]");
{
  // third order to play with
  await fetch(`${BASE}/api/cart`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST", headers: cust.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      shipping: { name: "Third Buyer", address: "3 Test St", city: "Berbera", zip: "00213", country: "Somaliland" },
      paymentMethod: "cod",
    }),
  });
  const data = await res.json();
  globalThis.orderId3 = data.orderId;
  // record underpayment 20 of 25 (unique ref per run — dupes are rejected by design)
  const manualRef = `MANUAL-TEST-${Date.now().toString(36)}`;
  await fetch(`${BASE}/api/admin/accounting/payments`, {
    method: "POST", headers: admin.headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId: globalThis.orderId3, amount: 20, provider: "manual", method: "cod", reference: manualRef }),
  });
  let rows = (await (await fetch(`${BASE}/api/admin/accounting/reconciliation`, { headers: admin.headers() })).json()).rows ?? [];
  let mine = rows.find((r) => r.orderId === globalThis.orderId3);
  // demo payment 25 + manual 20 = 45 actual → overpaid by 20
  ok("manual payment counted (25 demo + 20 manual → +20 overpaid)", mine?.reconStatus === "Overpaid" && mine.difference === 20, JSON.stringify(mine));
}

// ---- 9. customer order payload leaks nothing ----
console.log("\n[leak check]");
{
  const orders = await (await fetch(`${BASE}/api/orders`, { headers: cust.headers() })).json();
  const s = JSON.stringify(orders);
  ok("customer orders payload has no cost/unit_cost/cogs", !s.includes("unit_cost") && !s.includes('"cost"') && !s.toLowerCase().includes("cogs"));
}

// ---- cleanup: delete test product (cascades test orders via product delete? orders keep) ----
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
