#!/usr/bin/env python3
"""t157g: badge removal v4 (final) - full-rect fill with ring-sampled bg color.
Badge rect = measured bbox + 2.5% margin; ring = 24px band outside rect (near-white px);
fill rect with ring median color. Kills hexagon + drop shadow + halo. Verify 0 residual."""
import os, json, statistics
from PIL import Image, ImageDraw

REPO = '/home/z/my-project/public/images/products'
FILES = [
    'cable-adapter-lightning-to-ethernet-rj45.jpg', 'dji-mic-mini-mobile-phone-adapter.jpg',
    'hp-monitor-series-5-27-inch-with-speakers.jpg', 'hp-printer-color-laserjet-pro-mfp-4303fdw.jpg',
    'iphone-duo-256gb-esim.jpg', 'lens-cleaning-kit-kf-concept.jpg',
    'msi-cyborg-15-gaming-intel-core-7-240h.jpg', 'portable-ssd-2tb-sandisk-1000mb-s-2.jpg',
    'power-bank-20000mah-green-lion-35w.jpg', 'power-bank-porodo-30000mah-with-integrated-cable.jpg',
    'power-extension-omega-5-outlet.jpg', 'printer-canon-image-runner-2425i-monochrome-a3-multifunctional.jpg',
    'samsung-galaxy-z-fold8-5g.jpg', 'ssd-lexar-ns100-512gb-2-5-sata-iii.jpg',
    'unifi-usw-48poe-network-switch-managed.jpg',
]

def is_badge(r, g, b):
    return (b > r + 25 and b > g + 25 and b > 90) or (r > b + 50 and r > g + 15 and r > 140)

def badge_pixels(im, zx, zy):
    w, h = im.size
    zw, zh = int(w * zx), int(h * zy)
    return [(x, y) for y in range(zh) for x in range(zw) if is_badge(*im.getpixel((x, y)))]

report = {}
tiles = []
for fn in FILES:
    path = os.path.join(REPO, fn)
    orig = Image.open(path).convert('RGB')
    im = orig.copy()
    w, h = im.size
    pts = badge_pixels(orig, 0.22, 0.24)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    mx, my = int(w * 0.025), int(h * 0.025)
    x0, y0 = max(0, bbox[0] - mx), max(0, bbox[1] - my)
    x1, y1 = min(w, bbox[2] + mx), min(h, bbox[3] + my)
    # ring sample: 24px band outside rect
    band = 24
    rx0, ry0 = max(0, x0 - band), max(0, y0 - band)
    rx1, ry1 = min(w, x1 + band), min(h, y1 + band)
    samples = []
    reg = im.crop((rx0, ry0, rx1, ry1))
    for y in range(reg.height):
        for x in range(reg.width):
            gx, gy = rx0 + x, ry0 + y
            if x0 <= gx < x1 and y0 <= gy < y1:
                continue  # inside rect - skip (badge/shadow)
            px = reg.getpixel((x, y))
            if min(px) > 235:
                samples.append(px)
    fill = tuple(int(statistics.median(c[i] for c in samples)) for i in range(3)) if samples else (255, 255, 255)
    im.paste(Image.new('RGB', (x1 - x0, y1 - y0), fill), (x0, y0))
    resid = len(badge_pixels(im, 0.25, 0.25))
    out = fn.rsplit('.', 1)[0] + '-nb.jpg'
    im.save(os.path.join(REPO, out), 'JPEG', quality=92, optimize=True)
    ok = resid == 0
    report[fn] = {'bbox': list(bbox), 'rect': [x0, y0, x1, y1], 'fill': fill,
                  'ringSamples': len(samples), 'residual': resid, 'out': out, 'clean': ok}
    print(f"{fn[:46]:48} rect {x0},{y0}-{x1},{y1} fill {fill} ring {len(samples)} resid {resid} {'OK' if ok else 'FAIL'}")
    cz = (0, 0, int(w * 0.35), int(h * 0.40))
    a = orig.crop(cz); bimg = im.crop(cz)
    tw = 260; th = int(a.height / a.width * tw)
    a = a.resize((tw, th)); bimg = bimg.resize((tw, th))
    t = Image.new('RGB', (tw * 2 + 4, th + 16), (255, 255, 255))
    t.paste(a, (0, 16)); t.paste(bimg, (tw + 4, 16))
    d = ImageDraw.Draw(t)
    d.text((2, 2), fn[:34], fill=(0, 0, 0))
    tiles.append(t)

json.dump(report, open('/home/z/my-project/scripts/t157-clean-report4.json', 'w'), indent=1)
cols = 2
rows = (len(tiles) + cols - 1) // cols
tw = tiles[0].width; th = max(t.height for t in tiles)
sh = Image.new('RGB', (cols * tw, rows * th), (255, 255, 255))
for i, t in enumerate(tiles):
    sh.paste(t, ((i % cols) * tw, (i // cols) * th))
sh.save('/home/z/my-project/scripts/t157-compare-sheet4.png')
print('compare sheet4 saved', sh.size, '|', 'ALL CLEAN' if all(v['clean'] for v in report.values()) else 'SOME FAILED')
