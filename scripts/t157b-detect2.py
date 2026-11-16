#!/usr/bin/env python3
"""t157b: improved badge detector - 4 corners, 25% zone, badge-exact colors + corner sheet."""
import os, sys, json
from PIL import Image, ImageDraw

def badge_stats(path, zone=0.25):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    zw, zh = max(8, int(w * zone)), max(8, int(h * zone))
    best = None
    for cx, cy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
        x0 = 0 if cx == 0 else w - zw
        y0 = 0 if cy == 0 else h - zh
        crop = im.crop((x0, y0, x0 + zw, y0 + zh))
        px = list(crop.getdata())
        n = len(px)
        blue = sum(1 for r, g, b in px if b > r + 25 and b > g + 25 and b > 90)
        orange = sum(1 for r, g, b in px if r > b + 50 and r > g + 15 and r > 140)
        corner = (cx, cy, blue / n, orange / n)
        if best is None or (blue + orange) > (best[2] + best[3]):
            best = corner
    return im.size, best

def run(files, out_json):
    res = {}
    flagged = []
    for f in files:
        try:
            size, (cx, cy, blue, orange) = badge_stats(f)
        except Exception as e:
            res[os.path.basename(f)] = {'error': str(e)}
            continue
        hit = blue > 0.002 and orange > 0.002
        res[os.path.basename(f)] = {'size': size, 'corner': f"{cx},{cy}",
                                    'blue': round(blue, 4), 'orange': round(orange, 4), 'flagged': hit}
        if hit:
            flagged.append(os.path.basename(f))
    json.dump(res, open(out_json, 'w'), indent=1)
    print("FLAGGED", len(flagged), "/", len(files))
    for f in flagged:
        r = res[f]
        print("  ", f, r['size'], "corner", r['corner'], "blue", r['blue'], "orange", r['orange'])
    return flagged

def sheet(files, out_png, zone=0.25):
    tiles = []
    TW, TH = 300, 300
    for f in files:
        im = Image.open(f).convert('RGB')
        w, h = im.size
        zw, zh = max(8, int(w * zone)), max(8, int(h * zone))
        corner = im.crop((0, 0, zw, zh)).resize((TW, TH), Image.LANCZOS)
        d = ImageDraw.Draw(corner)
        d.rectangle([0, 0, TW - 1, 13], fill=(0, 0, 0))
        d.text((4, 2), os.path.basename(f)[:34], fill=(255, 255, 0))
        tiles.append(corner)
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sh = Image.new('RGB', (cols * TW, rows * TH), (255, 255, 255))
    for i, t in enumerate(tiles):
        sh.paste(t, ((i % cols) * TW, (i // cols) * TH))
    sh.save(out_png)
    print("sheet", out_png, sh.size)

if __name__ == '__main__':
    d = sys.argv[1] if len(sys.argv) > 1 else '/home/z/my-project/public/images/products'
    files = sorted(os.path.join(d, f) for f in os.listdir(d)
                   if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))
    flagged = run(files, '/home/z/my-project/scripts/t157-detect2.json')
    sheet(files, '/home/z/my-project/scripts/t157-corner-sheet2.png')
