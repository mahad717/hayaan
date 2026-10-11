// Task 93 — covers for the 3 new buyer guides (routers, printers, Hargeisa).
// Same recipe as Task 80/86/87: 1344x768 raw PNG → scripts/task93-raw/,
// then optimize-covers crops to 16:9 1200x675 progressive JPG.
// STRICT no-text prompts — AI-generated lettering always comes out garbled.

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = "/home/z/my-project/scripts/task93-raw";
fs.mkdirSync(OUT_DIR, { recursive: true });

const JOBS = [
  {
    slug: "wifi-router-price-in-somalia",
    prompt:
      "A modern white wifi router with two antennas standing on a light wooden shelf in a warm sunlit minimalist living room, two neat ethernet cables connected, soft green status light, sheer curtain with gentle daylight, clean modern East African home interior, warm inviting tones, professional product photography, high quality, detailed, strictly no text, no logos, no letters, no numbers, brandless router",
  },
  {
    slug: "printer-price-in-somalia",
    prompt:
      "A compact white desktop laser printer on a clean office desk beside a neat stack of plain white paper, warm daylight from a side window, simple minimalist East African office interior with a plant in the background, soft shadows, warm professional tones, product photography, high quality, detailed, strictly no text, no logos, no letters, no numbers, blank control panel, brandless",
  },
  {
    slug: "online-shopping-in-hargeisa",
    prompt:
      "A delivery rider on a motorbike scooter carrying a plain dark-green delivery box, riding along a sunlit wide city avenue in a Horn of Africa highland city with distant rocky mountains on the horizon, low white and pastel buildings, palm trees, warm morning light, motion feel, clean composition, brandless vehicle, blank box, strictly no text, no logos, no letters, no numbers, blank license plate",
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
