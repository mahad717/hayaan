#!/usr/bin/env python3
"""Analyze whitespace distribution in the PS5 product images."""
from PIL import Image, ImageChops
import os

base = "/home/z/my-project/public/images/products"
for name in ["ps5-pro-2tb-1.jpg", "ps5-pro-2tb-2.jpg", "ps5-slim-digital-1.jpg"]:
    p = os.path.join(base, name)
    img = Image.open(p).convert("RGB")
    w, h = img.size
    # Bounding box of non-white content (threshold 245)
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    bbox = diff.point(lambda x: 255 if x > 12 else 0).getbbox()
    if bbox:
        left, top, right, bottom = bbox
        print(f"{name}: {w}x{h}  content bbox=({left},{top},{right},{bottom})  "
              f"margins L={left} R={w-right} T={top} B={h-bottom}  "
              f"content {right-left}x{bottom-top}")
    else:
        print(f"{name}: {w}x{h}  (blank?)")
