// Task 73 — SEO category descriptions on LIVE (admin-gated PATCH).
const BASE = "https://hayaan.co";
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

const login = await api("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
if (!login.body?.user || login.body.user.role !== "admin") {
  console.error("LOGIN FAILED", login.status, JSON.stringify(login.body)?.slice(0, 200));
  process.exit(1);
}
console.error("logged in as", login.body.user.email);

const DESCRIPTIONS = {
  "computers-tv-gaming":
    "Buy TVs, laptops, projectors and gaming consoles online in Somalia at Hayaan Market — Samsung and LG smart TVs, MacBook laptops, PlayStation consoles and projectors, checked before dispatch and delivered to your door with secure Sifalo Pay checkout.",
  "health-supplements":
    "Buy genuine vitamins and health supplements online in Somalia — multivitamins, immunity support and daily essentials, quality-checked before dispatch and delivered nationwide by Hayaan Market with secure Sifalo Pay checkout.",
  "home-office":
    "Set up your home office in Somalia in one order — printers, toner, studio lights, microphones and desk essentials at market-fair prices, delivered across the country with secure Sifalo Pay checkout from Hayaan Market.",
  "phones-wearables":
    "Buy smartphones, smartwatches and earbuds online in Somalia — iPhone, Samsung Galaxy and Apple Watch models plus budget-friendly picks, quality-checked before dispatch and delivered nationwide with Sifalo Pay.",
  "power-charging-audio":
    "Buy power banks, chargers, headphones and speakers online in Somalia — reliable charging and audio gear for frequent outages and everyday listening, delivered to your door by Hayaan Market with Sifalo Pay.",
};

const cats = (await (await fetch(BASE + "/api/categories")).json()).categories;
let fails = 0;
for (const c of cats) {
  const description = DESCRIPTIONS[c.slug];
  if (!description) { console.log(`SKIP — ${c.slug} (no description written)`); continue; }
  const res = await api(`/api/admin/categories/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({ description }),
  });
  const ok = res.status === 200 && res.body?.category?.description === description;
  console.log(`${ok ? "PASS" : "FAIL"} — ${c.slug} (${res.status}) ${ok ? "" : JSON.stringify(res.body).slice(0, 150)}`);
  if (!ok) fails++;
}
console.error(fails ? `${fails} FAILURES` : "ALL CATEGORY DESCRIPTIONS UPDATED");
process.exit(fails ? 1 : 0);
