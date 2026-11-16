#!/usr/bin/env python3
"""Task 156 — fresh crawl of sanguni.so: all 6 top-level categories with path
pagination (query params are ignored by the site/reader, proven in task118)
+ automatic discovery of *microphone* subcategory pages (owner: "also
microphones"). Woodmart card parsing from task118-crawl-sanguni.py, extended
to capture the card image URL.
Output: scripts/t156/sanguni-fresh-catalog.json {slug: item}
Resume: per-page HTML cached in scripts/t156/crawl/ (FRESH dir — old caches
are stale by weeks).
"""
import json, os, re, subprocess, time

OUT = "/home/z/my-project/scripts/t156/sanguni-fresh-catalog.json"
CRAWL_DIR = "/home/z/my-project/scripts/t156/crawl"
os.makedirs(CRAWL_DIR, exist_ok=True)

CATS = [
    "mobile-accessories",
    "computer-accessories",
    "camera-accessories",
    "home-appliances",
    "printer-ink",
    "stationary",
]
MIC_HINTS = ("microphone", "mics")
# discovered from cached p1 HTML (relative links): real microphone subcats
MIC_CATS = [
    "mobile-accessories/microphone",
    "camera-accessories/microphone-camera-accessories",
    "camera-accessories/camera/microphone-camera",
]
PACE = 8
MAXP = 40


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
    """Woodmart category cards -> {slug: {name, price, was_sale, oos, url, img}}."""
    out = {}
    marks = [m.start() for m in re.finditer(r"wd-entities-title", h)]
    for i, s in enumerate(marks):
        seg = h[s: marks[i + 1]] if i + 1 < len(marks) else h[s: s + 5000]
        back = h[max(0, s - 3000): s]
        t = re.search(r'<a href="(https://sanguni\.so/product/([^"/]+)/?)"[^>]*>([^<]+)</a>', seg)
        if not t:
            continue
        slug, name = t.group(2), re.sub(r"\s+", " ", t.group(3)).strip()
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
        img = ""
        ims = re.findall(r'<img[^>]+(?:data-lazy-src|src)="(https://sanguni\.so/wp-content/uploads/[^"]+?)(?:-\d+x\d+)?\.([a-z]{3,4})"', back)
        if ims:
            img = f"{ims[-1][0]}.{ims[-1][1]}"
        else:
            im = re.findall(r'(https://sanguni\.so/wp-content/uploads/[^"\'\s]+\.(?:jpg|jpeg|png|webp))', back)
            img = im[-1] if im else ""
        out[slug] = {
            "name": name,
            "price": eff,
            "was_sale": reg is not None,
            "oos": "out-of-stock" in seg or "Out of stock" in seg,
            "url": f"https://sanguni.so/product/{slug}/",
            "img": img,
        }
    return out


def crawl_cat(cat):
    merged = {}
    for page in range(1, MAXP + 1):
        base = f"https://sanguni.so/product-category/{cat}/"
        # trailing slash on /page/N/ consistently crashes page_reader (500);
        # the slash-less variant works (camera p3 evidence, pass 2)
        url = base if page == 1 else f"{base}page/{page}"
        raw = f"{CRAWL_DIR}/{cat.replace('/', '_')}_p{page}.json"
        h = fetch(url, raw)
        if not h:
            print(f"  [{cat} p{page}] EMPTY -> stop", flush=True)
            break
        prods = parse_products(h)
        hm = re.search(r"[Ss]howing[^0-9]*\d+[^0-9]*(\d+)[^0-9]*of[^0-9]*(\d+)", re.sub(r"<[^>]+>", " ", h))
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
        time.sleep(PACE)
    return merged


def discover_mic_cats(allp_html_cats):
    """Find subcategory paths containing mic* from fetched category HTML."""
    found = set()
    for h in allp_html_cats:
        for m in re.finditer(r'href="(https://sanguni\.so/product-category/([a-z0-9\-/]+)/?)"', h):
            path = m.group(2).strip("/")
            if path.count("/") >= 1 and any(k in path.rsplit("/", 1)[-1] for k in MIC_HINTS):
                found.add(path)
    return sorted(found)


def main():
    allp = {}
    mic_paths = set()
    if os.path.exists(OUT):
        try:
            allp = json.load(open(OUT))
            print(f"[resume] loaded {len(allp)} existing", flush=True)
        except Exception:
            allp = {}
    for cat in CATS:
        print(f"[{cat}]", flush=True)
        got = crawl_cat(cat)
        # mic subcategory discovery from page-1 HTML of top cats
        raw = f"{CRAWL_DIR}/{cat}_p1.json"
        if os.path.exists(raw):
            try:
                mic_paths |= discover_mic_cats([json.load(open(raw))["data"].get("html", "")])
            except Exception:
                pass
        for k, v in got.items():
            if k in allp:
                cats_of = allp[k].setdefault("cats", [])
                if cat not in cats_of:
                    cats_of.append(cat)
                continue
            v["cats"] = [cat]
            allp[k] = v
        json.dump(allp, open(OUT, "w"), indent=1)  # incremental save
        time.sleep(PACE)

    # owner asked for microphones explicitly — crawl the discovered mic subcats
    print("[mic subcats]", MIC_CATS, flush=True)
    for cat in MIC_CATS:
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
        json.dump(allp, open(OUT, "w"), indent=1)
        time.sleep(PACE)

    json.dump(allp, open(OUT, "w"), indent=1)
    mic_count = sum(1 for v in allp.values() if any("mic" in c for c in v.get("cats", [])))
    print(f"[done] {len(allp)} unique products ({mic_count} in mic subcats) -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
