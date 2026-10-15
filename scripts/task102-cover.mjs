// Task 101 — cover for the HP EliteBook buying guide.
// Same recipe as Task 80/86/87/93/96: 1344x768 raw PNG → scripts/task102-raw/,
// then optimize to 16:9 1200x675 progressive JPG in public/images/blog.
// STRICT no-text prompt — AI lettering always comes out garbled.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task102-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = [
  {
    slug: "electronics-store-near-me-in-somalia",
    prompt:
      "A smartphone held in a hand showing an empty dark screen, a cardboard delivery box with a small smart TV box and a laptop box beside it on a wooden table, a delivery rider helmet on the table edge, bright Mogadishu street with warm sunlight in soft focus, warm natural tones, professional product photography, high quality, detailed, strictly no text, no logos, no letters, no numbers, brandless laptop with a blank dark screen",
  },
];

const RETRIES = 3;

async function main() {
  const zai = await ZAI.create();
  let ok = 0;

  for (const job of JOBS) {
    const outPath = path.join(OUT_DIR, `${job.slug}.png`);
    let done = false;
    let lastErr = "";

    for (let attempt = 1; attempt <= RETRIES && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({
          prompt: job.prompt,
          size: "1344x768",
        });
        const b64 = res?.data?.[0]?.base64;
        if (!b64 || b64.length < 10000) {
          lastErr = `empty/short base64 (${b64 ? b64.length : 0} chars)`;
          console.error(`✗ ${job.slug} attempt ${attempt}: ${lastErr}`);
          continue;
        }
        fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
        console.log(`✓ ${job.slug} → ${outPath} (${Math.round(b64.length * 0.75 / 1024)} KB)`);
        ok += 1;
        done = true;
      } catch (err) {
        lastErr = err?.message ?? String(err);
        console.error(`✗ ${job.slug} attempt ${attempt} failed: ${lastErr}`);
        if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }

  console.log(`Done: ${ok}/${JOBS.length} covers generated.`);
  if (ok < JOBS.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
