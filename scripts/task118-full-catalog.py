#!/usr/bin/env python3
"""Task 118 — full catalog (141 SKUs) from Supabase via service-role REST,
grouped by category with price ladders, to ground blog batch 4 topic picks."""
import json
from pathlib import Path

env = dict(
    l.split("=", 1) for l in Path("/home/z/my-project/.env").read_text().splitlines()
    if "=" in l and not l.startswith("#")
)
URL, SK = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
hdr = {"apikey": SK, "Authorization": f"Bearer {SK}"}

import urllib.request
rows = json.loads(urllib.request.urlopen(urllib.request.Request(
    URL + "/rest/v1/products?select=name,slug,price,product_type,categories(name)&is_active=eq.true&order=category_id",
    headers=hdr), timeout=30).read().decode())

from collections import defaultdict
by_cat = defaultdict(list)
for r in rows:
    cat = (r.get("categories") or {}).get("name") or "?"
    by_cat[cat].append(r)

for cat in sorted(by_cat):
    items = sorted(by_cat[cat], key=lambda r: r["price"] or 0)
    prices = [r["price"] for r in items if r.get("price") is not None]
    print(f"\n== {cat} ({len(items)} SKU, ${min(prices):.0f}-${max(prices):.0f}) ==" if prices else f"\n== {cat} ({len(items)} SKU) ==")
    for r in items:
        pt = r.get("product_type") or ""
        print(f"  ${r['price']:>7.2f}  {r['name'][:72]}" + ("  [DIGITAL]" if pt == "digital" else ""))
