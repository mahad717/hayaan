#!/usr/bin/env python3
"""Task 118 — live catalog snapshot grouped by category, to ground blog
batch 4 topic selection (catalog-gap pattern from Task 93)."""
import json
import urllib.request
from collections import Counter

req = urllib.request.Request("https://hayaan.co/api/products?limit=250", headers={"User-Agent": "task118-blog"})
data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
prods = data.get("products", data if isinstance(data, list) else [])
print("total products:", len(prods))
if prods:
    print("sample keys:", sorted(prods[0].keys()))
    cat_counter = Counter()
    for p in prods:
        c = p.get("category") or p.get("categoryName") or "?"
        if isinstance(c, dict):
            c = c.get("en") or c.get("name") or str(c)
        cat_counter[c] += 1
    for c, n in cat_counter.most_common(40):
        print(f"{n:3d}  {c}")
