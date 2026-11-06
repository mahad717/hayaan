// Task 149 — mobile cut of the hero artwork. The 1563x938 webp (97KB) served
// into a ~380px-wide slot wasted 80.8KB (Lighthouse image-delivery). A 760px
// cut (≈380 CSS px × 1.75 DPR mobile viewport, rounded up) keeps the image
// sharp on phones at ~1/3 the bytes. Desktop (≥640px) keeps the original.
import sharp from "sharp";
import { statSync } from "fs";

const SRC = "public/images/hero-shopping-3d-v2.webp";
const OUT = "public/images/hero-shopping-3d-m760.webp";

const meta = await sharp(SRC).metadata();
await sharp(SRC)
  .resize({ width: 760 })
  .webp({ quality: 82 })
  .toFile(OUT);

const inKB = Math.round(statSync(SRC).size / 1024);
const outKB = Math.round(statSync(OUT).size / 1024);
const outMeta = await sharp(OUT).metadata();
console.log(`src: ${meta.width}x${meta.height} ${inKB}KB -> out: ${outMeta.width}x${outMeta.height} ${outKB}KB`);
