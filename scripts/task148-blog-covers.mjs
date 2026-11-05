// Task 148: blog cover for the Galaxy A-series price hub (Task 143/145/146/147
// series style). Same cream editorial series — gold-coin motif + the product
// idea: a neat ladder of five smartphones ascending like steps (budget to
// flagship), one golden coin on each of the top steps. No text/logos/brand
// marks, no readable numbers.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task148-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_TAIL =
  "clean modern e-commerce editorial photography, soft warm studio lighting on the background only, cream beige background, high quality, detailed, professional commercial photo, " +
  "no text, no words, no letters, no numbers, no logos, no brand names, no icons, no watermarks anywhere in the image";

const JOBS = [
  {
    slug: "samsung-galaxy-a-series-price-in-somalia",
    prompt:
      "A neat ascending staircase of five generic modern smartphones stepping upward like a bar chart from small to large, each phone standing upright on a clean minimal cream desk, one shiny golden coin resting on the top step and two golden coins lower down, a subtle rising shadow behind the phone steps, soft warm studio light, " +
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
console.log("task148 cover generated.");
