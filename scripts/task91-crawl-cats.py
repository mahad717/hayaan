#!/usr/bin/env python3
"""Task 91: crawl sanguni.so PHONE categories via category HTML pages (path pagination,
page_reader ignores query params). Parse Woodmart cards -> name, slug, price.
Output: scripts/task91-sanguni-phones.json  {cat: [{name, slug, prices}]}
"""
import subprocess, json, re, html as ih, time, os

CATS = [
    ("mobile-accessories/iphone", "iphone"),
    ("mobile-accessories/samsung", "samsung"),
    ("mobile-accessories/nokia", "nokia"),
    ("new-arrivals", "new-arrivals"),
]
OUT = "/home/z/my-project/scripts/task91-sanguni-phones.json"


def fetch(url, out):
    subprocess.run(
        ["z-ai", "function", "-n", "page_reader", "-a", json.dumps({"url": url}), "-o", out],
        capture_output=True, text=True, timeout=180,
    )
    try:
        d = json.load(open(out))
        return d["data"].get("html", "")
    except Exception:
        return ""


def parse_products(h):
    """Extract (name, slug, price) from a Woodmart category page."""
    out = []
    seen = set()
    for m in re.finditer(r"wd-entities-title", h):
        seg = h[m.start(): m.start() + 4000]
        t = re.search(r'<a href="(https://sanguni\.so/product/[^"]+)"[^>]*>([^<]+)</a>', seg)
        if not t:
            continue
        name = ih.unescape(t.group(2)).strip()
        slug = t.group(1).replace("https://sanguni.so/product/", "").rstrip("/")
        if slug in seen:
            continue
        seen.add(slug)
        pm = re.findall(
            r'woocommerce-Price-currencySymbol">([^<]+)</span>\s*([\d,.]+)</bdi>', seg)
        out.append({"name": name, "slug": slug, "prices": pm[:3]})
    return out


def crawl(cat_path, label):
    all_p, page = [], 1
    while page <= 20:
        base = f"https://sanguni.so/product-category/{cat_path}/"
        url = base if page == 1 else f"{base}page/{page}/"
        raw = f"/tmp/task91_cat_{label}_p{page}.html"
        h = fetch(url, raw)
        if not h:
            print(f"  [{label} p{page}] EMPTY html", flush=True)
            break
        prods = parse_products(h)
        print(f"  [{label} p{page}] {len(prods)} products (html {len(h)})", flush=True)
        if not prods:
            break
        known = {p["slug"] for p in all_p}
        prods = [p for p in prods if p["slug"] not in known]
        all_p.extend(prods)
        if len(prods) == 0:
            break
        page += 1
        time.sleep(6)  # pace to avoid 429
    return all_p


def main():
    results = {}
    for cat_path, label in CATS:
        print(f"→ {label} ({cat_path})", flush=True)
        results[label] = crawl(cat_path, label)
        print(f"  TOTAL {label}: {len(results[label])}", flush=True)
        time.sleep(4)
    json.dump(results, open(OUT, "w"), indent=1)
    print("SAVED ->", OUT)
    for k, v in results.items():
        print(f"  {k}: {len(v)}")


if __name__ == "__main__":
    main()
