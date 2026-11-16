#!/usr/bin/env python3
"""Task 156 — gap filler: fetch the camera-accessories p3..p14 and
stationary p3..p4 pages that the crawler's dup-trap/retries missed,
using the slash-less pagination URL (proven), and merge into
sanguni-fresh-catalog.json. Reuses the crawler's parser via import.
"""
import importlib.util, json, re, sys, time
from pathlib import Path

ROOT = Path("/home/z/my-project/scripts")
spec = importlib.util.spec_from_file_location("crawler", ROOT / "t156-crawl-sanguni.py")
cw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cw)

OUT = Path("/home/z/my-project/scripts/t156/sanguni-fresh-catalog.json")
allp = json.load(open(OUT))

JOBS = [("camera-accessories", 3, 14), ("stationary", 3, 5)]

for cat, p_from, p_to in JOBS:
    print(f"[{cat}] pages {p_from}..{p_to}")
    for page in range(p_from, p_to + 1):
        url = f"https://sanguni.so/product-category/{cat}/page/{page}"
        raw = Path(cw.CRAWL_DIR) / f"{cat}_p{page}.json"
        h = cw.fetch(url, str(raw))
        if not h:
            print(f"  p{page}: EMPTY, skip")
            continue
        prods = cw.parse_products(h)
        if not prods:
            print(f"  p{page}: 0 products parsed, stop")
            break
        new = 0
        for k, v in prods.items():
            if k in allp:
                cats_of = allp[k].setdefault("cats", [])
                if cat not in cats_of:
                    cats_of.append(cat)
            else:
                v["cats"] = [cat]
                allp[k] = v
                new += 1
        print(f"  p{page}: +{len(prods)} parsed ({new} brand-new)", flush=True)
        if new == 0:
            print(f"  all-dup page, stop [{cat}]")
            break
        time.sleep(cw.PACE)
    json.dump(allp, open(OUT, "w"), indent=1)

print(f"[done] {len(allp)} unique products")
