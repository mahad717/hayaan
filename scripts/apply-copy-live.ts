// One-off: apply the new benefit-focused product names/descriptions to the
// LIVE Supabase catalog via the admin API (same validation as the admin UI).
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(process.cwd(), ".env") });

const BASE = process.env.BASE_URL ?? "https://hayaan.co";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@shop.demo";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

const UPDATES: Record<string, { name: string; description: string }> = {
  "aurora-wireless-headphones": {
    name: "Aurora Wireless Headphones — immersive sound, no wires",
    description:
      "Noise fades out; your music comes forward. Aurora pairs active noise cancellation with a 40-hour battery and plush memory-foam earcups, so long listening sessions stay comfortable. Tuned for warm lows and crystal-clear highs — with no wires to get in the way.",
  },
  "nimbus-mechanical-keyboard": {
    name: "Nimbus Mechanical Keyboard — satisfying, responsive typing",
    description:
      "Typing that feels as good as it sounds. Nimbus is a compact 75% mechanical keyboard with hot-swappable switches, durable PBT keycaps, and per-key RGB — built for coders and writers who live on their keyboards.",
  },
  "terra-organic-cotton-tee": {
    name: "Terra Organic Cotton Tee — an easy everyday essential",
    description:
      "The tee you'll reach for again and again. Cut from soft 100% organic cotton that's pre-shrunk and dyed with low-impact pigments, in three easy colorways that pair with everything.",
  },
  "drift-linen-hoodie": {
    name: "Drift Linen Hoodie — easy layering for in-between days",
    description:
      "Light enough for spring, cozy enough for fall. Drift is a relaxed French terry hoodie with a kangaroo pocket and brushed-metal drawcord tips — your grab-and-go layer for unpredictable days.",
  },
  "sable-ceramic-vase": {
    name: "Sable Ceramic Vase — an effortless accent for any room",
    description:
      "Warm up a shelf, table, or entryway in seconds. Each Sable vase is hand-thrown matte black ceramic — no two glazes alike — standing 22cm tall and pairing beautifully with fresh stems or dried botanicals.",
  },
  "meadow-soy-candle": {
    name: "Meadow Soy Candle — a softer atmosphere, for hours",
    description:
      "Fig, cedar, and white tea — a calm, welcoming scent that fills the room without overpowering it. Hand-poured soy wax burns cleanly for 60+ hours in a reusable glass vessel.",
  },
  "helix-vitamin-c-serum": {
    name: "Helix Vitamin C Serum — brighter, more even-looking skin",
    description:
      "A brighter, more even look, one drop at a time. Helix blends 15% vitamin C with ferulic acid and vitamin E to smooth texture and even out skin tone over 4–6 weeks. Fragrance-free and dermatologist-tested.",
  },
  "quill-leather-journal": {
    name: "Quill Leather Journal — a timeless home for your ideas",
    description:
      "Ideas deserve a good place to live. Quill wraps 192 pages of smooth 120gsm cream paper in full-grain leather that ages beautifully, with lay-flat binding for comfortable writing anywhere.",
  },
  "lumen-smart-led-strip": {
    name: "Lumen Smart LED Strip — set any mood in seconds",
    description:
      "Change the whole feel of a room from your phone or your voice. This 16ft addressable LED strip works with HomeKit, Alexa, and Google Home, and comes with mounting clips and a Wi-Fi controller for a quick setup.",
  },
  "bloom-botanical-skincare-set": {
    name: "Bloom Botanical Skincare Set — a simple three-step routine",
    description:
      "Cleanse, tone, moisturize — that's the whole routine. Bloom pairs plant-derived actives with gentle formulas made for sensitive skin, all in a reusable cotton drawstring bag that travels well.",
  },
  "foundry-heavyweight-sweatshirt": {
    name: "Foundry Heavyweight Sweatshirt — substantial comfort for cool days",
    description:
      "Substantial in the best way. Foundry is a 500gsm loopback cotton sweatshirt with a boxy fit and ribbed cuffs, garment-dyed for a vintage hand-feel that only gets softer with every wash.",
  },
  "carry-canvas-tote": {
    name: "Carry Canvas Tote — built to haul your whole day",
    description:
      "Commute, gym, market run — Carry handles it all. Waxed 16oz canvas with leather handles and an interior laptop sleeve keeps everything organized and ages into its own character.",
  },
};

async function main() {
  // 1. Admin session cookie
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) {
    console.error("Login failed:", login.status, await login.text());
    process.exit(1);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];

  // 2. Current catalog
  const res = await fetch(`${BASE}/api/products`);
  const { products } = (await res.json()) as { products: { id: string; slug: string }[] };

  // 3. Apply updates by slug
  let ok = 0;
  for (const p of products) {
    const patch = UPDATES[p.slug];
    if (!patch) continue;
    const put = await fetch(`${BASE}/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(patch),
    });
    if (put.ok) {
      ok++;
      console.log(`✓ ${p.slug}`);
    } else {
      console.error(`✗ ${p.slug}:`, put.status, (await put.text()).slice(0, 200));
    }
  }
  console.log(`Updated ${ok}/${Object.keys(UPDATES).length} products.`);
}

main();
