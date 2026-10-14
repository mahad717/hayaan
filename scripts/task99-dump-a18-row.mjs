// Task 99 — dump the live A18 blog DB row (price mentions + timestamps) to
// resolve whether the DB shadow row wins over the code post and what it holds.
const BASE = "https://hayaan.co";
const EMAIL = process.env.ADMIN_EMAIL || "admin@hayaan.demo";
const PASS = process.env.ADMIN_PASS || "admin123";

const seed = await fetch(`${BASE}/api/seed`, { method: "POST" });
const setCookie = (seed.headers.get("set-cookie") || "").split(";")[0];

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: setCookie },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
const authCookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .join("; ");

const list = await fetch(`${BASE}/api/admin/blog`, { headers: { cookie: authCookie } });
const rows = await list.json();
const posts = Array.isArray(rows) ? rows : rows.posts ?? rows.data ?? [];
console.log("total DB rows:", posts.length);
for (const p of posts) {
  console.log("---");
  console.log("id:", p.id);
  console.log("slug:", p.slug);
  console.log("title:", p.title);
  console.log("updatedAt:", p.updatedAt, "| createdAt:", p.createdAt, "| publishedAt:", p.publishedAt);
  const c = p.content || "";
  console.log("content $187:", (c.match(/\$187/g) || []).length, "| $190:", (c.match(/\$190/g) || []).length, "| 256GB:", (c.match(/256GB/gi) || []).length);
  const qa = p.quickAnswer || "";
  console.log("quickAnswer present:", qa.length > 0, "| qa $187:", (qa.match(/\$187/g) || []).length, "| qa $190:", (qa.match(/\$190/g) || []).length);
  console.log("faqs:", Array.isArray(p.faqs) ? p.faqs.length : p.faqs ? "non-array" : (p.faqs_count ?? "missing"));
}
