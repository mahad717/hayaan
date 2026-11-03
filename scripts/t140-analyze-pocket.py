#!/usr/bin/env python3
"""Task 140b — find the ENCLOSED black background pocket that border
flood-fill couldn't reach. Report connected components of dark pixels
(lum<40) with area>1500: bbox, mean/std luminance -> distinguish true
background pockets (uniform pure black) from subject blacks (trousers,
phone bezel: gradient-shaded). Emit a debug tint image."""
from PIL import Image
import numpy as np
from scipy import ndimage

im = Image.open("/tmp/svg-embedded-1.png").convert("RGB")
a = np.asarray(im).astype(np.float32)
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
dark = lum < 40
lab, n = ndimage.label(dark)
print(f"dark components: {n}")
for i in range(1, n + 1):
    mask = lab == i
    area = int(mask.sum())
    if area < 1500:
        continue
    ys, xs = np.where(mask)
    l_mean = float(lum[mask].mean())
    l_std = float(lum[mask].std())
    p10 = float(np.percentile(lum[mask], 10))
    p90 = float(np.percentile(lum[mask], 90))
    print(f"comp {i}: area={area:7d} bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()}) "
          f"lum mean={l_mean:5.1f} std={l_std:5.1f} p10={p10:4.1f} p90={p90:4.1f}")

# debug tint: components tinted red over dimmed original
dbg = (a * 0.35).astype(np.uint8)
for i in range(1, n + 1):
    mask = lab == i
    if mask.sum() >= 1500:
        dbg[mask] = [255, 40, 40]
Image.fromarray(dbg).save("/tmp/t140-debug-components.png")
print("debug image: /tmp/t140-debug-components.png")
