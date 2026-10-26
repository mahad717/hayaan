// Task 127: blog covers for the three new guides (laptops, Galaxy foldables,
// home & kitchen appliances). Same series style as task86c — clean e-commerce
// editorial photography on cream, screens OFF (pure black, zero reflections),
// strictly no text/logos/brand marks. Raw 1344x768 PNGs go to task127-raw;
// task127-optimize-covers.py crops them to the 1200x675 JPG the site ships.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task127-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_TAIL =
  "clean modern e-commerce editorial photography, soft warm studio lighting on the background only, cream beige background, high quality, detailed, professional commercial photo, " +
  "no text, no words, no letters, no numbers, no logos, no brand names, no icons, no watermarks anywhere in the image";

const JOBS = [
  {
    slug: "laptop-price-in-somalia",
    prompt:
      "A modern slim silver laptop open at a slight angle on a clean minimal desk, its screen is a pure solid black turned-off display with flat matte black glass, zero reflections, zero glare and zero content, matte aluminum body, a second closed slim laptop and a wireless mouse rest beside it, " +
      COMMON_TAIL,
  },
  {
    slug: "samsung-galaxy-z-fold-price-in-somalia",
    prompt:
      "Two modern foldable smartphones on a clean minimal surface, one half-folded standing in tent mode with its large inner display a pure solid black turned-off screen with zero reflections and zero content, one fully folded closed lying flat showing its small outer cover screen also pure solid black turned off, slim matte metal frames in graphite and silver, " +
      COMMON_TAIL,
  },
  {
    slug: "home-appliances-price-in-somalia",
    prompt:
      "A neat group of small modern kitchen appliances arranged on a clean cream kitchen counter: a stainless steel electric kettle, a black countertop blender with glass jug, a compact black mini countertop oven, a white coffee maker and a white rice cooker, all brand new with clean unbranded matte surfaces, " +
      COMMON_TAIL,
  },
];

async function generate(zai, slug, prompt, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await zai.images.generations.create({ prompt, size: "1344x768" });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error("empty base64 in response");
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 10_000) throw new Error(`suspiciously small file (${buf.length} bytes)`);
      const out = path.join(OUT_DIR, `${slug}.png`);
      fs.writeFileSync(out, buf);
      console.log(`OK  ${slug}.png  ${(buf.length / 1024).toFixed(0)} KB`);
      return true;
    } catch (err) {
      console.error(`${slug} attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  return false;
}

const zai = await ZAI.create();
let failed = [];
for (const job of JOBS) {
  if (!(await generate(zai, job.slug, job.prompt))) failed.push(job.slug);
}
if (failed.length) { console.error("FAILED:", failed.join(", ")); process.exit(1); }
console.log("task127 covers generated.");
