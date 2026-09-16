// Data fix: replace the mislabeled (.png extension, JPEG bytes) product image
// with a clean re-encoded JPEG.
//  1. extract the public anon key from the live bundle
//  2. Supabase password grant with the admin creds -> access_token
//  3. upload /tmp/candle-fixed.jpg to the product-images bucket
//  4. login to hayaan.co (shop_session cookie) -> PUT the product's images
import fs from "fs";

const SUPA = "https://mqyhgyakhfhuctnvezby.supabase.co";
const ADMIN_EMAIL = "gabeyre80@gmail.com";
const ADMIN_PASSWORD = "0AgJ(b1|@N52";
const PRODUCT_ID = "e41f5b1b-a03f-4e5d-8a78-ac8b2578775a";
const POISON = "1788725483330-085f6bde-b327-4b93-8b76-ab85e8af903b.png";
const NEW_NAME = `1788725483330-fixed-${Date.now()}.jpg`;

// --- 1. anon key from live bundle ---
const home = await (await fetch("https://hayaan.co/")).text();
const chunks = [...home.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]);
let anon = null;
for (const c of [...new Set(chunks)]) {
  const js = await (await fetch("https://hayaan.co" + c)).text();
  const m = js.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (m) { anon = m[0]; break; }
}
if (!anon) throw new Error("anon key not found in bundle");
console.log("anon key: ..." + anon.slice(-12));

// --- 2. password grant ---
const grantRes = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const grant = await grantRes.json();
if (!grantRes.ok || !grant.access_token) throw new Error("grant failed: " + JSON.stringify(grant).slice(0, 200));
console.log("access_token: OK (role=" + (grant.user?.role ?? "?") + ")");

// --- 3. storage upload ---
const bytes = fs.readFileSync("/tmp/candle-fixed.jpg");
const upRes = await fetch(`${SUPA}/storage/v1/object/product-images/${NEW_NAME}`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${grant.access_token}`,
    "Content-Type": "image/jpeg",
    "x-upsert": "false",
  },
  body: bytes,
});
const upText = await upRes.text();
if (!upRes.ok) throw new Error("upload failed: " + upText.slice(0, 300));
console.log("uploaded:", NEW_NAME, `(${bytes.length} bytes)`);
const publicUrl = `${SUPA}/storage/v1/object/public/product-images/${NEW_NAME}`;

// verify it serves
const head = await fetch(publicUrl);
console.log("serve check:", head.status, head.headers.get("content-type"), head.headers.get("content-length"));

// --- 4. login to hayaan.co + PUT product ---
const loginRes = await fetch("https://hayaan.co/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
const cookiePairs = setCookie.filter(Boolean).map((c) => c.split(";")[0]);
const cookie = cookiePairs.join("; ");
const loginBody = await loginRes.json().catch(() => null);
console.log("login:", loginRes.status, loginBody?.user?.role ?? JSON.stringify(loginBody).slice(0, 120));
if (!loginRes.ok) throw new Error("login failed");

const getRes = await fetch(`https://hayaan.co/api/products/${PRODUCT_ID}`);
const { product } = await getRes.json();
console.log("current images:", JSON.stringify(product.images));

const newImages = product.images.map((u) => (u.includes(POISON) ? publicUrl : u));
if (!newImages.includes(publicUrl)) newImages.push(publicUrl);

const putRes = await fetch(`https://hayaan.co/api/products/${PRODUCT_ID}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ images: newImages }),
});
const putBody = await putRes.json().catch(() => null);
console.log("PUT:", putRes.status, JSON.stringify(putBody?.product?.images ?? putBody).slice(0, 300));
if (!putRes.ok) throw new Error("PUT failed");

// --- final verify via public API ---
const final = await (await fetch("https://hayaan.co/api/products")).json();
const p = final.products.find((x) => x.id === PRODUCT_ID);
console.log("FINAL images:", JSON.stringify(p.images));
console.log("DONE");
