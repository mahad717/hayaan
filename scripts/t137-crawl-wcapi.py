#!/usr/bin/env python3
"""Task 137 — fresh full crawl of sanguni.so via WooCommerce Store API (page_reader).
Adaptive per_page (100 -> halve on parse failure), resume-safe page cache.
Output: scripts/t137-sanguni-catalog.json  (list of normalized products)
Run: python3 scripts/t137-crawl-wcapi.py
"""
import json, re, subprocess, time, os, sys, html as ih

OUT = "/home/z/my-project/scripts/t137-sanguni-catalog.json"
CACHE = "/home/z/my-project/scripts/t137-crawl"
os.makedirs(CACHE, exist_ok=True)
MAX_PAGES = 40

ENT = [("&amp;", "&"), ("&quot;", '"'), ("&#039;", "'"), ("&lt;", "<"), ("&gt;", ">"), ("&#8217;", "'"), ("&#8216;", "'"), ("&#8220;", '"'), ("&#8221;", '"')]


def deent(s):
    for a, b in ENT:
        s = s.replace(a, b)
    return s


def parse_pre(path):
    d = json.load(open(path))
    h = d["data"].get("html", "")
    m = re.search(r"<pre[^>]*>(.*)</pre>", h, re.S)
    raw = deent(m.group(1) if m else h)
    return json.loads(raw)


def fetch_page(page, per_page):
    """Try per_page, halving on truncation/parse failure. Returns (items, pp)."""
    pp = per_page
    while True:
        tmp = f"{CACHE}/p{page}_n{pp}.json"
        if not (os.path.exists(tmp) and os.path.getsize(tmp) > 500):
            url = f"https://sanguni.so/wp-json/wc/store/v1/products?per_page={pp}&page={page}"
            for attempt in range(3):
                subprocess.run(["z-ai", "function", "-n", "page_reader",
                                "-a", json.dumps({"url": url}), "-o", tmp],
                               capture_output=True, text=True, timeout=150)
                if os.path.exists(tmp) and os.path.getsize(tmp) > 500:
                    break
                print(f"    retry {attempt+1} (no file)", flush=True)
                time.sleep(8)
        try:
            items = parse_pre(tmp)
            if isinstance(items, list):
                return items, pp
        except Exception as e:
            print(f"    parse fail n={pp}: {str(e)[:80]}", flush=True)
        if pp <= 10:
            return None, pp
        pp = max(10, pp // 2)


def norm(p):
    pr = p.get("prices") or {}
    minor = 10 ** int(pr.get("currency_minor_unit") or 2)
    price = (int(pr.get("price") or 0)) / minor
    reg = (int(pr.get("regular_price") or 0)) / minor
    sale = (int(pr.get("sale_price") or 0)) / minor if (pr.get("sale_price") and p.get("on_sale")) else None
    cats = p.get("categories") or []
    img = ((p.get("images") or [{}])[0].get("src")) or ""
    # top-level category = first category whose link path depth == 2 (product-category/<top>/)
    top = ""
    for c in cats:
        m = re.search(r"/product-category/([a-z0-9-]+)/?$", c.get("link", ""))
        if m:
            top = m.group(1)
            break
    return {
        "id": p.get("id"), "slug": p.get("slug"), "name": ih.unescape(p.get("name") or "").strip(),
        "price": price, "regular": reg, "sale": sale, "on_sale": bool(p.get("on_sale")),
        "in_stock": bool(p.get("is_in_stock")),
        "img": img, "permalink": p.get("permalink"), "sku": p.get("sku") or "",
        "short_description": p.get("short_description") or "",
        "cats": [{"slug": c.get("slug"), "name": c.get("name")} for c in cats],
        "topcat": top,
    }


def main():
    allp, byid = [], {}
    if os.path.exists(OUT):
        try:
            allp = json.load(open(OUT))
            byid = {r["id"]: r for r in allp}
            print(f"[resume] {len(allp)} existing", flush=True)
        except Exception:
            allp, byid = [], {}
    empty_streak = 0
    for page in range(1, MAX_PAGES + 1):
        items, pp = fetch_page(page, 100)
        if not items:
            empty_streak += 1
            print(f"[p{page}] empty/failed (streak {empty_streak})", flush=True)
            if empty_streak >= 2:
                break
            time.sleep(5)
            continue
        empty_streak = 0
        new = 0
        for p in items:
            n = norm(p)
            if n["id"] not in byid:
                byid[n["id"]] = n
                allp.append(n)
                new += 1
        print(f"[p{page}] +{new}/{len(items)} (n={pp}) total {len(allp)}", flush=True)
        if len(items) < pp:
            print("[done-ish] short page = last page", flush=True)
            break
        json.dump(allp, open(OUT, "w"))
        time.sleep(3)
    json.dump(allp, open(OUT, "w"))
    oos = sum(1 for r in allp if not r["in_stock"])
    print(f"[SAVED] {len(allp)} products ({oos} OOS) -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
