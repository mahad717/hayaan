#!/usr/bin/env python3
"""t157d: remove sanguni badge (blue hexagon + orange G) from top-left corner.
Mask = badge-colored pixels dilated; replace with white; verify ratios drop to ~0.
Outputs <stem>-nb.jpg next to original + cleaned corner sheet."""
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
    im = Image.open(path).convert('RGB')
    w, h = im.size
    b0, o0 = ratios(im)
    # badge mask over top-left 30% zone
    zw, zh = int(w * 0.30), int(h * 0.30)
    region = im.crop((0, 0, zw, zh))
    mask = Image.new('L', (zw, zh), 0)
    mpx = mask.load()
    rpx = region.load()
    for y in range(zh):
        for x in range(zw):
            r, g, b = rpx[x, y]
            if (b > r + 25 and b > g + 25 and b > 90) or (r > b + 50 and r > g + 15 and r > 140):
                mpx[x, y] = 255
    dil = int(w / 2917 * 14) or 3
    mask = mask.filter(ImageFilter.MaxFilter(dil * 2 + 1))
    npix = sum(1 for v in mask.getdata() if v)
    # paste white through mask
    white = Image.new('RGB', (zw, zh), (255, 255, 255))
    im.paste(white, (0, 0), mask)
    b1, o1 = ratios(im)
    out = fn.rsplit('.', 1)[0] + '-nb.jpg'
    im.save(os.path.join(REPO, out), 'JPEG', quality=92, optimize=True)
    ok = b1 < 0.0005 and o1 < 0.0005
    report[fn] = {'before': [round(b0, 4), round(o0, 4)], 'after': [round(b1, 5), round(o1, 5)],
                  'maskPixels': npix, 'out': out, 'clean': ok}
    print(f"{fn[:52]:54} before {b0:.4f}/{o0:.4f} after {b1:.5f}/{o1:.5f} mask {npix:>7} {'OK' if ok else 'FAIL'}")
    # corner tile for sheet
    tile = im.crop((0, 0, max(8, int(w*0.2)), max(8, int(h*0.2)))).resize((300, 300), Image.LANCZOS)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, 299, 13], fill=(0, 0, 0))
    d.text((4, 2), out[:40], fill=(0, 90, 0))
    tiles.append(tile)

json.dump(report, open('/home/z/my-project/scripts/t157-clean-report.json', 'w'), indent=1)
cols = 4
rows = (len(tiles) + cols - 1) // cols
sh = Image.new('RGB', (cols * 300, rows * 300), (255, 255, 255))
for i, t in enumerate(tiles):
    sh.paste(t, ((i % cols) * 300, (i // cols) * 300))
sh.save('/home/z/my-project/scripts/t157-cleaned-sheet.png')
print('cleaned sheet saved;', 'ALL CLEAN' if all(v['clean'] for v in report.values()) else 'SOME FAILED')
