#!/usr/bin/env python3
"""Task 156 — diff fresh sanguni catalog vs live Hayaan catalog.
Inputs:
  scripts/t156/sanguni-fresh-catalog.json  (crawl output)
  scripts/t156/hayaan-admin-products.json  (admin API dump)
Matching:
  1. supplierUrl slug match (t137/t138 rows carry it)
  2. normalized-name exact match
  3. normalized-name token-set match (>=0.75 Jaccard) — flagged, needs care
Outputs:
  scripts/t156/changes.json {price_updates, new_products, mic_products, oos_flags, unmatched_hayaan}
  printed summary
"""
import json, re, sys
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/t156")
FRESH = BASE / "sanguni-fresh-catalog.json"
ADMIN = BASE / "hayaan-admin-products.json"
# Nov-1 baseline dump (t137 era): 762 sanguni products known then. Slugs in
# fresh-but-not-baseline = genuinely NEW since the last sync. Slugs in
# baseline-but-not-carried were deliberately curated OUT — not "changes".
BASELINE = Path("/home/z/my-project/scripts/t137-sanguni-catalog.json")

STOP = set("""the a an for with and of to in on by original plus new wifi bluetooth inch mm mah w""".split())


def norm(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    toks = [t for t in s.split() if t]
    return " ".join(toks), set(t for t in toks if t not in STOP)


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def main():
    fresh = json.load(open(FRESH))
    admin = json.load(open(ADMIN))
    print(f"fresh sanguni: {len(fresh)} | hayaan admin: {len(admin)}")

    # map sanguni slug -> hayaan row via supplierUrl (camel + snake)
    by_sup = {}
    for p in admin:
        su = p.get("supplierUrl") or p.get("supplier_url") or ""
        m = re.match(r".*sanguni\.so/product/([^/]+)/?", su)
        if m:
            by_sup[m.group(1)] = p

    # normalized-name index of hayaan rows
    name_idx = {}
    for p in admin:
        n, toks = norm(p["name"])
        name_idx.setdefault(n, []).append(p)
    slug_idx = {p["slug"]: p for p in admin}

    matched = {}      # sanguni slug -> (hayaan row, method)
    for slug, item in fresh.items():
        row = by_sup.get(slug)
        if row:
            matched[slug] = (row, "supplierUrl")
            continue
        if slug in slug_idx:
            matched[slug] = (slug_idx[slug], "slug")
            continue
        n, toks = norm(item["name"])
        cands = name_idx.get(n)
        if cands and len(cands) == 1:
            matched[slug] = (cands[0], "name")
            continue
        best, bs = None, 0.0
        for pn, rows in name_idx.items():
            _, ptoks = norm(rows[0]["name"])
            j = jaccard(toks, ptoks)
            if j > bs:
                best, bs = rows[0], j
        if best and bs >= 0.75:
            matched[slug] = (best, f"fuzzy{bs:.2f}")

    # price updates on existing rows (old-price guard computed at import time)
    # Ambiguity + plausibility guards:
    #  - a Hayaan row matched by MORE than one sanguni slug -> ambiguous, no auto-update
    #  - fuzzy matches with |delta| > 20% -> suspicious pair, no auto-update
    price_updates = []
    review_needed = []
    oos_flags = []
    from collections import defaultdict
    row_hits = defaultdict(list)
    for slug, (row, method) in matched.items():
        row_hits[row["id"]].append((slug, method))
    for slug, (row, method) in matched.items():
        item = fresh[slug]
        hp = round(float(row["price"]), 2)
        sp = round(float(item["price"]), 2)
        ambiguous = len(row_hits[row["id"]]) > 1
        if ambiguous or (method.startswith("fuzzy") and abs(sp - hp) > hp * 0.20):
            review_needed.append({
                "slug": row["slug"], "name": row["name"], "hayaan": hp,
                "sanguni": sp, "sanguniSlug": slug, "match": method,
                "reason": "multiple-sanguni-matches" if ambiguous else "large-delta-fuzzy",
                "hits": [h[0] for h in row_hits[row["id"]]],
            })
            continue
        if abs(hp - sp) > 0.49:
            price_updates.append({
                "id": row["id"], "slug": row["slug"], "name": row["name"],
                "hayaan": hp, "sanguni": sp, "delta": round(sp - hp, 2),
                "match": method, "sanguniSlug": slug,
            })
        if item.get("oos"):
            oos_flags.append({"slug": row["slug"], "name": row["name"], "sanguniSlug": slug})

    # products on sanguni that Hayaan does not carry
    new_products = []
    for slug, item in fresh.items():
        if slug in matched:
            continue
        new_products.append({
            "sanguniSlug": slug, "name": item["name"], "price": item["price"],
            "oos": item.get("oos", False), "img": item.get("img", ""),
            "url": item["url"], "cats": item.get("cats", []),
            "isMic": any("mic" in c for c in item.get("cats", [])),
        })

    mic = [p for p in new_products if p["isMic"]]

    # split new_products: genuinely new since the Nov-1 baseline vs curated-out
    known_slugs = set()
    if BASELINE.exists():
        b = json.load(open(BASELINE))
        vals = b.values() if isinstance(b, dict) else b
        known_slugs = {p["url"].rstrip("/").rsplit("/", 1)[-1] for p in vals if isinstance(p, dict) and p.get("url")}
    for p in new_products:
        p["inNovBaseline"] = p["sanguniSlug"] in known_slugs
    genuinely_new = [p for p in new_products if not p["inNovBaseline"]]
    mic_all = sorted(mic, key=lambda x: x["price"])
    mic_new = [p for p in mic if not p["inNovBaseline"]]

    unmatched_hayaan = []
    matched_rows = {id(r) for r, _ in matched.values()}
    for p in admin:
        if id(p) not in matched_rows:
            unmatched_hayaan.append({"slug": p["slug"], "name": p["name"], "price": p["price"]})

    out = {
        "price_updates": sorted(price_updates, key=lambda x: -abs(x["delta"])),
        "new_products": sorted(new_products, key=lambda x: x["price"]),
        "genuinely_new": sorted(genuinely_new, key=lambda x: x["price"]),
        "mic_products": mic_all,
        "mic_new": sorted(mic_new, key=lambda x: x["price"]),
        "oos_flags": oos_flags,
        "review_needed": review_needed,
        "unmatched_hayaan": unmatched_hayaan,
        "stats": {
            "fresh": len(fresh), "admin": len(admin),
            "matched": len(matched),
            "match_by": {
                "supplierUrl": sum(1 for _, m in matched.values() if m == "supplierUrl"),
                "name": sum(1 for _, m in matched.values() if m == "name"),
                "fuzzy": sum(1 for _, m in matched.values() if m.startswith("fuzzy")),
            },
            "in_nov_baseline": sum(1 for p in new_products if p["inNovBaseline"]),
        },
    }
    json.dump(out, open(BASE / "changes.json", "w"), indent=1, ensure_ascii=False)

    s = out["stats"]
    print(f"matched: {s['matched']} ({s['match_by']})")
    print(f"price updates: {len(out['price_updates'])}")
    for u in out["price_updates"]:
        print(f"  {u['name'][:46]:46s} ${u['hayaan']:>8.2f} -> ${u['sanguni']:>8.2f} ({u['delta']:+.2f}) [{u['match']}]")
    print(f"new on sanguni (not carried): {len(out['new_products'])} "
          f"(genuinely new since Nov-1 baseline: {len(genuinely_new)}, curated-out: {s['in_nov_baseline']})")
    print(f"  genuinely-new in-stock: {sum(1 for p in genuinely_new if not p['oos'])}")
    for p in genuinely_new[:40]:
        print(f"    ${p['price']:>8.2f}  {p['name'][:56]} oos={p['oos']}")
    print(f"microphones: {len(mic_all)} total ({len(mic_new)} genuinely new)")
    for p in mic_all[:40]:
        print(f"    ${p['price']:>8.2f}  {p['name'][:56]} oos={p['oos']} new={not p['inNovBaseline']}")
    print(f"review needed (ambiguous/suspicious pairs): {len(review_needed)}")
    for r in review_needed:
        print(f"    [{r['reason']}] {r['name'][:44]:44s} ${r['hayaan']:>8.2f} vs ${r['sanguni']:>8.2f} via {r['sanguniSlug']}")
    print(f"oos on sanguni (existing hayaan rows): {len(oos_flags)}")
    print(f"hayaan rows with no sanguni match: {len(unmatched_hayaan)}")


if __name__ == "__main__":
    main()
