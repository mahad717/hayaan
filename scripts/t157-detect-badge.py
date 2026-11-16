#!/usr/bin/env python3
"""Detect sanguni supplier badge (blue hexagon + orange G) in top-left corner of product images."""
import os, json
from PIL import Image

IMG_DIR = '/home/z/my-project/public/images/products'
ZONE = 0.15  # top-left 15% x 15%

def badge_score(im):
    w, h = im.size
    zw, zh = max(8, int(w * ZONE)), max(8, int(h * ZONE))
    crop = im.convert('RGB').crop((0, 0, zw, zh))
    px = crop.getdata()
    n = len(px)
    blue = sum(1 for r, g, b in px if b > r + 25 and b > g + 25 and b > 90)
    orange = sum(1 for r, g, b in px if r > b + 50 and r > g + 15 and r > 140)
    nonwhite = sum(1 for r, g, b in px if not (r > 235 and g > 235 and b > 235))
    return blue / n, orange / n, nonwhite / n, (zw, zh)

results = {}
for fn in sorted(os.listdir(IMG_DIR)):
    if not fn.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        continue
    p = os.path.join(IMG_DIR, fn)
    im = Image.open(p)
    blue, orange, nonwhite, zone = badge_score(im)
    results[fn] = {
        'size': im.size, 'blue': round(blue, 4), 'orange': round(orange, 4),
        'nonwhite': round(nonwhite, 4), 'zone': zone,
        'flagged': blue > 0.003 and orange > 0.003,
    }

flagged = [k for k, v in results.items() if v['flagged']]
print(json.dumps({k: v for k, v in results.items() if v['flagged']}, indent=1))
print(f"\nFLAGGED {len(flagged)} / {len(results)}:")
for f in flagged:
    print("  ", f, results[f]['size'])
print("\nNOT flagged:", [k for k, v in results.items() if not v['flagged']])

# contact sheet of top-left corners of ALL images, upscaled 3x, labeled by order
from PIL import ImageDraw
tiles = []
TW, TH = 300, 300
for fn in sorted(os.listdir(IMG_DIR)):
    if not fn.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        continue
    im = Image.open(os.path.join(IMG_DIR, fn)).convert('RGB')
    w, h = im.size
    zw, zh = max(8, int(w * 0.18)), max(8, int(h * 0.18))
    corner = im.crop((0, 0, zw, zh)).resize((TW, TH), Image.LANCZOS)
    d = ImageDraw.Draw(corner)
    d.rectangle([0, 0, TW - 1, 13], fill=(0, 0, 0))
    d.text((4, 2), fn[:34], fill=(255, 255, 0))
    tiles.append(corner)

cols = 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TW, rows * TH), (255, 255, 255))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * TW, (i // cols) * TH))
sheet.save('/home/z/my-project/scripts/t157-corner-sheet.png')
print("\nsheet saved", sheet.size)
