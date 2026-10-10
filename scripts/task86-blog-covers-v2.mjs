// Task 86b: regenerate the 2 covers that visual QA rejected:
//  - ps5-price-in-somalia: v1 drew an Xbox console+controller (wrong product!)
//  - iphone-price-in-somalia: v1 drew Samsung-branded phones (wrong product!)
// Fixes: describe the console silhouette (curved white shells + black core),
// face phones screen-forward (backs carry brand text), repeat no-logo limits.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task86-raw";

const POSTS = [
  {
    slug: "ps5-price-in-somalia",
    prompt:
      "A tall white video game console standing vertically on a small black stand, the console is built of two smooth curved glossy white outer shells with a glossy black central strip running up the middle, standing beside a black wireless game controller that has a flat rectangular touchpad in its center, " +
      "completely blank and unbranded hardware, clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "not an Xbox, not a computer tower, " +
      "no text, no words, no letters, no numbers, no logos, no emblems, no watermarks anywhere in the image",
  },
  {
    slug: "iphone-price-in-somalia",
    prompt:
      "Three modern smartphones standing upright side by side in a neat row, all facing the camera with their screens toward the viewer, every screen completely black and blank like a turned-off display, slim matte metal frames in silver graphite and gold, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "the camera faces the blank screens so no camera lenses are visible, " +
      "no text, no words, no letters, no numbers, no logos, no brand names, no watermarks anywhere in the image",
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
      const out = path.join(OUT_DIR, `${post.slug}.v2.png`);
      fs.writeFileSync(out, buf);
      console.log(`OK  ${post.slug}.v2.png  ${(buf.length / 1024).toFixed(0)} KB`);
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
console.log("v2 covers generated.");
