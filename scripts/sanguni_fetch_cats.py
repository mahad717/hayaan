#!/usr/bin/env python3
"""Fetch key sanguni.so category pages via page_reader, extract product name+price."""
import subprocess, json, re, html as ih, time, os

CATS = [
    ('mobile-accessories', 'Mobile & Accessories (all)'),
    ('computer-accessories/laptop', 'Laptops'),
    ('home-appliances/tv', 'TVs'),
    ('mobile-accessories/headphone', 'Headphones/Earbuds'),
    ('mobile-accessories/watchs', 'Smart Watches'),
    ('home-appliances/kitchen', 'Kitchen Appliances'),
    ('computer-accessories/network/router', 'Routers/Networking'),
    ('camera-accessories/camera', 'Cameras'),
    ('home-appliances/air-condition', 'Air Conditioners'),
    ('projector', 'Projectors'),
    ('mobile-accessories/samsung', 'Samsung'),
    ('home-appliances/water-dispenser', 'Water Dispensers'),
]

def fetch(url, out):
    subprocess.run(['z-ai', 'function', '-n', 'page_reader',
                    '-a', json.dumps({'url': url}), '-o', out],
                   capture_output=True, text=True, timeout=120)
    try:
        d = json.load(open(out))
        return d['data'].get('html', '')
    except Exception:
        return ''

def parse_products(h):
    """Extract (name, slug, price_list) from a Woodmart category page."""
    out = []
    spans = [m.start() for m in re.finditer(r'wd-entities-title', h)]
    for s in spans:
        seg = h[s:s + 4000]
        t = re.search(r'<a href="(https://sanguni\.so/product/[^"]+)"[^>]*>([^<]+)</a>', seg)
        if not t:
            continue
        name = ih.unescape(t.group(2)).strip()
        slug = t.group(1).replace('https://sanguni.so/product/', '').rstrip('/')
        # price block usually right after title
        pm = re.findall(
            r'woocommerce-Price-currencySymbol">([^<]+)</span>\s*([\d,.]+)</bdi>', seg)
        out.append({'name': name, 'slug': slug, 'prices': pm[:4]})
    return out

results = {}
for cat, label in CATS:
    fname = f"/home/z/my-project/scripts/catpg_{cat.replace('/', '_')}.json"
    h = fetch(f'https://sanguni.so/product-category/{cat}/', fname)
    if not h:
        print(f"[{cat}] EMPTY/FAILED, waiting 30s and retrying once...")
        time.sleep(30)
        h = fetch(f'https://sanguni.so/product-category/{cat}/', fname)
    prods = parse_products(h)
    results[cat] = {'label': label, 'count': len(prods), 'products': prods}
    print(f"[{cat}] {len(prods)} products, html={len(h)}")
    for p in prods[:12]:
        print('   -', p['name'], '|', p['prices'])
    time.sleep(12)  # pace to avoid 429

json.dump(results, open('/home/z/my-project/scripts/sanguni_categories.json', 'w'), indent=1)
print('SAVED -> scripts/sanguni_categories.json')
