#!/usr/bin/env python3
"""Task 91: fetch sanguni.so phone categories + new-arrivals via WooCommerce Store API
through z-ai page_reader (direct curl is JS-challenge-blocked).
Output: scripts/task91-sanguni-phone-cats.json  (dict: cat_slug -> [items])
"""
import json, re, html as ht, subprocess, time, sys

CATS = {
    "iphone": 183,
    "samsung": 182,
    "nokia": 184,
    "new-arrivals": 1288,
}
PER_PAGE = 10  # API caps at 10/page no matter what we ask for
OUT = "/home/z/my-project/scripts/task91-sanguni-phone-cats.json"


def fetch_json(url, tmp):
    for attempt in range(3):
        r = subprocess.run(
            ["z-ai", "function", "-n", "page_reader", "-a", json.dumps({"url": url}), "-o", tmp],
            capture_output=True, text=True, timeout=180,
        )
        try:
            d = json.load(open(tmp))
            h = d["data"].get("html", "")
            m = re.search(r"<pre[^>]*>(.*)</pre>", h, re.S)
            raw = m.group(1) if m else h
            raw = ht.unescape(raw)
            return json.loads(raw)
        except Exception as e:
            print(f"  parse error (attempt {attempt+1}): {e}", flush=True)
            time.sleep(4)
    return None


def fetch_category(cat_id, label):
    items, page = [], 1
    while page <= 10:
        url = f"https://sanguni.so/wp-json/wc/store/v1/products?category={cat_id}&per_page={PER_PAGE}&page={page}"
        tmp = f"/tmp/task91_{label}_p{page}.json"
        batch = fetch_json(url, tmp)
        if batch is None:
            print(f"  {label} p{page}: FAILED, stopping this category", flush=True)
            break
        print(f"  {label} p{page}: {len(batch)} items", flush=True)
        items.extend(batch)
        if len(batch) < PER_PAGE:
            break
        page += 1
        time.sleep(1.5)
    return items


def main():
    result = {}
    for label, cid in CATS.items():
        print(f"→ {label} (id={cid})", flush=True)
        result[label] = fetch_category(cid, label)
        time.sleep(1.5)
    with open(OUT, "w") as f:
        json.dump(result, f)
    print(f"SAVED -> {OUT}")
    for k, v in result.items():
        print(f"  {k}: {len(v)} items")


if __name__ == "__main__":
    main()
