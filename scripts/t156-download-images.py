#!/usr/bin/env python3
"""Task 156 Phase B prep — download sanguni images for the curated import
list into public/images/products/<slug>.<ext> (repo-hosted, t137/t138
pattern; they deploy with the code, HEAD-checked before product create).
Also recovers the <del> regular price for sale items from the cached crawl
HTML (compareAt for the storefront).

Inputs : scripts/t156/import-list.json  [{sanguniSlug, name, price, ...}]
         scripts/t156/crawl/*.json      (cached category page HTML)
Outputs: public/images/products/<slug>.<ext>
         scripts/t156/image-results.json
         scripts/t156/sale-regulars.json  {sanguniSlug: regPrice}
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path("/home/z/my-project")
T156 = ROOT / "scripts/t156"
IMGS = ROOT / "public/images/products"
IMGS.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

lst = json.load(open(T156 / "import-list.json"))
print(f"import list: {len(lst)} products")

# ---- recover regular prices for sale items from cached crawl HTML ----
slugs = {p["sanguniSlug"] for p in lst}
sale_slugs = {p["sanguniSlug"] for p in lst if p.get("was_sale")}
sale_regulars = {}
if sale_slugs:
    for f in sorted((T156 / "crawl").glob("*.json")):
        try:
            h = json.load(open(f))["data"].get("html", "")
        except Exception:
            continue
        marks = [m.start() for m in re.finditer(r"wd-entities-title", h)]
        for i, s in enumerate(marks):
            seg = h[s: marks[i + 1]] if i + 1 < len(marks) else h[s: s + 5000]
            t = re.search(r'<a href="https://sanguni\.so/product/([^"/]+)/?"', seg)
            if not t or t.group(1) not in sale_slugs:
                continue
            dm = re.search(r"<del>.*?currencySymbol\">[^<]*</span>\s*([\d,.]+)</bdi>", seg, re.S)
            if dm:
                sale_regulars.setdefault(t.group(1), float(dm.group(1).replace(",", "")))
    json.dump(sale_regulars, open(T156 / "sale-regulars.json", "w"), indent=1)
    print(f"sale regulars recovered: {len(sale_regulars)}/{len(sale_slugs)}")

# ---- download images ----
results = []
fail = 0
for p in lst:
    slug = p["sanguniSlug"]
    img = p.get("img") or ""
    if not img:
        results.append({"slug": slug, "status": "no-img-url"})
        fail += 1
        continue
    m = re.search(r"\.([a-z]{3,4})$", img)
    ext = (m.group(1) if m else "jpg").lower()
    if ext == "jpeg":
        ext = "jpg"
    dest = IMGS / f"{slug}.{ext}"
    if dest.exists() and dest.stat().st_size > 5000:
        results.append({"slug": slug, "status": "cached", "file": str(dest.relative_to(ROOT))})
        continue
    for attempt in range(3):
        r = subprocess.run(["curl", "-s", "-A", UA, "-o", str(dest), "-w", "%{http_code} %{size_download}", "--max-time", "60", img],
                           capture_output=True, text=True)
        code, size = (r.stdout.split() + ["0", "0"])[:2]
        if code == "200" and int(size) > 5000:
            magic = dest.read_bytes()[:4]
            ok = magic[:3] == b"\xff\xd8\xff" or magic[:4] == b"\x89PNG" or magic[:4] == b"RIFF"
            if ok:
                results.append({"slug": slug, "status": "downloaded", "file": str(dest.relative_to(ROOT)), "bytes": int(size)})
                break
            dest.unlink()
            results.append({"slug": slug, "status": "not-an-image"})
            fail += 1
            break
        import time
        time.sleep(5)
    else:
        results.append({"slug": slug, "status": "download-failed", "http": code})
        fail += 1

json.dump(results, open(T156 / "image-results.json", "w"), indent=1)
ok_n = sum(1 for r in results if r["status"] in ("downloaded", "cached"))
print(f"images ok: {ok_n}/{len(lst)}  failures: {fail}")
if fail:
    for r in results:
        if r["status"] not in ("downloaded", "cached"):
            print("  FAIL", r)
    sys.exit(2)
