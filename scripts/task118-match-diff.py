#!/usr/bin/env python3
"""Task 118: match the 141-product live catalog to sanguni listings and diff prices.
Map sources (our slug -> sanguni slug):
  1. image_targets.json  (94 products, Task 53, hand-verified)
  2. task91-payload.json (44 mobiles, supplierUrl)
  3. manual PS5 map (2)
  A18 (samsung-galaxy-a18) intentionally EXCLUDED — owner hand-priced at $190.
Output: scripts/task118-diff.json + printed table.
"""
import json, re, sys

BASE = "/home/z/my-project/scripts"
catalog = json.load(open(f"{BASE}/task118-catalog-baseline.json"))["products"]
sang = json.load(open(f"{BASE}/task118-sanguni-prices.json"))

smap = {}  # our_slug -> sanguni_slug

for it in json.load(open(f"{BASE}/image_targets.json")):
    u = it.get("sanguni_url", "")
    m = re.search(r"/product/([^/]+)/?", u)
    if m:
        smap[it["slug"]] = m.group(1)

for p in json.load(open(f"{BASE}/task91-payload.json")):
    u = p.get("supplierUrl", "")
    m = re.search(r"/product/([^/]+)/?", u)
    if m:
        smap[p["slug"]] = m.group(1)

smap.update({
    "sony-playstation-5-digital-edition-slim": "playstation5-digital-edition-slim",
    "sony-playstation-5-pro-2tb": "playstation-sony-5pro-2tb-slim",
})

rows = []
unmapped = []
for p in catalog:
    slug = p["slug"]
    if slug == "samsung-galaxy-a18":
        rows.append({"slug": slug, "name": p["name"], "ours": p["price"],
                     "sanguni": None, "delta": None, "status": "a18-owner-priced",
                     "sanguni_slug": None, "oos": False})
        continue
    ss = smap.get(slug)
    if not ss:
        unmapped.append(p)
        rows.append({"slug": slug, "name": p["name"], "ours": p["price"], "sanguni": None,
                     "delta": None, "status": "no-map", "sanguni_slug": None, "oos": False})
        continue
    item = sang.get(ss)
    if not item:
        rows.append({"slug": slug, "name": p["name"], "ours": p["price"], "sanguni": None,
                     "delta": None, "status": "missing-on-sanguni", "sanguni_slug": ss, "oos": False})
        continue
    d = round(item["price"] - p["price"], 2)
    st = "changed" if abs(d) > 0.005 else "same"
    rows.append({"slug": slug, "name": p["name"], "ours": p["price"], "sanguni": item["price"],
                 "delta": d, "status": st, "sanguni_slug": ss, "oos": item["oos"],
                 "was_sale": item.get("was_sale", False)})

changed = [r for r in rows if r["status"] == "changed"]
same = [r for r in rows if r["status"] == "same"]
nomap = [r for r in rows if r["status"] in ("no-map", "missing-on-sanguni")]
a18 = [r for r in rows if r["status"] == "a18-owner-priced"]

json.dump({"rows": rows, "unmapped_products": unmapped},
          open(f"{BASE}/task118-diff.json", "w"), indent=1)

print(f"catalog={len(catalog)}  mapped={len(smap)}  crawl={len(sang)}")
print(f"CHANGED={len(changed)}  SAME={len(same)}  NO-MAP/MISSING={len(nomap)}  A18(skip)={len(a18)}")
print("\n--- NO MAP / MISSING ON SANGUNI ---")
for r in nomap:
    print(f"  {r['slug']:55} ours=${r['ours']}")
print("\n--- CHANGED (ours -> sanguni) ---")
for r in sorted(changed, key=lambda x: x["name"]):
    tag = " [OOS]" if r["oos"] else ""
    sale = " [sale]" if r.get("was_sale") else ""
    print(f"  {r['name'][:48]:48} ${r['ours']:>8} -> ${r['sanguni']:>9} ({r['delta']:+.2f}){tag}{sale}")
