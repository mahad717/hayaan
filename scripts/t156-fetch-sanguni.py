#!/usr/bin/env python3
"""Task 156 — fresh full-catalog fetch from sanguni.so via the WooCommerce
Store API (/wp-json/wc/store/v1/products) through z-ai page_reader
(direct curl is JS-challenge-blocked). Fresh cache dir — do NOT reuse the
old task118/sanguni_api caches, they are stale by weeks.
Output: scripts/t156/sanguni-fresh-catalog.json  (list of store-API items)
Resume: per-page JSON cached in scripts/t156/api/ — re-run skips fetched pages.
"""
import json, os, re, subprocess, sys, time

OUT = "/home/z/my-project/scripts/t156/sanguni-fresh-catalog.json"
CACHE = "/home/z/my-project/scripts/t156/api"
os.makedirs(CACHE, exist_ok=True)

PER_PAGE = 50


def fetch_page(page):
    tmp = f"{CACHE}/p{page}.json"
    if os.path.exists(tmp) and os.path.getsize(tmp) > 500:
        try:
            return parse_cached(tmp)
        except Exception:
            pass
    url = f"https://sanguni.so/wp-json/wc/store/v1/products?per_page={PER_PAGE}&page={page}"
    for attempt in range(4):
        subprocess.run(
            ["z-ai", "function", "-n", "page_reader", "-a", json.dumps({"url": url}), "-o", tmp],
            capture_output=True, text=True, timeout=180,
        )
        try:
            items = parse_cached(tmp)
            if items:
                return items
        except Exception:
            pass
        print(f"  page {page} attempt {attempt+1} failed/empty, retrying...", flush=True)
        time.sleep(8)
    return None


def parse_cached(tmp):
    d = json.load(open(tmp))
    html = d.get("data", {}).get("html", "") or ""
    m = re.search(r"<pre[^>]*>(.*)</pre>", html, re.S)
    raw = m.group(1) if m else html
    for a, b in (("&amp;", "&"), ("&quot;", '"'), ("&#039;", "'"), ("&lt;", "<"), ("&gt;", ">")):
        raw = raw.replace(a, b)
    return json.loads(raw)


def main():
    all_products = {}
    empty_streak = 0
    for page in range(1, 60):
        items = fetch_page(page)
        if not items:
            empty_streak += 1
            print(f"page {page}: empty/failed (streak {empty_streak})", flush=True)
            if empty_streak >= 2:
                print("stop after 2 consecutive empty pages")
                break
            continue
        empty_streak = 0
        new = 0
        for p in items:
            if p["id"] not in all_products:
                all_products[p["id"]] = p
                new += 1
        print(f"page {page}: {len(items)} items ({new} new), total {len(all_products)}", flush=True)
        time.sleep(1.5)

    with open(OUT, "w") as f:
        json.dump(list(all_products.values()), f, ensure_ascii=False)
    print(f"\nDONE: {len(all_products)} unique products -> {OUT}")


if __name__ == "__main__":
    main()
