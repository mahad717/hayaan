#!/usr/bin/env python3
"""Task 118: verify the 13 changed rows against their sanguni PDPs (JSON-LD offers.price
is authoritative; category cards can show stale/variant prices).
Caches PDP HTML JSON in scripts/task118-pdp-verify/. Output: scripts/task118-pdp-verify.json"""
import subprocess, json, re, os, time

BASE = "/home/z/my-project/scripts"
VD = f"{BASE}/task118-pdp-verify"
os.makedirs(VD, exist_ok=True)

diff = json.load(open(f"{BASE}/task118-diff-final.json"))["rows"]
changed = [r for r in diff if r["status"] == "changed"]

out = []
for r in changed:
    slug = r["sanguni_slug"]
    f = f"{VD}/{slug}.json"
    if not (os.path.exists(f) and os.path.getsize(f) > 500):
        for attempt in range(3):
            subprocess.run(
                ["z-ai", "function", "-n", "page_reader",
                 "-a", json.dumps({"url": f"https://sanguni.so/product/{slug}/"}), "-o", f],
                capture_output=True, text=True, timeout=180)
            try:
                if json.load(open(f))["data"].get("html"):
                    break
            except Exception:
                pass
            time.sleep(8)
    try:
        h = json.load(open(f))["data"]["html"]
    except Exception:
        h = ""
    price = stock = None
    if h:
        # JSON-LD: walk @graph nodes for Product.offers
        for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', h, re.S):
            try:
                ld = json.loads(m.group(1).strip())
            except Exception:
                continue
            nodes = ld if isinstance(ld, list) else [ld]
            stack = list(nodes)
            while stack:
                x = stack.pop()
                if isinstance(x, list):
                    stack.extend(x)
                    continue
                if not isinstance(x, dict):
                    continue
                if x.get("@type") in ("Product", ["Product"]):
                    ofs = x.get("offers") or []
                    if isinstance(ofs, dict):
                        ofs = [ofs]
                    for of in ofs:
                        p_ = of.get("price")
                        if p_ is None:
                            ps = of.get("priceSpecification") or []
                            if isinstance(ps, dict):
                                ps = [ps]
                            p_ = ps[0].get("price") if ps else None
                        if p_ is not None:
                            price = float(p_)
                            stock = str(of.get("availability", ""))
                stack.extend(v for v in x.values() if isinstance(v, (dict, list)))
        # fallback: first price amount after the summary element
        if price is None:
            i = h.find('class="summary entry-summary"')
            seg = h[i: i + 6000] if i > 0 else ""
            pm = re.search(r"currencySymbol\">[^<]*</span>\s*([\d,.]+)", seg)
            if pm:
                price = float(pm.group(1).replace(",", ""))
            if not stock and seg:
                st = re.search(r"(in_stock|outofstock|out-of-stock)", seg)
                if st:
                    stock = st.group(1)
    ok = price is not None and abs(price - r["sanguni"]) < 0.01
    out.append({"slug": r["slug"], "sanguni_slug": slug, "our": r["ours"],
                "card": r["sanguni"], "pdp": price, "stock": stock,
                "confirm": ok if price is not None else None})
    print(f"  {r['name'][:40]:40} card=${r['sanguni']:>8} pdp={price} "
          f"{'CONFIRM' if ok else ('DIFF!' if price else 'NO-PARSE')}"
          f"{' ' + stock if stock else ''}")
    time.sleep(6)

json.dump(out, open(f"{BASE}/task118-pdp-verify.json", "w"), indent=1)
conf = sum(1 for x in out if x["confirm"])
diffs = [x for x in out if x["confirm"] is False]
print(f"\nconfirmed={conf}/{len(out)}  diffs={len(diffs)}")
