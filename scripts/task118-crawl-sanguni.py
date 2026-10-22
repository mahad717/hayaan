#!/usr/bin/env python3
"""Task 118: crawl sanguni.so current prices via top-level category pages
(path pagination, z-ai page_reader — direct curl is JS-challenge-blocked).
Output: scripts/task118-sanguni-prices.json  {slug: {name, price, sale, oos, url, cats}}
Pilot:  PILOT=1 python3 ...  (single page, validate parsing before full run)
Resume: per-page HTML cached in scripts/task118-crawl/ — re-run skips fetched pages.
"""
import subprocess, json, re, html as ih, time, os, sys

OUT = "/home/z/my-project/scripts/task118-sanguni-prices.json"
CRAWL_DIR = "/home/z/my-project/scripts/task118-crawl"
os.makedirs(CRAWL_DIR, exist_ok=True)

# top-level category paths to cover the whole catalog
CATS_FILTER = os.environ.get("CATS", "")
CATS = [
    "mobile-accessories",
    "computer-accessories",
    "camera-accessories",
    "home-appliances",
    "printer-ink",
    "stationary",
]
if CATS_FILTER:
    CATS = [c for c in CATS if c in CATS_FILTER.split(",")]
PACE = 8          # seconds between page_reader calls
MAXP = 40         # per-category page cap


def fetch(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 500:
        try:
            return json.load(open(out))["data"].get("html", "")
        except Exception:
            pass
    for attempt in range(3):
        subprocess.run(
            ["z-ai", "function", "-n", "page_reader", "-a", json.dumps({"url": url}), "-o", out],
            capture_output=True, text=True, timeout=180,
        )
        try:
            h = json.load(open(out))["data"].get("html", "")
        except Exception:
            h = ""
        if h and len(h) > 2000:
            return h
        print(f"    retry {attempt+1} (html {len(h)})", flush=True)
        time.sleep(10)
    return ""


def parse_products(h):
    """Woodmart category cards -> {slug: {name, price, sale, oos, url}}."""
    out = {}
    marks = [m.start() for m in re.finditer(r"wd-entities-title", h)]
    for i, s in enumerate(marks):
        seg = h[s: marks[i + 1]] if i + 1 < len(marks) else h[s: s + 5000]
        t = re.search(r'<a href="(https://sanguni\.so/product/([^"/]+)/?)"[^>]*>([^<]+)</a>', seg)
        if not t:
            continue
        slug, name = t.group(2), ih.unescape(t.group(3)).strip()
        # price pairs: capture whether inside <ins> (sale/eff) or <del> (old)
        eff = None
        reg = None
        for pm in re.finditer(r"<(ins|del)>.*?currencySymbol\">[^<]*</span>\s*([\d,.]+)</bdi>", seg, re.S):
            amt = float(pm.group(2).replace(",", ""))
            if pm.group(1) == "ins":
                eff = amt
            else:
                reg = amt
        if eff is None:
            m1 = re.search(r"currencySymbol\">[^<]*</span>\s*([\d,.]+)</bdi>", seg)
            if m1:
                eff = float(m1.group(1).replace(",", ""))
        if eff is None:
            continue
        out[slug] = {
            "name": name,
            "price": eff,
            "was_sale": reg is not None,
            "oos": "out-of-stock" in seg or "Out of stock" in seg,
            "url": f"https://sanguni.so/product/{slug}/",
        }
    return out


def crawl_cat(cat):
    """Paginate a category archive; returns {slug: item} merged over all pages."""
    merged = {}
    for page in range(1, MAXP + 1):
        base = f"https://sanguni.so/product-category/{cat}/"
        url = base if page == 1 else f"{base}page/{page}/"
        raw = f"{CRAWL_DIR}/{cat.replace('/', '_')}_p{page}.json"
        h = fetch(url, raw)
        if not h:
            print(f"  [{cat} p{page}] EMPTY -> stop", flush=True)
            break
        prods = parse_products(h)
        # results header e.g. "Showing 1–12 of 184 results"
        hm = re.search(r"[Ss]howing[^0-9]*\d+[^0-9]*(\d+)[^0-9]*of[^0-9]*(\d+)", ih.unescape(re.sub(r"<[^>]+>", " ", h)))
        total = hm.group(2) if hm else "?"
        if not prods:
            print(f"  [{cat} p{page}] 0 products (total~{total}) -> stop", flush=True)
            break
        dup = sum(1 for k in prods if k in merged)
        merged.update(prods)
        print(f"  [{cat} p{page}] +{len(prods)} (dup {dup}, merged {len(merged)}, total~{total})", flush=True)
        if dup == len(prods):  # fully duplicated page = cache/loop trap
            print(f"  [{cat}] all-dup page, stop", flush=True)
            break
        time.sleep(PACE)
    return merged


def main():
    pilot = os.environ.get("PILOT") == "1"
    allp = {}
    if os.path.exists(OUT):  # resume: merge previous partial results
        try:
            allp = json.load(open(OUT))
            print(f"[resume] loaded {len(allp)} existing", flush=True)
        except Exception:
            allp = {}
    cats = CATS[:1] if pilot else CATS
    for cat in cats:
        print(f"[{cat}]", flush=True)
        got = crawl_cat(cat)
        for k, v in got.items():
            if k in allp:
                cats_of = allp[k].setdefault("cats", [])
                if cat not in cats_of:
                    cats_of.append(cat)
                continue
            v["cats"] = [cat]
            allp[k] = v
        if pilot:
            print(json.dumps(list(got.items())[:4], indent=1))
            break
        time.sleep(PACE)
    json.dump(allp, open(OUT, "w"), indent=1)
    print(f"[done] {len(allp)} unique products -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
