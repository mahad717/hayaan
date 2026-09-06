// One-off: replace dead (HTTP 404) product images with verified working ones.
// 1. Logs in as admin  2. Uploads each replacement to Supabase Storage via
// /api/admin/upload  3. PUTs the affected products' images arrays.
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.BASE_URL ?? "https://hayaan.co";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@shop.demo";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

const DIR = resolve(import.meta.dir, "img-candidates");

// productId -> { replace: index being replaced | null (rebuild array), images: final spec }
// Spec entries: { upload: filename } = new file; string = keep existing URL.
const PLAN: Record<string, { upload: string; keepUrls: string[]; note: string }> = {
  "3d1d24e9-7d1c-4225-bbda-55b4612267ea": {
    // Carry Canvas Tote — img[1] 404s
    upload: "c-tote1.jpg",
    keepUrls: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop"],
    note: "Carry Canvas Tote",
  },
  "ba16e879-d211-42db-ac44-d453d4ddd31c": {
    // Foundry Heavyweight Sweatshirt — img[1] 404s
    upload: "c-sweat2.jpg",
    keepUrls: ["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop"],
    note: "Foundry Heavyweight Sweatshirt",
  },
  "e41f5b1b-a03f-4e5d-8a78-ac8b2578775a": {
    // Meadow Soy Candle — img[0] 404s; img[1] shows ceramic pots (wrong subject) → single new image
    upload: "gen-candle.png",
    keepUrls: [],
    note: "Meadow Soy Candle",
  },
  "a551b402-dcf9-42bf-a6eb-7d38ac0d9ed1": {
    // Sable Ceramic Vase — img[0] 404s; img[1] shows an armchair (wrong subject) → single new image
    upload: "c-vase1.jpg",
    keepUrls: [],
    note: "Sable Ceramic Vase",
  },
  "63089eb1-d56a-4d3f-bc49-236297ca24d8": {
    // Nimbus Mechanical Keyboard — img[1] 404s
    upload: "d-kb4.jpg",
    keepUrls: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop"],
    note: "Nimbus Mechanical Keyboard",
  },
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main() {
  // 1. Admin session
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) {
    console.error("Login failed:", login.status, (await login.text()).slice(0, 200));
    process.exit(1);
  }
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("Logged in as admin ✓");

  // 2. Upload replacements
  const uploaded = new Map<string, string>();
  for (const [id, plan] of Object.entries(PLAN)) {
    const bytes = readFileSync(resolve(DIR, plan.upload));
    const ext = plan.upload.slice(plan.upload.lastIndexOf("."));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: MIME_BY_EXT[ext] }), plan.upload);
    const up = await fetch(`${BASE}/api/admin/upload`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    });
    if (!up.ok) {
      console.error(`Upload failed for ${plan.note}:`, up.status, (await up.text()).slice(0, 200));
      process.exit(1);
    }
    const { url } = (await up.json()) as { url: string };
    uploaded.set(id, url);
    console.log(`Uploaded ${plan.upload} → ${url}`);
  }

  // 3. Update product images arrays
  let ok = 0;
  for (const [id, plan] of Object.entries(PLAN)) {
    const images = [...plan.keepUrls, uploaded.get(id)!];
    const put = await fetch(`${BASE}/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ images }),
    });
    if (put.ok) {
      ok++;
      console.log(`✓ ${plan.note} → ${images.length} image(s)`);
    } else {
      console.error(`✗ ${plan.note}:`, put.status, (await put.text()).slice(0, 200));
    }
  }
  console.log(`Updated ${ok}/${Object.keys(PLAN).length} products.`);
}

main();
