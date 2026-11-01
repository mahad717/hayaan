#!/usr/bin/env python3
"""Task 137 — fresh full crawl of sanguni.so via top-level category archives
(path pagination through page_reader; direct curl is JS-challenge-blocked).
Adapted from proven Task 118 crawler + card image + subcategory extraction.
Output: scripts/t137-sanguni-catalog.json  {slug: {name, price, was_sale, in_stock, img, cats, topcat, url}}
Pilot:  PILOT=1 python3 scripts/t137-crawl-html.py
Resume: per-page HTML cached in scripts/t137-crawl-html/ — re-run skips fetched pages.
"""
import subprocess, json, re, html as ih, time, os, sys

OUT = "/home/z/my-project/scripts/t137-sanguni-catalog.json"
CRAWL_DIR = "/home/z/my-project/scripts/t137-crawl-html"
os.makedirs(CRAWL_DIR, exist_ok=True)

CATS = [
    "mobile-accessories",
    "computer-accessories",
    "camera-accessories",
    "home-appliances",
    "printer-ink",
    "stationary",
]
if os.environ.get("CATS"):
    CATS = [c for c in CATS if c in os.environ["CATS"].split(",")]
PACE = 8
MAXP = 40
# don't re-crawl pages already cached by a previous run of the same category
SKIP_CACHED = os.environ.get("NOSKIP") != "1"


def fetch(url, out):
    if SKIP_CACHED and os.path.exists(out) and os.path.getsize(out) > 500:
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


def parse_products(h, topcat):
    """Woodmart category cards -> {slug: item} with image + subcats."""
    out = {}
    marks = [m.start() for m in re.finditer(r"wd-entities-title", h)]
    for i, s in enumerate(marks):
        back_start = marks[i - 1] if i > 0 else max(0, s - 5000)
        back = h[back_start:s]          # image lives before the title
        fwd = h[s: marks[i + 1]] if i + 1 < len(marks) else h[s: s + 5000]
        t = re.search(r'<a href="(https://sanguni\.so/product/([^"/]+)/?)"[^>]*>([^<]+)</a>', fwd)
        if not t:
            continue
        slug, name = t.group(2), ih.unescape(t.group(3)).strip()
        eff = None
        reg = None
        for pm in re.finditer(r"<(ins|del)>.*?currencySymbol\">[^<]*</span>\s*([\d,.]+)</bdi>", fwd, re.S):
            amt = float(pm.group(2).replace(",", ""))
            if pm.group(1) == "ins":
                eff = amt
            else:
                reg = amt
        if eff is None:
            m1 = re.search(r"currencySymbol\">[^<]*</span>\s*([\d,.]+)</bdi>", fwd)
            if m1:
                eff = float(m1.group(1).replace(",", ""))
        if eff is None:
            continue
        img = ""
        for im in re.finditer(r'<img[^>]*\ssrc="(https://sanguni\.so/wp-content/uploads/[^"]+)"', back):
            img = im.group(1)
        cats = [{"slug": m.group(2), "name": ih.unescape(m.group(1)).strip()}
                for m in re.finditer(r'<a href="https://sanguni\.so/product-category/([a-z0-9-]+)/([a-z0-9-]+)/?"[^>]*>([^<]+)</a>', fwd)]
        out[slug] = {
            "name": name,
            "price": eff,
            "was_sale": reg is not None,
            "in_stock": not ("out-of-stock" in fwd or "Out of stock" in fwd),
            "img": img,
            "cats": cats,
            "topcat": topcat,
            "url": f"https://sanguni.so/product/{slug}/",
        }
    return out


def crawl_cat(cat):
    merged = {}
    for page in range(1, MAXP + 1):
        base = f"https://sanguni.so/product-category/{cat}/"
        url = base if page == 1 else f"{base}page/{page}/"
        raw = f"{CRAWL_DIR}/{cat}_p{page}.json"
        cached = os.path.exists(raw) and os.path.getsize(raw) > 500
        h = fetch(url, raw)
        if not h:
            print(f"  [{cat} p{page}] EMPTY -> stop", flush=True)
            break
        prods = parse_products(h, topcat=cat)
        hm = re.search(r"[Ss]howing[^0-9]*\d+[^0-9]*(\d+)[^0-9]*of[^0-9]*(\d+)", ih.unescape(re.sub(r"<[^>]+>", " ", h)))
        total = hm.group(2) if hm else "?"
        if not prods:
            print(f"  [{cat} p{page}] 0 products (total~{total}) -> stop", flush=True)
            break
        dup = sum(1 for k in prods if k in merged)
        merged.update(prods)
        print(f"  [{cat} p{page}] +{len(prods)} (dup {dup}, merged {len(merged)}, total~{total})", flush=True)
        if dup == len(prods):
            print(f"  [{cat}] all-dup page, stop", flush=True)
            break
        if not cached:
            time.sleep(PACE)
    return merged


def main():
    pilot = os.environ.get("PILOT") == "1"
    allp = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT))
            allp = {v["slug"]: v for v in prev} if isinstance(prev, list) else prev
            for v in allp.values():
                v.setdefault("topcats", [v.get("topcat")] if v.get("topcat") else [])
            print(f"[resume] loaded {len(allp)} existing", flush=True)
        except Exception:
            allp = {}
    cats = CATS[:1] if pilot else CATS
    for cat in cats:
        print(f"[{cat}]", flush=True)
        got = crawl_cat(cat)
        for k, v in got.items():
            if k in allp:
                # refresh price/stock, keep first-seen cats list
                prev = allp[k]
                prev["price"] = v["price"]
                prev["in_stock"] = v["in_stock"]
                if v["img"] and not prev.get("img"):
                    prev["img"] = v["img"]
                continue
            v["topcats"] = [cat]
            allp[k] = v
        json.dump(allp, open(OUT, "w"), indent=1)  # crash-safe: save after each category
        print(f"[saved] {len(allp)} after {cat}", flush=True)
        if pilot:
            print(json.dumps(list(got.items())[:2], indent=1))
            break
        time.sleep(PACE)
    json.dump(allp, open(OUT, "w"), indent=1)
    oos = sum(1 for r in allp.values() if not r["in_stock"])
    noimg = sum(1 for r in allp.values() if not r["img"])
    print(f"[done] {len(allp)} unique products ({oos} OOS, {noimg} no-img) -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
