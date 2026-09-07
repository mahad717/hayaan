// Task 40 — E2E test of the restored /api/admin/upload on https://hayaan.co
// 1) admin login → 2) multipart upload of a real PNG (explicit Blob MIME —
// without it the API 415s) → 3) assert {url} → 4) GET the URL → 200 image.
// Run: env -u <proxies> bun scripts/test-upload-e2e.ts

const BASE = "https://hayaan.co";

// Minimal valid 8x8 red PNG (real image bytes, not a fake header)
const pngB64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8DwnwEPYMInOWwUAG9kAe/oGkGhAAAAAElFTkSuQmCC";
const pngBytes = Buffer.from(pngB64, "base64");

// 1) Admin login
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@shop.demo", password: "admin123" }),
});
const loginBody = await loginRes.json().catch(() => ({}));
console.log("login:", loginRes.status, loginBody.user?.email ?? JSON.stringify(loginBody).slice(0, 120));
if (!loginRes.ok) process.exit(1);
const setCookie = loginRes.headers.get("set-cookie");
if (!setCookie) {
  console.log("FAIL: no set-cookie from login");
  process.exit(1);
}
const cookie = setCookie.split(";")[0];

// 2) Upload
const fd = new FormData();
fd.append("file", new Blob([pngBytes], { type: "image/png" }), "task40-verify.png");
const upRes = await fetch(`${BASE}/api/admin/upload`, {
  method: "POST",
  headers: { cookie },
  body: fd,
});
const upBody = await upRes.json().catch(() => ({} as { url?: string; error?: string }));
console.log("upload:", upRes.status, upBody.url ?? JSON.stringify(upBody));
if (!upRes.ok || !upBody.url) process.exit(1);

// 3) The stored URL must be publicly fetchable
const imgRes = await fetch(upBody.url);
console.log("fetch stored url:", imgRes.status, imgRes.headers.get("content-type"), `${imgRes.headers.get("content-length")}B`);
const ok = imgRes.ok && (imgRes.headers.get("content-type") ?? "").startsWith("image/");

// 4) Cleanup: delete the verification object so the bucket stays clean.
//    No direct Supabase creds in the sandbox env — leave a note instead.
console.log(ok ? (upBody.url.includes("product-images") ? "PASS: upload works end-to-end (product-images bucket)" : "PASS: upload works, but URL is not the product-images bucket?") : "FAIL: stored URL not fetchable");
process.exit(ok ? 0 : 1);
