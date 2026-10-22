#!/usr/bin/env python3
"""Task 118 round-2: resolve the unmapped/missing live products against the fresh
761-entry sanguni crawl by normalized name (exact -> token overlap -> difflib).
Output: scripts/task118-map2.json (our_slug -> sanguni slug, with method+score)."""
import json, re, unicodedata
from difflib import SequenceMatcher

BASE = "/home/z/my-project/scripts"


def slugify(n: str) -> str:
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    n = n.lower().replace("&", " and ").replace(",", "")
    n = re.sub(r"[()\[\]{}]", " ", n)
    n = re.sub(r"[^a-z0-9]+", "-", n)
    return n.strip("-")


def tokens(s: str):
    return set(re.findall(r"[a-z0-9]+", s))


catalog = json.load(open(f"{BASE}/task118-catalog-baseline.json"))["products"]
sang = json.load(open(f"{BASE}/task118-sanguni-prices.json"))
diff = json.load(open(f"{BASE}/task118-diff.json"))

# sanguni name index (normalized)
s_norm = {}
for slug, item in sang.items():
    s_norm[slug] = slugify(item["name"])
s_tokens = {s: tokens(n) for s, n in s_norm.items()}

need = [r for r in diff["rows"] if r["status"] in ("no-map", "missing-on-sanguni")]
print(f"to resolve: {len(need)}")

res = {}
for r in need:
    ours_slug = r["slug"]
    name = re.sub(r"^refurbished\s+", "", r["name"], flags=re.I)  # Task 104 renames
    n = slugify(name)
    t = tokens(n)
    hits = []
    # 1) exact normalized name
    for s, sn in s_norm.items():
        if sn == n:
            hits.append((s, 1.0, "exact"))
    if not hits:
        # 2) token overlap (Jaccard-ish) + difflib, keep best 3
        scored = []
        for s, st in s_tokens.items():
            if not st:
                continue
            j = len(t & st) / len(t | st)
            if j >= 0.5:
                d = SequenceMatcher(None, n, s_norm[s]).ratio()
                scored.append((s, 0.6 * j + 0.4 * d, f"tok{j:.2f}+dif{d:.2f}"))
        scored.sort(key=lambda x: -x[1])
        hits = scored[:3]
    res[ours_slug] = {
        "our_name": r["name"], "our_price": r["ours"],
        "candidates": [{"slug": s, "name": sang[s]["name"], "price": sang[s]["price"],
                        "score": round(sc, 3), "how": how} for s, sc, how in hits[:3]],
    }

json.dump(res, open(f"{BASE}/task118-map2.json", "w"), indent=1)

ok = amb = 0
for slug, r in res.items():
    c = r["candidates"]
    if not c:
        print(f"  NONE    {r['our_name'][:52]}")
        continue
    top = c[0]
    gap = round(top["score"] - (c[1]["score"] if len(c) > 1 else 0), 3)
    flag = "AMBIG" if (len(c) > 1 and gap < 0.03 and c[1]["slug"] != top["slug"]) else "ok"
    if flag == "ok":
        ok += 1
    else:
        amb += 1
    print(f"  {flag:5} {r['our_name'][:40]:40} -> {top['slug'][:42]:42} "
          f"(${r['our_price']} vs ${top['price']}) {top['how']} gap={gap}")
print(f"\nresolved={ok} ambiguous={amb} none={sum(1 for r in res.values() if not r['candidates'])}")
