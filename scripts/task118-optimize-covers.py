#!/usr/bin/env python3
"""Task 118 — optimize the 3 raw covers to the standard 1200x675 progressive
JPG (same spec as Task 80/86 covers) into public/images/blog/."""
from pathlib import Path
from PIL import Image

RAW = Path("/home/z/my-project/scripts/task118-raw")
OUT = Path("/home/z/my-project/public/images/blog")
OUT.mkdir(parents=True, exist_ok=True)

TARGET = (1200, 675)  # 16:9
for raw in sorted(RAW.glob("*.png")):
    img = Image.open(raw).convert("RGB")
    w, h = img.size
    # center-crop to 16:9 then resize to target
    th = int(w * 9 / 16)
    if h > th:
        top = (h - th) // 2
        img = img.crop((0, top, w, top + th))
    img = img.resize(TARGET, Image.LANCZOS)
    dest = OUT / f"{raw.stem}.jpg"
    img.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{dest.name}: {dest.stat().st_size // 1024} KB")
