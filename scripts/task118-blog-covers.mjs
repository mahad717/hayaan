// Task 118: generate branded covers for the 3 batch-4 SEO/AEO guides.
// Same recipe as Task 86: 1344x768 source, Hayaan cream/green/orange palette,
// strict no-text constraints (labels/screens/faces come back garbled otherwise).

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task118-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const POSTS = [
  {
    slug: "power-bank-price-in-somalia",
    prompt:
      "Neat lineup of four modern power banks of different sizes standing on a bright cream surface, completely blank matte aluminum and dark plastic bodies with no markings, small LED indicator dots only, a braided USB-C cable coiled beside them, a slim wall charger brick behind, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "nokia-phones-price-in-somalia",
    prompt:
      "Three classic compact feature phones with physical keypad buttons arranged on a bright cream surface, one standing upright with a small blank dark screen, one lying flat showing round keypad buttons, one flip-phone style half open, all completely unbranded with matte dark blue and black bodies, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, cream beige background, high quality, detailed, professional commercial photo, " +
      "screens are completely dark and blank, no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
  {
    slug: "projector-price-in-somalia",
    prompt:
      "A modern white home projector on a wooden table beaming a soft abstract warm orange glow toward a large blank bright wall in a cozy dim living room, small potted plant beside it, cream and warm tones, the projected light is a plain soft gradient with no content, " +
      "clean modern e-commerce editorial photography, soft warm studio lighting, high quality, detailed, professional commercial photo, " +
      "the projection is a plain blank gradient, no text, no words, no letters, no numbers, no logos, no watermarks anywhere in the image",
  },
];

const main = async () => {
  const zai = await ZAI.create();
  for (const post of POSTS) {
    const out = path.join(OUT_DIR, `${post.slug}.png`);
    if (fs.existsSync(out) && fs.statSync(out).size > 50_000) {
      console.log(`skip (exists): ${post.slug}`);
      continue;
    }
    console.log(`generating: ${post.slug} ...`);
    const res = await zai.images.generations.create({
      prompt: post.prompt,
      size: "1344x768",
    });
    const b64 = res?.data?.[0]?.base64;
    if (!b64) throw new Error(`no image data for ${post.slug}`);
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
    console.log(`  saved ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  }
  console.log("DONE");
};

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
