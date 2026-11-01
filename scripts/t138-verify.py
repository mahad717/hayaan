#!/usr/bin/env python3
"""Task 138 prod verification — SSR fingerprints + structured data checks."""
import json
import re
import subprocess
import sys

BASE = "https://hayaan.co"
results = []


def get(path):
    r = subprocess.run(
        ["curl", "-s", "--max-time", "40", f"{BASE}{path}"],
        capture_output=True, text=True,
    )
    return r.stdout


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


PDPS = [
    ("samsung-galaxy-a17", "Samsung Galaxy A17 Price in Somalia — $170 | Hayaan Market", "$170", "4GB of RAM"),
    ("samsung-galaxy-a17-6gb128gb", "Samsung Galaxy A17 6GB/128GB Price in Somalia — $220 | Hayaan Market", "$220", "6GB/128GB"),
    ("samsung-galaxy-a17-8gb256gb", "Samsung Galaxy A17 8GB/256GB Price in Somalia — $240 | Hayaan Market", "$240", "8GB/256GB"),
]

for slug, want_title, want_price, uniq in PDPS:
    h = get(f"/product/{slug}")
    t = re.search(r"<title>(.*?)</title>", h, re.S)
    title = t.group(1).strip() if t else ""
    check(f"{slug}: SSR title", want_title in title, f"[{title[:70]}]")
    check(f"{slug}: unique fingerprint in HTML", f"A17 {uniq}" in h or uniq in h, uniq)
    # JSON-LD graph
    lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    prod_ok = faq_ok = False
    faq_n = 0
    for raw in lds:
        try:
            j = json.loads(raw)
        except Exception:
            continue
        for node in j.get("@graph", []):
            if node.get("@type") == "Product":
                offers = node.get("offers", {})
                brand = (node.get("brand") or {}).get("name")
                prod_ok = (
                    offers.get("price") == want_price.replace("$", "") + ".00"
                    and offers.get("priceCurrency") == "USD"
                    and brand == "Samsung"
                    and offers.get("availability") == "https://schema.org/InStock"
                )
            if node.get("@type") == "FAQPage":
                faq_n = len(node.get("mainEntity", []))
                faq_ok = faq_n >= 4 and all(
                    q.get("acceptedAnswer", {}).get("text") for q in node.get("mainEntity", [])
                )
    check(f"{slug}: Product JSON-LD price/brand/stock", prod_ok)
    check(f"{slug}: FAQPage JSON-LD >=4 Q&A", faq_ok, f"{faq_n} questions")
    check(f"{slug}: visible intro (AEO)", "price in Somalia is" in h and "delivered to your door in Mogadishu" in h)
    check(f"{slug}: meta description live price", f"price in Somalia: {want_price} at Hayaan Market" in h)

# sitemap
sm = get("/sitemap.xml")
for slug, _, _, _ in PDPS:
    check(f"sitemap: /product/{slug}", f"/product/{slug}</loc>" in sm)

# category page shows both variants
cat = get("/category/phones-wearables")
check("category: 8GB/256GB card", "Samsung Galaxy A17 (8GB/256GB)" in cat)
check("category: 6GB/128GB card", "Samsung Galaxy A17 (6GB/128GB)" in cat)

# blog AEO patches live (unique strings from this deploy)
blog = get("/blog/samsung-galaxy-a18-price-in-somalia")
check("blog: $145–$240 ladder heading", "The $145–$240 ladder" in blog)
check("blog: A17 ladder item $170 + variants", "now in three variants" in blog and "8GB/256GB top model at $240" in blog)
check("blog: A56 $375", "Galaxy A56 5G at $375" in blog)
check("blog: no stale A17 $165", "A17 at $165" not in blog and "A17 ($165)" not in blog and "Galaxy A17 — $165" not in blog)

bad = [n for n, ok, _ in results if not ok]
print(f"\n== {len(results) - len(bad)}/{len(results)} PASS ==")
sys.exit(1 if bad else 0)
