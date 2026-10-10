// Task 86: generate branded covers for the 4 October 2026 SEO/AEO guides.
// Same recipe as Task 80: 1344x768, Hayaan cream/green/orange palette,
// strict no-text constraints (labels/screens/faces come back garbled otherwise).

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task86-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const POSTS = [
  {
    slug: "ps5-price-in-somalia",
    prompt:
      "Modern gaming console scene: a white next-generation game console standing vertically on a cream surface, completely blank and unbranded with no markings, beside a black wireless game controller with no logos, a soft orange rim light, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "iphone-price-in-somalia",
    prompt:
      "Flat lay of three modern smartphones with completely blank dark screens lying face up on a bright cream surface, neatly spaced diagonal composition, a slim green leather wallet beside them, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "screens are completely black and blank, no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "how-to-pay-online-in-somalia",
    prompt:
      "Mobile payment concept: a hand holding a smartphone with a plain blank softly glowing screen showing only a large green circle checkmark icon, a small card payment terminal and a slim wallet on a cream surface, an orange shopping bag in the background, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "the screen shows only an abstract green checkmark symbol, no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "best-smartwatches-online-in-somalia",
    prompt:
      "Neat lineup of four modern smartwatches with different colored silicone bands standing on small cream pedestals, all watch faces completely blank and dark, soft shadows, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "watch faces are completely blank with no icons or numbers, no text, no words, no letters, no logos, no watermarks anywhere in the image",
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
console.log("task86 covers generated.");
