// Task 145: blog cover for the "investment opportunities in Somalia" umbrella
// guide (Task 143 series style). Same cream editorial series — gold-coin motif,
// no text/logos/brand marks, no readable numbers. Raw 1344x768 PNG goes to
// task145-raw; task145-optimize-covers.py crops to the 1200x675 JPG shipped.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task145-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const COMMON_TAIL =
  "clean modern e-commerce editorial photography, soft warm studio lighting on the background only, cream beige background, high quality, detailed, professional commercial photo, " +
  "no text, no words, no letters, no numbers, no logos, no brand names, no icons, no watermarks anywhere in the image";

const JOBS = [
  {
    slug: "investment-opportunities-in-somalia",
    prompt:
      "A wide mini landscape composition on a cream desk: rows of small green seedlings growing from a strip of dark soil, tiny golden coins half-buried where the seedlings sprout, a few small white model buildings and a miniature freight ship at the far edge, one larger golden coin standing upright among the seedlings as a sun substitute above the scene, abundance of grounded opportunities, soft warm studio light, " +
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
console.log("task145 cover generated.");
