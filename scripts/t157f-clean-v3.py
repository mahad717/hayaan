#!/usr/bin/env python3
"""t157f: badge removal v3 - measure true badge bbox per image within (22%, 24%) zone,
mask badge pixels inside bbox+margin, dilate, white-fill, verify zero residual in 25% zone."""
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

def badge_pixels(im, zx, zy):
    w, h = im.size
    zw, zh = int(w * zx), int(h * zy)
    return [(x, y) for y in range(zh) for x in range(zw) if is_badge(*im.getpixel((x, y)))]

report = {}
tiles = []
bboxes = {}
for fn in FILES:
    path = os.path.join(REPO, fn)
    orig = Image.open(path).convert('RGB')
    im = orig.copy()
    w, h = im.size
    pts = badge_pixels(orig, 0.22, 0.24)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    bboxes[fn] = bbox
    print(f"{fn[:48]:50} badge bbox {bbox}  n={len(pts)}")
    mx, my = int(w * 0.012), int(h * 0.012)
    x0, y0 = max(0, bbox[0] - mx), max(0, bbox[1] - my)
    x1, y1 = min(w, bbox[2] + mx), min(h, bbox[3] + my)
    bw, bh = x1 - x0, y1 - y0
    sub = im.crop((x0, y0, x1, y1))
    mask = Image.new('L', (bw, bh), 0)
    mpx = mask.load()
    for y in range(bh):
        for x in range(bw):
            if is_badge(*sub.getpixel((x, y))):
                mpx[x, y] = 255
    dil = max(3, int(w / 2917 * 12))
    mask = mask.filter(ImageFilter.MaxFilter(dil * 2 + 1))
    npix = sum(1 for v in mask.getdata() if v)
    im.paste(Image.new('RGB', (bw, bh), (255, 255, 255)), (x0, y0), mask)
    # verify: no badge pixels left anywhere in 25% zone
    resid = len(badge_pixels(im, 0.25, 0.25))
    out = fn.rsplit('.', 1)[0] + '-nb.jpg'
    im.save(os.path.join(REPO, out), 'JPEG', quality=92, optimize=True)
    ok = resid == 0
    report[fn] = {'bbox': list(bbox), 'maskPixels': npix, 'residual': resid, 'out': out, 'clean': ok}
    print(f"   -> mask {npix} residual {resid} {'OK' if ok else 'FAIL'}")
    cz = (0, 0, int(w * 0.35), int(h * 0.40))
    a = orig.crop(cz); bimg = im.crop(cz)
    tw = 260; th = int(a.height / a.width * tw)
    a = a.resize((tw, th)); bimg = bimg.resize((tw, th))
    t = Image.new('RGB', (tw * 2 + 4, th + 16), (255, 255, 255))
    t.paste(a, (0, 16)); t.paste(bimg, (tw + 4, 16))
    d = ImageDraw.Draw(t)
    d.text((2, 2), fn[:34], fill=(0, 0, 0))
    tiles.append(t)

json.dump({'bboxes': {k: list(v) for k, v in bboxes.items()}, 'report': report},
          open('/home/z/my-project/scripts/t157-clean-report3.json', 'w'), indent=1)
cols = 2
rows = (len(tiles) + cols - 1) // cols
tw = tiles[0].width; th = max(t.height for t in tiles)
sh = Image.new('RGB', (cols * tw, rows * th), (255, 255, 255))
for i, t in enumerate(tiles):
    sh.paste(t, ((i % cols) * tw, (i // cols) * th))
sh.save('/home/z/my-project/scripts/t157-compare-sheet3.png')
print('compare sheet3 saved', sh.size, '|', 'ALL CLEAN' if all(v['clean'] for v in report.values()) else 'SOME FAILED')
