// Task 80: generate 5 branded blog cover images for the shipped SEO guides.
// Output: scripts/task80-raw/<slug>.png (1344x768) — cropped/optimized later.
// Style: Hayaan brand palette (deep green #3f7d4a, cream #faf8f1, orange
// accent #f28c28), clean editorial e-commerce photography, NO text.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task80-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const STYLE =
  "clean modern e-commerce editorial photography, soft warm studio lighting, " +
  "cream beige background, subtle deep green and warm orange accent props, " +
  "high quality, detailed, professional commercial photo, " +
  "no text, no words, no letters, no logos, no watermarks";

const POSTS = [
  {
    slug: "where-to-buy-electronics-online-in-somalia",
    prompt:
      "Flat lay of home electronics arranged neatly: a slim flat-screen TV, an open silver laptop, a white game console controller, wireless over-ear headphones and a small bluetooth speaker, " + STYLE,
  },
  {
    slug: "how-to-buy-phones-online-in-somalia",
    prompt:
      "Two modern smartphones standing upright on a light wooden desk next to a smartphone showing a simple checkout screen with a green confirmation checkmark, a shopping bag in soft focus behind, " + STYLE,
  },
  {
    slug: "buying-health-supplements-online-in-somalia",
    prompt:
      "Neat arrangement of health supplement containers: plain white and green vitamin bottles, a glass jar of capsules, fresh orange slices and green leaves on a bright cream surface, " + STYLE,
  },
  {
    slug: "setting-up-a-home-office-in-somalia",
    prompt:
      "A tidy home office workspace: wooden desk with a laptop, a compact white printer, a desk lamp with warm light, a notebook, a potted plant and a comfortable chair, " + STYLE,
  },
  {
    slug: "online-shopping-in-somalia-how-it-works",
    prompt:
      "Online shopping delivery concept: stacked kraft cardboard parcel boxes, one open box with tissue paper, a hand holding a smartphone showing a shopping cart screen, a small delivery scooter toy in the background, " + STYLE,
  },
];

async function generate(zai, post, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await zai.images.generations.create({
        prompt: post.prompt,
        size: "1344x768",
      });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error("empty base64 in response");
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 10_000) throw new Error(`suspiciously small file (${buf.length} bytes)`);
      const out = path.join(OUT_DIR, `${post.slug}.png`);
      fs.writeFileSync(out, buf);
      console.log(`OK  ${post.slug}.png  ${(buf.length / 1024).toFixed(0)} KB`);
      return true;
    } catch (err) {
      console.error(`attempt ${i}/${attempts} failed for ${post.slug}: ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  return false;
}

const zai = await ZAI.create();
const failed = [];
for (const post of POSTS) {
  const ok = await generate(zai, post);
  if (!ok) failed.push(post.slug);
}
if (failed.length) {
  console.error(`FAILED: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("All covers generated.");
