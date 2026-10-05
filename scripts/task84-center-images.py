#!/usr/bin/env python3
"""Rebuild the two PS5 Pro images as square canvases with content centered.

Source: download/task83/{pro-1-clean,pro-2-clean}.jpg (2240px wide, watermark removed).
Output: public/images/products/ps5-pro-2tb-{1,2}.jpg (1400x1400, content centered).
"""
from PIL import Image, ImageChops, ImageStat
import numpy as np

SRC = "/home/z/my-project/download/task83"
OUT = "/home/z/my-project/public/images/products"
CANVAS = 1400          # output square size
FIT = 1180             # max content box inside canvas (=> ~110px margins)
PAD = 70               # minimum breathing room around content

def analyze(im: Image.Image, thr: int):
    """Content bbox vs the image's own background (median border color)."""
    a = np.asarray(im.convert("RGB"), dtype=np.int16)
    # border pixels = median of the 4 edges
    edges = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(edges, axis=0)
    diff = np.abs(a - bg).max(axis=2)
    mask = diff > thr
    ys, xs = np.where(mask)
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    # bg uniformity: sample border rows/cols std
    bg_std = float(edges.std(axis=0).mean())
    return bbox, tuple(int(v) for v in bg), bg_std

# Published gallery order: -1 = console+controller shot, -2 = box shot.
# (Task 83 source names are inverted vs published order: pro-2-clean is the
#  console shot on white, pro-1-clean is the box shot on gray.)
for name, src, out_name, thr in [
    ("console", f"{SRC}/pro-2-clean.jpg", "ps5-pro-2tb-1.jpg", 14),
    ("box",     f"{SRC}/pro-1-clean.jpg", "ps5-pro-2tb-2.jpg", 14),
]:
    im = Image.open(src).convert("RGB")
    bbox, bg, bg_std = analyze(im, thr)
    print(f"{name}: src={im.size} bg={bg} bg_std={bg_std:.1f} bbox={bbox}")
    content = im.crop(bbox)
    cw, ch = content.size
    scale = min(FIT / cw, FIT / ch)
    nw, nh = round(cw * scale), round(ch * scale)
    resampled = content.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (CANVAS, CANVAS), bg)
    canvas.paste(resampled, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    out = f"{OUT}/{out_name}"
    canvas.save(out, quality=86, optimize=True, progressive=True)
    print(f"  -> {out} content {nw}x{nh} scale {scale:.2f}")

# verify outputs
for f in ["ps5-pro-2tb-1.jpg", "ps5-pro-2tb-2.jpg"]:
    im = Image.open(f"{OUT}/{f}")
    bbox, bg, bg_std = analyze(im, 14)
    l, t, r, b = bbox
    print(f"{f}: {im.size} bbox={bbox} margins L={l} R={im.size[0]-r} T={t} B={im.size[1]-b} bg={bg} std={bg_std:.1f}")
