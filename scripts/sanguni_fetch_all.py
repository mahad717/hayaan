#!/usr/bin/env python3
"""Fetch all sanguni.so products via WooCommerce Store API through page_reader."""
import json, re, subprocess, time, sys

OUT = '/home/z/my-project/scripts/sanguni_all_products.json'
all_products = {}

def fetch_page(page, per_page=50):
    url = f"https://sanguni.so/wp-json/wc/store/v1/products?per_page={per_page}&page={page}"
    tmp = f'/home/z/my-project/scripts/sanguni_api_p{page}.json'
    r = subprocess.run(['z-ai', 'function', '-n', 'page_reader',
                        '-a', json.dumps({'url': url}), '-o', tmp],
                       capture_output=True, text=True, timeout=120)
    try:
        d = json.load(open(tmp))
        html = d['data'].get('html', '')
        # extract JSON array from <pre> wrapper
        m = re.search(r'<pre[^>]*>(.*)</pre>', html, re.S)
        raw = m.group(1) if m else html
        raw = raw.replace('&amp;', '&').replace('&quot;', '"').replace('&#039;', "'").replace('&lt;', '<').replace('&gt;', '>')
        items = json.loads(raw)
        return items
    except Exception as e:
        print(f"  page {page} parse error: {e}")
        return None

per_page = 10
empty_streak = 0
for page in range(1, 200):
    items = fetch_page(page, per_page)
    if items is None:
        time.sleep(3)
        items = fetch_page(page, per_page)  # one retry
    if not items:
        empty_streak += 1
        print(f"page {page}: empty/failed (streak {empty_streak})")
        if empty_streak >= 2:
            print("stop after 2 consecutive empty pages")
            break
        continue
    empty_streak = 0
    new = 0
    for p in items:
        if p['id'] not in all_products:
            all_products[p['id']] = p
            new += 1
    print(f"page {page}: {len(items)} items ({new} new), total {len(all_products)}")
    time.sleep(1.5)

with open(OUT, 'w') as f:
    json.dump(list(all_products.values()), f)
print(f"SAVED {len(all_products)} products -> {OUT}")
