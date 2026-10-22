#!/usr/bin/env python3
"""Task 118 round-3 FINAL mapping + diff.
Layers: (1) slug-keyed (image_targets/task91/PS5), (2) name-keyed from the same
sources, (3) manual overrides resolved from the fresh crawl.
Output: scripts/task118-diff-final.json"""
import json, re, unicodedata

BASE = "/home/z/my-project/scripts"


def norm(n: str) -> str:
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    n = re.sub(r"^refurbished\s+", "", n.strip(), flags=re.I)
    return re.sub(r"[^a-z0-9]+", "", n.lower())


catalog = json.load(open(f"{BASE}/task118-catalog-baseline.json"))["products"]
sang = json.load(open(f"{BASE}/task118-sanguni-prices.json"))

smap = {}   # our slug -> sanguni slug
name2s = {} # normalized OUR-NAME -> sanguni slug (authoritative hand-verified sources)

for it in json.load(open(f"{BASE}/image_targets.json")):
    m = re.search(r"/product/([^/]+)/?", it.get("sanguni_url", ""))
    if not m:
        continue
    smap[it["slug"]] = m.group(1)
    name2s[norm(it["name"])] = m.group(1)

for p in json.load(open(f"{BASE}/task91-payload.json")):
    m = re.search(r"/product/([^/]+)/?", p.get("supplierUrl", ""))
    if not m:
        continue
    smap[p["slug"]] = m.group(1)
    name2s[norm(p["name"])] = m.group(1)

# manual overrides (PS5 from Task 77 records; rest resolved against fresh crawl)
smap.update({
    "sony-playstation-5-digital-edition-slim": "playstation5-digital-edition-slim",
    "sony-playstation-5-pro-2tb": "playstation-sony-5pro-2tb-slim",
    "cable-charge-usb-c-1m": "cable-charge-usb-c-1m-normal",
    "nokia-5710-xpressaudio": "nokia-5710-xpress-audio",
    "asus-tuf-fx507-gaming-i7-13gen": "asus-tuf-fx507gaming-intel-core-i7-13gen",
    "tp-link-840n-wi-fi-router": "tp-link-840n",
    "macbook-pro-m3": "apple-macbook-pro-m3-3",      # $1350 listing (m3-2 is $1785)
    "macbook-pro-m4": "apple-macbook-pro-m4-2",      # $1720 listing (m4 is $1850)
    "macbook-pro-m5": "apple-macbook-pro-m5",        # $1900 listing (m5-2 is $2350)
    "macbook-air-m5": "apple-macbook-air-m5",
    "maxwell-smart-watch-(budget-line)": "maxwell-lynx-smart-watch",  # all Maxwell $55
})

rows = []
for p in catalog:
    slug, ours = p["slug"], p["price"]
    if slug == "samsung-galaxy-a18":
        rows.append({"slug": slug, "name": p["name"], "ours": ours, "sanguni": 190.0,
                     "delta": None, "status": "a18-owner-priced", "sanguni_slug": None,
                     "oos": False, "method": "excluded"})
        continue
    ss = smap.get(slug) or name2s.get(norm(p["name"]))
    method = "slug" if slug in smap else ("name" if ss else None)
    if not ss:
        rows.append({"slug": slug, "name": p["name"], "ours": ours, "sanguni": None,
                     "delta": None, "status": "unmapped", "sanguni_slug": None,
                     "oos": False, "method": "none"})
        continue
    item = sang.get(ss)
    if not item:
        rows.append({"slug": slug, "name": p["name"], "ours": ours, "sanguni": None,
                     "delta": None, "status": "missing-on-sanguni", "sanguni_slug": ss,
                     "oos": False, "method": method})
        continue
    d = round(item["price"] - ours, 2)
    st = "changed" if abs(d) > 0.005 else "same"
    rows.append({"slug": slug, "name": p["name"], "ours": ours, "sanguni": item["price"],
                 "delta": d, "status": st, "sanguni_slug": ss, "oos": item["oos"],
                 "method": method})

changed = [r for r in rows if r["status"] == "changed"]
same = [r for r in rows if r["status"] == "same"]
un = [r for r in rows if r["status"] in ("unmapped", "missing-on-sanguni")]
by = {}
for r in rows:
    by[r["status"]] = by.get(r["status"], 0) + 1

json.dump({"rows": rows}, open(f"{BASE}/task118-diff-final.json", "w"), indent=1)

print(f"catalog=141 crawl={len(sang)}  status: {by}")
print("\n--- UNMAPPED (left untouched) ---")
for r in un:
    print(f"  {r['slug']:60} ours=${r['ours']}  ({r['status']})")
print(f"\n--- CHANGED ({len(changed)}) ours -> sanguni ---")
for r in sorted(changed, key=lambda x: -abs(x["delta"])):
    tag = (" [OOS]" if r["oos"] else "") + (f" via {r['method']}" if r["method"] == "name" else "")
    print(f"  {r['name'][:44]:44} ${r['ours']:>7} -> ${r['sanguni']:>8} ({r['delta']:+.2f}){tag}")
print(f"\n--- SAME ({len(same)}) sampled 10 ---")
for r in same[:10]:
    print(f"  {r['name'][:44]:44} ${r['ours']:>7} == ${r['sanguni']:>8}")
