// Task 86c: iPhone cover attempt 3 — v2 had faint garbled pseudo-text at the
// bottom of the screens. Force pure solid black turned-off displays.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task86-raw";
const SLUG = "iphone-price-in-somalia";

const PROMPT =
  "Three modern smartphones standing upright side by side in a neat row, all facing the camera with their screens toward the viewer, " +
  "every screen is a pure solid black turned-off display, flat matte black glass with zero reflections, zero glare and zero content, " +
  "slim matte metal frames in silver graphite and gold, " +
  "clean modern e-commerce editorial photography, soft warm studio lighting on the background only, cream beige background, high quality, detailed, professional commercial photo, " +
  "the camera faces the blank screens so no camera lenses are visible, " +
  "no text, no words, no letters, no numbers, no logos, no brand names, no icons, no reflections on the screens, no watermarks anywhere in the image";

async function generate(zai, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await zai.images.generations.create({ prompt: PROMPT, size: "1344x768" });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error("empty base64 in response");
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 10_000) throw new Error(`suspiciously small file (${buf.length} bytes)`);
      const out = path.join(OUT_DIR, `${SLUG}.v3.png`);
      fs.writeFileSync(out, buf);
      console.log(`OK  ${SLUG}.v3.png  ${(buf.length / 1024).toFixed(0)} KB`);
      return true;
    } catch (err) {
      console.error(`attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  return false;
}

const zai = await ZAI.create();
if (!(await generate(zai))) process.exit(1);
console.log("v3 cover generated.");
