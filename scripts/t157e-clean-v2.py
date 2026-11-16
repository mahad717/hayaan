#!/usr/bin/env python3
"""t157e: badge removal v2 - mask limited to the badge's own bounding box.
1) badge pixels P = blue|orange within (0..0.16w, 0..0.13h)
2) bbox(P) + margin  -> B
3) mask = badge pixels within B, dilated, clipped to B
4) white-fill, save -nb.jpg, verify ratios ~0
5) comparison sheet (original vs cleaned, top-left 35%) for spot check
"""
import os, json
from PIL import Image, ImageFilter, ImageDraw

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

def ratios(im, zone=0.15):
    w, h = im.size
    zw, zh = max(8, int(w * zone)), max(8, int(h * zone))
    px = list(im.crop((0, 0, zw, zh)).getdata())
    n = len(px)
    blue = sum(1 for r, g, b in px if b > r + 25 and b > g + 25 and b > 90) / n
    orange = sum(1 for r, g, b in px if r > b + 50 and r > g + 15 and r > 140) / n
    return blue, orange

report = {}
tiles = []
for fn in FILES:
    path = os.path.join(REPO, fn)
    orig = Image.open(path).convert('RGB')
    im = orig.copy()
    w, h = im.size
    zw, zh = int(w * 0.16), int(h * 0.13)
    region = im.crop((0, 0, zw, zh))
    pts = [(x, y) for y in range(zh) for x in range(zw) if is_badge(*region.getpixel((x, y)))]
    if not pts:
        print(fn, 'NO BADGE PIXELS in corner zone?!'); continue
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    mx, my = int(w * 0.015), int(h * 0.015)
    x0, y0 = max(0, min(xs) - mx), max(0, min(ys) - my)
    x1, y1 = min(w, max(xs) + mx), min(h, max(ys) + my)
    # mask: badge pixels inside bbox, dilated, clipped to bbox
    bw, bh = x1 - x0, y1 - y0
    sub = im.crop((x0, y0, x1, y1))
    mask = Image.new('L', (bw, bh), 0)
    mpx = mask.load()
    for y in range(bh):
        for x in range(bw):
            if is_badge(*sub.getpixel((x, y))):
                mpx[x, y] = 255
    dil = max(3, int(w / 2917 * 14))
    mask = mask.filter(ImageFilter.MaxFilter(dil * 2 + 1))
    npix = sum(1 for v in mask.getdata() if v)
    im.paste(Image.new('RGB', (bw, bh), (255, 255, 255)), (x0, y0), mask)
    b1, o1 = ratios(im)
    out = fn.rsplit('.', 1)[0] + '-nb.jpg'
    im.save(os.path.join(REPO, out), 'JPEG', quality=92, optimize=True)
    ok = b1 < 0.0005 and o1 < 0.0005
    report[fn] = {'bbox': [x0, y0, x1, y1], 'maskPixels': npix, 'after': [round(b1, 5), round(o1, 5)],
                  'out': out, 'clean': ok}
    print(f"{fn[:48]:50} bbox {x0},{y0}-{x1},{y1} mask {npix:>7} after {b1:.5f}/{o1:.5f} {'OK' if ok else 'FAIL'}")
    # comparison tile: orig left, cleaned right (top-left 35% region)
    cz = (0, 0, int(w * 0.35), int(h * 0.35))
    a = orig.crop(cz); bimg = im.crop(cz)
    tw = 260; th = int(a.height / a.width * tw)
    a = a.resize((tw, th)); bimg = bimg.resize((tw, th))
    t = Image.new('RGB', (tw * 2 + 4, th + 16), (255, 255, 255))
    t.paste(a, (0, 16)); t.paste(bimg, (tw + 4, 16))
    d = ImageDraw.Draw(t)
    d.text((2, 2), fn[:34], fill=(0, 0, 0))
    tiles.append(t)

json.dump(report, open('/home/z/my-project/scripts/t157-clean-report2.json', 'w'), indent=1)
cols = 2
rows = (len(tiles) + cols - 1) // cols
tw = tiles[0].width; th = max(t.height for t in tiles)
sh = Image.new('RGB', (cols * tw, rows * th), (255, 255, 255))
for i, t in enumerate(tiles):
    sh.paste(t, ((i % cols) * tw, (i // cols) * th))
sh.save('/home/z/my-project/scripts/t157-compare-sheet.png')
print('compare sheet', sh.size, '| ALL CLEAN' if all(v['clean'] for v in report.values()) else 'SOME FAILED')
