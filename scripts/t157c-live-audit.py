#!/usr/bin/env python3
"""t157c: live-catalog image audit.
1) fetch public products  2) classify each image URL host
3) download non-repo images  4) badge-detect everything
5) write affected-product map json
"""
import os, json, subprocess, hashlib
from PIL import Image
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://hayaan.co'
REPO_DIR = '/home/z/my-project/public/images/products'
DL_DIR = '/tmp/t157-imgs'
os.makedirs(DL_DIR, exist_ok=True)

REPO_FLAGGED = {
    'cable-adapter-lightning-to-ethernet-rj45.jpg', 'dji-mic-mini-mobile-phone-adapter.jpg',
    'hp-monitor-series-5-27-inch-with-speakers.jpg', 'hp-printer-color-laserjet-pro-mfp-4303fdw.jpg',
    'iphone-duo-256gb-esim.jpg', 'lens-cleaning-kit-kf-concept.jpg',
    'msi-cyborg-15-gaming-intel-core-7-240h.jpg', 'portable-ssd-2tb-sandisk-1000mb-s-2.jpg',
    'power-bank-20000mah-green-lion-35w.jpg', 'power-bank-porodo-30000mah-with-integrated-cable.jpg',
    'power-extension-omega-5-outlet.jpg', 'printer-canon-image-runner-2425i-monochrome-a3-multifunctional.jpg',
    'samsung-galaxy-z-fold8-5g.jpg', 'ssd-lexar-ns100-512gb-2-5-sata-iii.jpg',
    'unifi-usw-48poe-network-switch-managed.jpg',
}

def corners_hit(path):
    """True if ANY of the 4 corners (20% zone) has blue+orange badge colors."""
    try:
        im = Image.open(path).convert('RGB')
    except Exception:
        return None
    w, h = im.size
    zw, zh = max(8, int(w * 0.20)), max(8, int(h * 0.20))
    for x0, y0 in [(0, 0), (w - zw, 0), (0, h - zh), (w - zw, h - zh)]:
        px = list(im.crop((x0, y0, x0 + zw, y0 + zh)).getdata())
        n = len(px)
        blue = sum(1 for r, g, b in px if b > r + 25 and b > g + 25 and b > 90) / n
        orange = sum(1 for r, g, b in px if r > b + 50 and r > g + 15 and r > 140) / n
        if blue > 0.002 and orange > 0.002:
            return True
    return False

# 1. live catalog
subprocess.run(['curl', '-s', f'{BASE}/api/products?limit=500', '-o', '/tmp/t157-products.json'], check=True)
data = json.load(open('/tmp/t157-products.json'))
prods = data.get('products', data)
print('products:', len(prods))

# 2. classify URLs
url_host = {}
for p in prods:
    for u in (p.get('images') or []):
        if '/images/products/' in u and u.startswith(BASE):
            url_host[u] = 'repo'
        else:
            url_host[u] = 'other'
uniq = sorted(url_host)
print('unique image urls:', len(uniq), '| repo:', sum(1 for v in url_host.values() if v == 'repo'),
      '| other:', sum(1 for v in url_host.values() if v == 'other'))

# 3. download non-repo urls
others = [u for u in uniq if url_host[u] == 'other']

def dl(u):
    name = hashlib.md5(u.encode()).hexdigest()[:16] + '.img'
    path = os.path.join(DL_DIR, name)
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        subprocess.run(['curl', '-s', '--max-time', '60', '-o', path, u], check=False)
    return u, path

with ThreadPoolExecutor(max_workers=8) as ex:
    dlmap = dict(ex.map(dl, others))
print('downloaded:', sum(1 for p in dlmap.values() if os.path.exists(p) and os.path.getsize(p) > 0), '/', len(others))

# 4. detect on non-repo
flagged_other = set()
for u, path in dlmap.items():
    if os.path.exists(path) and os.path.getsize(path) > 0:
        hit = corners_hit(path)
        if hit:
            flagged_other.add(u)
print('flagged non-repo urls:', len(flagged_other))
for u in sorted(flagged_other):
    print('   FLAG-OTHER:', u)

# 5. affected-product map
affected = []
for p in prods:
    imgs = p.get('images') or []
    flags = []
    for u in imgs:
        if url_host.get(u) == 'repo':
            fn = u.rsplit('/images/products/', 1)[-1]
            if fn in REPO_FLAGGED:
                flags.append({'url': u, 'kind': 'repo', 'file': fn})
        elif u in flagged_other:
            flags.append({'url': u, 'kind': 'other', 'file': dlmap[u]})
    if flags:
        affected.append({'id': p['id'], 'slug': p['slug'], 'name': p['name'], 'flags': flags})

json.dump({'repoFlagged': sorted(REPO_FLAGGED), 'flaggedOther': sorted(flagged_other),
           'affected': affected, 'urlHost': {u: url_host[u] for u in uniq}},
          open('/home/z/my-project/scripts/t157-live-audit.json', 'w'), indent=1)
print('\nAFFECTED PRODUCTS:', len(affected))
for a in affected:
    print(f"  {a['slug']}: {[f['kind'] + ':' + (f['file'] if f['kind']=='repo' else f['url'][:60]) for f in a['flags']]}")

# sheet of flagged non-repo corners for visual check
if flagged_other:
    from PIL import ImageDraw
    tiles = []
    for u in sorted(flagged_other):
        im = Image.open(dlmap[u]).convert('RGB')
        w, h = im.size
        zw, zh = max(8, int(w * 0.2)), max(8, int(h * 0.2))
        corner = im.crop((0, 0, zw, zh)).resize((300, 300), Image.LANCZOS)
        d = ImageDraw.Draw(corner)
        d.rectangle([0, 0, 299, 13], fill=(0, 0, 0))
        d.text((4, 2), u[-44:], fill=(255, 255, 0))
        tiles.append(corner)
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sh = Image.new('RGB', (cols * 300, rows * 300), (255, 255, 255))
    for i, t in enumerate(tiles):
        sh.paste(t, ((i % cols) * 300, (i // cols) * 300))
    sh.save('/home/z/my-project/scripts/t157-other-sheet.png')
    print('other-sheet saved')
