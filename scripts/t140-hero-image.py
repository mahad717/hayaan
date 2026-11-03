#!/usr/bin/env python3
"""Task 140 — hero artwork prep for hayaan.co.

Source: the 1676x1076 full-color 3D render embedded inside the owner's SVG
(upload/online shopping hayaan market.svg — the SVG is just a 1.7MB raster
wrapper + mask, so we take the original raster out and ship it optimized).

Steps:
  1. Flood-fill the uniform black background from the image border ->
     transparent (threshold on luminance; interior blacks — trousers, phone
     notch — are NOT border-connected, so they survive).
  2. Feather the cut edge 1px to avoid a dark fringe on the light hero.
  3. Trim to content bbox (+8px pad), resize to 1200px wide.
  4. Emit WebP (q88) + PNG, print sizes for the format decision.
"""
from PIL import Image, ImageFilter
from collections import deque

SRC = "/tmp/svg-embedded-1.png"
OUT_WEBP = "/tmp/hero-shopping-3d.webp"
OUT_PNG = "/tmp/hero-shopping-3d.png"
THRESH = 24  # luminance below this = background candidate

im = Image.open(SRC).convert("RGB")
w, h = im.size
px = im.load()

# --- 1. border-connected near-black -> background mask (BFS flood fill) ---
bg = bytearray(w * h)  # 1 = background
q = deque()
def lum(x, y):
    r, g, b = px[x, y]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

for x in range(w):
    for y in (0, h - 1):
        if lum(x, y) < THRESH and not bg[y * w + x]:
            bg[y * w + x] = 1
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if lum(x, y) < THRESH and not bg[y * w + x]:
            bg[y * w + x] = 1
            q.append((x, y))

while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and lum(nx, ny) < THRESH:
            bg[ny * w + nx] = 1
            q.append((nx, ny))

# --- 1b. ENCLOSED background pockets (Task 140b): border flood-fill can't
# reach the black regions sealed between subjects (behind the t-shirt, under
# the cart). Component analysis on prod screenshots showed a clean split:
# pockets are PURE black (lum mean<5, std<8: 0.0-1.1 / 0.6-5.5), while
# subject blacks are shaded (phone screen strips mean 18.8, notch 16.5,
# cart shadows 28.0). Remove only large uniform pure-black components.
import numpy as np
from scipy import ndimage
arr = np.asarray(im).astype(np.float32)
lum_np = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]
lab, ncomp = ndimage.label(lum_np < 40)
pockets = 0
for i in range(1, ncomp + 1):
    mask = lab == i
    area = int(mask.sum())
    if area < 1500:
        continue
    vals = lum_np[mask]
    if vals.mean() < 5 and vals.std() < 8:
        ys, xs = np.where(mask)
        flat = mask.ravel()
        for idx in np.where(flat)[0]:
            bg[idx] = 1
        pockets += 1
        print(f"pocket removed: area={area} bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()})")
print(f"enclosed pockets removed: {pockets}")

total = w * h
nbg = sum(bg)
print(f"background removed: {nbg}/{total} px ({100*nbg/total:.1f}%)")

# --- 2. build RGBA with feathered edge ---
alpha = Image.frombytes("L", (w, h), bytes(bytearray(255 - 255 * b for b in bg)))
# feather: blur the alpha slightly, then re-solidify interior (keep opaque
# where alpha was 255 pre-blur; only soften the boundary ring)
soft = alpha.filter(ImageFilter.GaussianBlur(1.2))
solid = alpha.point(lambda v: 255 if v == 255 else 0)
final_alpha = Image.composite(alpha, soft, solid.point(lambda v: 255 if v else 0))
# edge despill: darken->semi pixels keep their color; acceptable on light bg

out = im.convert("RGBA")
out.putalpha(final_alpha)

# --- 3. trim + resize ---
bbox = out.getbbox()
print("content bbox:", bbox)
pad = 8
l, t, r, b = bbox
l, t = max(0, l - pad), max(0, t - pad)
r, b = min(w, r + pad), min(h, b + pad)
out = out.crop((l, t, r, b))
tw = 1200
th = round(out.height * tw / out.width)
out = out.resize((tw, th), Image.LANCZOS)
print("final size:", out.size)

# --- 4. emit ---
out.save(OUT_WEBP, "WEBP", quality=88, method=6)
out.save(OUT_PNG, "PNG", optimize=True)
import os
print(f"webp: {os.path.getsize(OUT_WEBP)//1024}KB  png: {os.path.getsize(OUT_PNG)//1024}KB")

# sanity: interior blacks must survive (man's trousers ~ center-right),
# corners transparent
def a(x, y): return out.getpixel((x, y))[3]
print("corner alpha (expect 0):", a(2, 2), a(tw - 3, 2), a(2, th - 3), a(tw - 3, th - 3))
# trousers: around 78% width, 55% height of the crop
print("trouser-ish alpha (expect 255):", a(int(tw * 0.78), int(th * 0.55)))
