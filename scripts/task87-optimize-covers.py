#!/usr/bin/env python3
"""Task 87: crop the 3 new blog covers to exact 16:9 (1200x675) optimized JPG."""
from pathlib import Path
from PIL import Image

RAW = Path("/home/z/my-project/scripts/task87-raw")
OUT = Path("/home/z/my-project/public/images/blog")
OUT.mkdir(parents=True, exist_ok=True)

SLUGS = [
    "air-conditioner-price-in-somalia",
    "what-size-tv-to-buy-in-somalia",
    "online-shopping-in-mogadishu",
]
TARGET_W, TARGET_H = 1200, 675
RATIO = TARGET_W / TARGET_H

for slug in SLUGS:
    src = RAW / f"{slug}.png"
    if not src.exists():
        raise SystemExit(f"MISSING source: {src}")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    target_h = round(w / RATIO)
    if target_h <= h:
        top = (h - target_h) // 2
        im = im.crop((0, top, w, top + target_h))
    else:
        target_w = round(h * RATIO)
        left = (w - target_w) // 2
        im = im.crop((left, 0, left + target_w, h))
    im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    out = OUT / f"{slug}.jpg"
    im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"OK  {out.name}  {TARGET_W}x{TARGET_H}  {out.stat().st_size/1024:.0f} KB")

print("task87 covers optimized.")
