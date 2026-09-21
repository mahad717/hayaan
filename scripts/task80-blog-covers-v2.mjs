// Task 80b: regenerate the 2 covers that came back with garbled AI text
// (supplements labels, phone screen UI). Stricter no-text constraints.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task80-raw";

const POSTS = [
  {
    slug: "buying-health-supplements-online-in-somalia",
    prompt:
      "Neat arrangement of health supplement containers: plain white and green vitamin bottles with completely blank unprinted labels, a clear glass jar of capsules, fresh orange slices and glossy green leaves on a bright cream surface, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "all labels are blank with no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "online-shopping-in-somalia-how-it-works",
    prompt:
      "Online shopping delivery concept: stacked kraft cardboard parcel boxes, one open box with white tissue paper, a hand holding a smartphone with a plain blank softly glowing screen, a small orange delivery scooter in the background, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
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
