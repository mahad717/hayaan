// Task 129: blog covers for the three investing guides (how to invest in
// Somalia, Somalia share market, securities in Somalia). Same cream editorial
// series style as task127 — no text/logos/brand marks, no readable numbers.
// Raw 1344x768 PNGs go to task129-raw; task129-optimize-covers.py crops them
// to the 1200x675 JPG the site ships.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task129-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_TAIL =
  "clean modern e-commerce editorial photography, soft warm studio lighting on the background only, cream beige background, high quality, detailed, professional commercial photo, " +
  "no text, no words, no letters, no numbers, no logos, no brand names, no icons, no watermarks anywhere in the image";

const JOBS = [
  {
    slug: "how-to-invest-in-somalia",
    prompt:
      "A small vibrant green seedling growing out of the top of a neat stack of shiny golden coins on a clean minimal cream desk, a modern smartphone with a dark turned-off solid black screen lying flat beside the coin stack, soft morning light, savings and growth concept, " +
      COMMON_TAIL,
  },
  {
    slug: "somalia-share-market",
    prompt:
      "Golden coins arranged in five ascending columns like a rising bar chart on a clean minimal cream surface, each column taller than the last with the tallest at the right, a few loose coins resting in front, soft warm studio light, upward growth concept, " +
      COMMON_TAIL,
  },
  {
    slug: "securities-in-somalia",
    prompt:
      "A clear glass dome protecting a small neat stack of golden coins on a clean minimal cream desk, a small brass padlock resting beside the dome, protection and safekeeping concept, soft warm studio light, " +
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
console.log("task129 covers generated.");
