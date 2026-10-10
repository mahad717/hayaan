#!/usr/bin/env python3
"""Task 86: crop the 4 new blog covers to exact 16:9 (1200x675) optimized JPG.

Picks (visual QA): v1 for pay/smartwatches, v2 for PS5 (v1 drew an Xbox),
v3 for iPhone (v1 Samsung branding, v2 garbled screen text).
Source: 1344x768 (ratio 1.75) -> center-crop height to 1344 / (16/9) = 756
        -> resize to 1200x675 -> progressive JPG q82 (same recipe as Task 80).
"""
from pathlib import Path
from PIL import Image

RAW = Path("/home/z/my-project/scripts/task86-raw")
OUT = Path("/home/z/my-project/public/images/blog")
OUT.mkdir(parents=True, exist_ok=True)

PICKS = {
    "ps5-price-in-somalia": RAW / "ps5-price-in-somalia.v2.png",
    "iphone-price-in-somalia": RAW / "iphone-price-in-somalia.v3.png",
    "how-to-pay-online-in-somalia": RAW / "how-to-pay-online-in-somalia.png",
    "best-smartwatches-online-in-somalia": RAW / "best-smartwatches-online-in-somalia.png",
}

TARGET_W, TARGET_H = 1200, 675
RATIO = TARGET_W / TARGET_H

for slug, src in PICKS.items():
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
    kb = out.stat().st_size / 1024
    print(f"OK  {out.name}  {TARGET_W}x{TARGET_H}  {kb:.0f} KB")

print("task86 covers optimized.")
