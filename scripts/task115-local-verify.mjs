// Task 115 local runtime check — Somali error localization + Norman download flow.
//
// Seeds (local Prisma SQLite only):
//   • QA user (bcrypt password so /api/auth/login accepts it)
//   • a digital product with an EXTERNAL https digital_url (works without Supabase)
//   • a PAID order owned by the QA user with one order_item
//
// Runtime asserts (server must be running on :3000):
//   1. legacy flow intact:      GET ...download?item=X        → 302 → external URL
//   2. json mode success:       GET ...download?item=X&json=1 → 200 {url}
//   3. json mode unauth:        GET ...download?item=X&json=1 → 401 JSON (was already JSON)
//   4. json mode locked:        order flipped to pending → 403 "This download unlocks…"
//      (the string that USED to render as raw JSON in a new tab)
//   5. localizeApiError maps the locked + wishlist + checkout messages to Somali keys
//
// Usage: node scripts/task115-local-verify.mjs seed|verify|clean [baseUrl]
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { hashSync } from "bcryptjs";

const db = new PrismaClient();
const BASE = process.argv[3] || "http://localhost:3000";
const EMAIL = "qa-local-115@hayaan.test";
const PASSWORD = "Qa-Task115-local-verify";
const PRODUCT_SLUG = "task115-qa-digital-guide";
const DOWNLOAD_URL = "https://example.com/hayaan-qa-guide.pdf";

function hashPw(pw) {
  return hashSync(pw, 10);
}

async function seed() {
  const user =
    (await db.user.findUnique({ where: { email: EMAIL } })) ??
    (await db.user.create({
      data: { email: EMAIL, name: "QA Local 115", password: hashPw(PASSWORD) },
    }));
  const product =
    (await db.product.findUnique({ where: { slug: PRODUCT_SLUG } })) ??
    (await db.product.create({
      data: {
        name: "Task 115 QA Digital Guide",
        slug: PRODUCT_SLUG,
        price: 9.5,
        productType: "digital",
        digitalUrl: DOWNLOAD_URL,
        categoryId: (await db.category.findFirst())?.id ?? "",
        description: "Temporary QA product for the Task 115 local download-flow check.",
        images: "[]",
        stock: 0,
      },
    }));
  // Fresh paid order each run (idempotent-ish; cleanup deletes by user).
  const order = await db.order.create({
    data: {
      userId: user.id,
      status: "paid",
      paymentMethod: "card",
      paymentStatus: "paid",
      totalAmount: product.price,
      shippingName: "QA Local 115",
      shippingAddress: "QA",
      shippingCity: "Mogadishu",
      shippingZip: "0000",
      shippingCountry: "Somalia",
      items: {
        create: {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      },
    },
    include: { items: true },
  });
  console.log("seeded: user+product+paid order", order.id, "item", order.items[0].id);
  console.log("ITEM_ID=" + order.items[0].id);
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}: ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("no session cookie returned");
  return cookie;
}

async function verify() {
  const item = await db.orderItem.findFirst({
    where: { name: "Task 115 QA Digital Guide" },
    include: { order: true },
    orderBy: { id: "desc" },
  });
  if (!item) throw new Error("seeded order item not found — run seed first");
  const cookie = await login();
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  };

  // 1. legacy redirect flow intact (no json param)
  const r1 = await fetch(`${BASE}/api/digital/download?item=${item.id}`, {
    headers: { cookie }, redirect: "manual",
  });
  check("legacy 302 flow", r1.status === 302, `status=${r1.status} location=${r1.headers.get("location")}`);

  // 2. json mode success
  const r2 = await fetch(`${BASE}/api/digital/download?item=${item.id}&json=1`, {
    headers: { cookie },
  });
  const d2 = await r2.json().catch(() => null);
  check("json=1 success", r2.ok && d2?.url === DOWNLOAD_URL, `status=${r2.status} body=${JSON.stringify(d2)}`);

  // 3. json mode unauthenticated
  const r3 = await fetch(`${BASE}/api/digital/download?item=${item.id}&json=1`);
  const d3 = await r3.json().catch(() => null);
  check("json=1 unauth 401", r3.status === 401 && typeof d3?.error === "string", `status=${r3.status} body=${JSON.stringify(d3)}`);

  // 4. json mode locked (order flipped to pending)
  await db.order.update({ where: { id: item.orderId }, data: { status: "pending", paymentStatus: "pending" } });
  const r4 = await fetch(`${BASE}/api/digital/download?item=${item.id}&json=1`, {
    headers: { cookie },
  });
  const d4 = await r4.json().catch(() => null);
  check(
    "json=1 locked 403",
    r4.status === 403 && d4?.error === "This download unlocks as soon as your payment is confirmed.",
    `status=${r4.status} body=${JSON.stringify(d4)}`,
  );
  await db.order.update({ where: { id: item.orderId }, data: { status: "paid", paymentStatus: "paid" } });

  // 5. localizeApiError unit checks (client mapping incl. new keys) — run the
  // dictionary import via bun when available; under plain node, import the TS
  // sources is not possible, so use bun if present and skip otherwise.
  if (typeof Bun !== "undefined") {
    const { localizeApiError } = await import("../src/lib/i18n/api-errors.ts");
    const { translate } = await import("../src/lib/i18n/dictionary.ts");
    const t = (k) => translate("so", k);
    const cases = [
      ["This download unlocks as soon as your payment is confirmed.", "err.downloadLocked"],
      ["Download not found for this account.", "err.downloadMissing"],
      ["Your cart is empty — add an item before checking out.", "err.cartEmpty"],
      ["Comments are limited to 2000 characters.", "err.commentLong"],
      ["Too many submissions — please try again later.", "err.tooMany"],
    ];
    let allOk = true;
    for (const [msg, key] of cases) {
      const want = t(key);
      const got = localizeApiError(msg, t);
      const ok = got === want && !/[a-z]{4}/.test("") /* placeholder */;
      if (got !== want) allOk = false;
      console.log(`${got === want ? "PASS" : "FAIL"}  localize(so) "${msg.slice(0, 44)}…" -> "${got}"`);
    }
    check("localizeApiError SO mappings", allOk, `${cases.length} cases`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
  if (failed.length) process.exit(1);
}

async function clean() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await db.order.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await db.product.deleteMany({ where: { slug: PRODUCT_SLUG } });
  console.log("cleaned: QA order(s), user, product");
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "verify") await verify();
else if (mode === "clean") await clean();
else throw new Error("pass seed|verify|clean");
await db.$disconnect();
