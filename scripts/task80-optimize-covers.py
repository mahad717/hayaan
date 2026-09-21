#!/usr/bin/env python3
"""Task 80: crop blog covers to exact 16:9 (1200x675) and save as optimized JPG.

Picks: v1 for electronics/phones/home-office, v2 for supplements/online-shopping.
Source: 1344x768 (ratio 1.75) -> center-crop height to 1344/ (16/9) = 756
        -> resize to 1200x675 -> JPG quality 82 optimize.
"""
from pathlib import Path
from PIL import Image

RAW = Path("/home/z/my-project/scripts/task80-raw")
OUT = Path("/home/z/my-project/public/images/blog")
OUT.mkdir(parents=True, exist_ok=True)

PICKS = {
    "where-to-buy-electronics-online-in-somalia": RAW / "where-to-buy-electronics-online-in-somalia.png",
    "how-to-buy-phones-online-in-somalia": RAW / "how-to-buy-phones-online-in-somalia.png",
    "buying-health-supplements-online-in-somalia": RAW / "buying-health-supplements-online-in-somalia.v2.png",
    "setting-up-a-home-office-in-somalia": RAW / "setting-up-a-home-office-in-somalia.png",
    "online-shopping-in-somalia-how-it-works": RAW / "online-shopping-in-somalia-how-it-works.v2.png",
}

TARGET_W, TARGET_H = 1200, 675  # exact 16:9
RATIO = TARGET_W / TARGET_H

for slug, src in PICKS.items():
    if not src.exists():
        raise SystemExit(f"MISSING source: {src}")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # center-crop to 16:9
    if w / h > RATIO:
        new_w = int(h * RATIO)
        x0 = (w - new_w) // 2
        im = im.crop((x0, 0, x0 + new_w, h))
    else:
        new_h = int(w / RATIO)
        y0 = (h - new_h) // 2
        im = im.crop((0, y0, w, y0 + new_h))
    im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    dst = OUT / f"{slug}.jpg"
    im.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{dst}  {dst.stat().st_size / 1024:.0f} KB  {im.size}")

print("done")
