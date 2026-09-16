#!/usr/bin/env python3
"""Task 53: match our 94 imported products to sanguni.so product URLs.
Improved slugify (numbers keep digits together, parens normalized) + fuzzy
fallback. Output: scripts/image_targets.json
"""
import json, re, unicodedata
from difflib import SequenceMatcher, get_close_matches

def slugify(n: str) -> str:
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    n = n.lower()
    n = n.replace("&", " and ")
    n = n.replace(",", "")          # 80,000mAh -> 80000mah
    n = re.sub(r"[()\[\]{}]", " ", n)  # parens -> space (tokens kept)
    n = re.sub(r"[^a-z0-9]+", "-", n)
    return n.strip("-")

def tokens(s: str):
    return set(re.findall(r"[a-z0-9]+", s))

def main():
    catalog = json.load(open("/home/z/my-project/scripts/catalog_data.json"))
    products = []
    for sec in catalog:
        for p in sec["products"]:
            if p["price"] is not None:
                products.append({"name": p["name"], "price": p["price"], "tier": sec["tier"]})

    urls = [l.strip() for l in open("/home/z/my-project/scripts/all_product_urls.txt") if l.strip()]
    slug2url = {}
    for u in urls:
        m = re.search(r"/product/([^/]+)/?$", u)
        if m:
            slug2url[m.group(1)] = u
    slugs = list(slug2url)

    # pre-index token sets for fast fuzzy scoring
    slug_tokens = {s: tokens(s) for s in slugs}
    slug_strs = {s: s for s in slugs}

    out, misses = [], []
    for p in products:
        s = slugify(p["name"])
        t = tokens(s)
        hit = None
        if s in slug2url:
            hit = s
        else:
            # candidates: token overlap first, then difflib on strings
            scored = []
            for cand, ct in slug_tokens.items():
                inter = len(t & ct)
                if inter >= max(2, len(t) - 2):
                    j = inter / max(1, len(t | ct))
                    scored.append((j, cand))
            scored.sort(reverse=True)
            cands = [c for _, c in scored[:8]]
            close = get_close_matches(s, slugs, n=5, cutoff=0.72)
            pool = list(dict.fromkeys(cands + close))
            best, best_r = None, 0.0
            for cand in pool:
                r = SequenceMatcher(None, s, cand).ratio()
                # token-set containment bonus (order-insensitive)
                tt = slug_tokens[cand]
                cover = len(t & tt) / max(1, len(t))
                score = r * 0.6 + cover * 0.4
                if score > best_r:
                    best_r, best = score, cand
            if best and best_r >= 0.62:
                hit = best
        if hit:
            out.append({**p, "slug": hit, "sanguni_url": slug2url[hit]})
        else:
            misses.append(p)

    json.dump(out, open("/home/z/my-project/scripts/image_targets.json", "w"), ensure_ascii=False, indent=1)
    print(f"matched {len(out)}/{len(products)} -> scripts/image_targets.json")
    print(f"unmatched ({len(misses)}):")
    for m in misses:
        print("  -", m["name"])

if __name__ == "__main__":
    main()
