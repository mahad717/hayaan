// Task 87 — covers for the 3 new buyer guides (AC, TV sizes, Mogadishu).
// Same recipe as Task 80/86: 1344x768 raw PNG → scripts/task87-raw/,
// then optimize-covers crops to 16:9 1200x675 progressive JPG.
// STRICT no-text prompts — AI-generated lettering always comes out garbled.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task87-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = [
  {
    slug: "air-conditioner-price-in-somalia",
    prompt:
      "A white split-unit air conditioner mounted high on a warm terracotta plaster wall of a sunlit minimalist living room, gentle cool air implied with a soft breeze on a light curtain, morning sunlight and soft shadows, a green potted plant in the corner, clean modern East African home interior, warm inviting tones, professional product photography, high quality, detailed, strictly no text, no logos, no letters, no numbers, brandless",
  },
  {
    slug: "what-size-tv-to-buy-in-somalia",
    prompt:
      "A cozy modern living room at dusk with a very large blank dark-screen flat TV mounted on a warm neutral wall above a low wooden console, soft warm lamp glow, a comfortable sofa facing the screen, subtle warm color grading, cinematic composition, brandless, strictly no text, no logos, no letters, no numbers, no words on screen",
  },
  {
    slug: "online-shopping-in-mogadishu",
    prompt:
      "A delivery rider on a motorbike scooter carrying a plain dark-green delivery box, riding along a sunlit coastal city avenue with the blue Indian Ocean visible in the background, palm trees, warm morning light, motion feel, clean composition, brandless vehicle, blank box, strictly no text, no logos, no letters, no numbers, blank license plate",
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
