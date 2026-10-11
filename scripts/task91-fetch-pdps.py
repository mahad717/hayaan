#!/usr/bin/env python3
"""Task 91: fetch each new sanguni mobile product page -> JSON-LD, gallery images, stock.
Output: scripts/task91-pdp-details/<slug>.json
"""
import subprocess, json, re, html as ih, time, os, sys

OUT_DIR = "/home/z/my-project/scripts/task91-pdp-details"
os.makedirs(OUT_DIR, exist_ok=True)


def fetch(url, out):
    subprocess.run(
        ["z-ai", "function", "-n", "page_reader", "-a", json.dumps({"url": url}), "-o", out],
        capture_output=True, text=True, timeout=180,
    )
    try:
        d = json.load(open(out))
        return d["data"].get("html", "")
    except Exception:
        return ""


def parse_pdp(h):
    out = {}
    # JSON-LD blocks
    jlds = []
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', h, re.S):
        try:
            jlds.append(json.loads(ih.unescape(m.group(1))))
        except Exception:
            pass
    prod = None
    for j in jlds:
        graph = j.get("@graph") if isinstance(j, dict) else None
        cands = graph if graph else ([j] if isinstance(j, dict) else [])
        flat = []
        for c in cands:
            if isinstance(c, dict):
                if c.get("@type") == "Product":
                    flat.append(c)
                elif isinstance(c.get("@graph"), list):
                    flat += [x for x in c["@graph"] if isinstance(x, dict) and x.get("@type") == "Product"]
        if flat:
            prod = flat[0]
            break
    if prod:
        out["name"] = prod.get("name")
        out["description"] = prod.get("description")
        imgs = prod.get("image") or []
        if isinstance(imgs, str):
            imgs = [imgs]
        out["jsonld_images"] = imgs
        offers = prod.get("offers") or {}
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        out["price"] = offers.get("price") or offers.get("lowPrice")
        out["priceHigh"] = offers.get("highPrice")
        av = str(offers.get("availability", ""))
        out["in_stock"] = "InStock" in av if av else None
    # og:image fallback / extras
    og = re.search(r'property="og:image" content="([^"]+)"', h)
    out["og_image"] = ih.unescape(og.group(1)) if og else None
    # gallery: woo product images in main gallery blocks
    gal = re.findall(r'(https://sanguni\.so/wp-content/uploads/\d{4}/\d{2}/[^"\'\s\)]+\.(?:jpg|jpeg|png|webp))', h)
    gal = list(dict.fromkeys(ih.unescape(g) for g in gal))
    out["gallery"] = gal[:12]
    # short description
    sd = re.search(r'<div class="woocommerce-product-details__short-description">(.*?)</div>', h, re.S)
    out["short_description"] = re.sub(r"<[^>]+>", " ", sd.group(1)).strip() if sd else None
    if out["short_description"]:
        out["short_description"] = ih.unescape(re.sub(r"\s+", " ", out["short_description"])).strip()
    # stock
    st = re.search(r'class="(?:product-stock|stock)[^"]*"[^>]*>(.*?)</', h, re.S)
    out["stock_label"] = re.sub(r"<[^>]+>", "", st.group(1)).strip() if st else None
    return out


def main():
    phones = json.load(open("/home/z/my-project/scripts/task91-sanguni-phones.json"))
    # new mobile slugs only (from the diff step, recomputed here)
    import unicodedata
    def norm(n):
        n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().lower()
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", n)).strip()

    hay = {norm(p["name"]) for p in json.load(open("/tmp/hayaan_products.json"))["products"]}
    targets = []
    seen = set()
    PHONE_CATS = ["iphone", "samsung", "nokia"]
    for cat in PHONE_CATS + ["new-arrivals"]:
        for p in phones[cat]:
            if p["slug"] in seen:
                continue
            if norm(p["name"]) in hay:
                continue
            # only actual phones from new-arrivals
            if cat == "new-arrivals":
                nm = p["name"].lower()
                is_phone = any(k in nm for k in ["pixel 10 pro", "galaxy watch"]) # watch excluded below
                if not nm.startswith("google pixel"):
                    continue
            seen.add(p["slug"])
            targets.append({"cat": cat, **p})
    # drop the 3 renamed iPhone 17 listings we already carry (price-identical)
    skip_slugs = {"iphone-17-physical", "iphone-17pro-physical", "iphone-17pro-max-physical"}
    targets = [t for t in targets if t["slug"] not in skip_slugs]

    print(f"{len(targets)} new mobile PDPs to fetch")
    for i, t in enumerate(targets):
        out = f"{OUT_DIR}/{t['slug']}.json"
        if os.path.exists(out):
            print(f"  [{i+1}] skip {t['slug']} (done)")
            continue
        url = f"https://sanguni.so/product/{t['slug']}/"
        h = fetch(url, f"/tmp/task91_pdp_{i}.html")
        data = parse_pdp(h) if h else {}
        rec = {**t, "pdp": data}
        json.dump(rec, open(out, "w"), indent=1)
        pr = data.get("price")
        print(f"  [{i+1}] {t['slug']}: price={pr} imgs={len(data.get('gallery') or [])} desc={'y' if data.get('description') or data.get('short_description') else 'n'}")
        time.sleep(5)
    print("DONE")


if __name__ == "__main__":
    main()
