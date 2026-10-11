#!/usr/bin/env python3
"""Task 91 phase 1 (v2): build the products payload from PDP details.
Image bytes are fetched by task91-fetch-images.mjs (CDP, challenge-safe);
watermark cleaning is task91-clean-images.py.
Output: scripts/task91-payload.json
"""
import json, os, re

BASE_DIR = "/home/z/my-project/scripts"

NAMES = {
    "iphone-17pro-max-esim": "iPhone 17 Pro Max (eSIM)",
    "iphone-18pro-256gb-black-esim": "iPhone 18 Pro 256GB Black (eSIM)",
    "iphone-18pro-256gb-burgundy-esim": "iPhone 18 Pro 256GB Burgundy (eSIM)",
    "iphone-18pro-256gb-glacier-esim": "iPhone 18 Pro 256GB Glacier (eSIM)",
    "iphone-18pro-256gb-silver-esim": "iPhone 18 Pro 256GB Silver (eSIM)",
    "iphone-18pro-512gb-black-esim": "iPhone 18 Pro 512GB Black (eSIM)",
    "iphone-18pro-512gb-burgundy-esim": "iPhone 18 Pro 512GB Burgundy (eSIM)",
    "iphone-18pro-512gb-glacier-esim": "iPhone 18 Pro 512GB Glacier (eSIM)",
    "iphone-18pro-512gb-silver-esim": "iPhone 18 Pro 512GB Silver (eSIM)",
    "iphone-18pro-max-1tb-black-esim": "iPhone 18 Pro Max 1TB Black (eSIM)",
    "iphone-18pro-max-1tb-burgundy-esim": "iPhone 18 Pro Max 1TB Burgundy (eSIM)",
    "iphone-18pro-max-1tb-glacier-esim": "iPhone 18 Pro Max 1TB Glacier (eSIM)",
    "iphone-18pro-max-1tb-silver-esim": "iPhone 18 Pro Max 1TB Silver (eSIM)",
    "iphone-18pro-max-256gb-black-esim": "iPhone 18 Pro Max 256GB Black (eSIM)",
    "iphone-18pro-max-256gb-burgundy-esim": "iPhone 18 Pro Max 256GB Burgundy (eSIM)",
    "iphone-18pro-max-256gb-glacier-esim": "iPhone 18 Pro Max 256GB Glacier (eSIM)",
    "iphone-18pro-max-256gb-silver-esim": "iPhone 18 Pro Max 256GB Silver (eSIM)",
    "iphone-18pro-max-512gb-black-esim": "iPhone 18 Pro Max 512GB Black (eSIM)",
    "iphone-18pro-max-512gb-burgundy-esim": "iPhone 18 Pro Max 512GB Burgundy (eSIM)",
    "iphone-18pro-max-512gb-glacier-esim": "iPhone 18 Pro Max 512GB Glacier (eSIM)",
    "iphone-18pro-max-512gb-silver-esim": "iPhone 18 Pro Max 512GB Silver (eSIM)",
    "samsung-galaxy-a56-5g": "Samsung Galaxy A56 5G",
    "samsung-galaxy-a57-5g": "Samsung Galaxy A57 5G (8GB/256GB)",
    "samsung-galaxy-a57-5g-2": "Samsung Galaxy A57 5G (12GB/256GB)",
    "samsung-galaxy-s23-ultra-5g": "Samsung Galaxy S23 Ultra 5G",
    "samsung-galaxy-s25-ultra": "Samsung Galaxy S25 Ultra 512GB",
    "samsung-galaxy-s25-ultra-2": "Samsung Galaxy S25 Ultra 256GB",
    "samsung-galaxy-s26-ultra": "Samsung Galaxy S26 Ultra",
    "samsung-galaxy-z-flip6-5g": "Samsung Galaxy Z Flip6 5G",
    "samsung-galaxy-z-flip7": "Samsung Galaxy Z Flip7",
    "samsung-galaxy-z-flip8-5g": "Samsung Galaxy Z Flip8 5G",
    "samsung-galaxy-z-fold7": "Samsung Galaxy Z Fold7 256GB",
    "samsung-galaxy-z-fold7-2": "Samsung Galaxy Z Fold7 512GB",
    "samsung-galaxy-z-fold8-ultra-5g": "Samsung Galaxy Z Fold8 Ultra 5G",
    "samsung-galaxy-z-trifold": "Samsung Galaxy Z TriFold",
    "nokia-105-4g": "Nokia 105 4G",
    "nokia-125": "Nokia 125",
    "nokia-235-4g": "Nokia 235 4G",
    "nokia-2660-flip": "Nokia 2660 Flip",
    "nokia-5310": "Nokia 5310",
    "nokia-5710-xpress-audio": "Nokia 5710 XpressAudio",
    "nokia-6310-4g": "Nokia 6310 4G",
    "nokia-8210-4g": "Nokia 8210 4G",
    "google-pixel-10-pro-xl": "Google Pixel 10 Pro XL",
}

KEY_LABELS = {
    "memory": "Storage", "ram": "RAM", "battery": "Battery", "display": "Display",
    "main camera": "Main camera", "selfie camera": "Selfie camera", "video": "Video",
    "internal": "Internal memory", "radio": "Radio", "bluetooth": "Bluetooth",
    "usb": "USB", "sim": "SIM", "network": "Network", "dual simcard": "Dual SIM",
    "front camera": "Front camera", "camera": "Camera", "os": "OS", "cpu": "CPU",
    "chipset": "Chipset", "dimensions": "Dimensions", "weight": "Weight", "colors": "Colors",
}


def build_description(name, raw_desc):
    specs = []
    if raw_desc:
        for line in re.split(r"[\r\n]+", raw_desc):
            line = line.strip()
            if not line or line.lower().startswith("description"):
                continue
            if ":" in line:
                k, v = line.split(":", 1)
                k = k.strip()
                v = re.sub(r"\s+", " ", v.strip()).strip(" .")
                if not v:
                    continue
                label = KEY_LABELS.get(k.lower(), k.capitalize())
                specs.append((label, v))
            else:
                specs.append((None, line))
    parts = [f"<p>{name} — genuine stock available now at Hayaan Market.</p>"]
    if specs:
        lis = "".join(
            f"<li>{v}</li>" if k is None else f"<li><strong>{k}:</strong> {v}</li>"
            for k, v in specs
        )
        parts.append(f"<ul>{lis}</ul>")
    parts.append(
        "<p>Order today for fast delivery across Somalia — pay securely by card or Sifalo. "
        "Free delivery nationwide on orders over $75; Mogadishu districts from $1.50.</p>"
    )
    return "".join(parts)


def main():
    details = [
        json.load(open(f"{BASE_DIR}/task91-pdp-details/{f}"))
        for f in sorted(os.listdir(f"{BASE_DIR}/task91-pdp-details"))
        if f.endswith(".json")
    ]
    phones = json.load(open(f"{BASE_DIR}/task91-sanguni-phones.json"))
    card_price = {}
    for cat, items in phones.items():
        for p in items:
            card_price.setdefault(p["slug"], p["prices"])

    payload, errors = [], []
    for rec in details:
        slug = rec["slug"]
        if slug not in NAMES:
            errors.append((slug, "no display name"))
            continue
        pdp = rec.get("pdp", {})
        name = NAMES[slug]
        prices = card_price.get(slug) or []
        price = None
        for _sym, amt in prices[:1]:
            price = float(amt.replace(",", ""))
        if price is None and pdp.get("price"):
            price = float(pdp["price"])

        img_url = None
        for cand in [pdp.get("jsonld_images") or [], [pdp.get("og_image")] if pdp.get("og_image") else [], pdp.get("gallery") or []]:
            for u in cand:
                if u and "sanguni.so/wp-content" in u:
                    img_url = u
                    break
            if img_url:
                break
        if not img_url:
            errors.append((slug, "no image url"))
            continue
        ext = os.path.splitext(img_url.split("?")[0])[1].lower() or ".jpg"

        payload.append({
            "slug": slug,
            "name": name,
            "price": price,
            "ext": ext,
            "imageUrl": img_url,
            "description": build_description(name, pdp.get("description") or pdp.get("short_description")),
            "supplierUrl": f"https://sanguni.so/product/{slug}/",
        })

    json.dump(payload, open(f"{BASE_DIR}/task91-payload.json", "w"), indent=1)
    print(f"payload: {len(payload)} products -> task91-payload.json")
    no_price = [p["slug"] for p in payload if not p["price"]]
    if no_price:
        print("MISSING PRICE:", no_price)
    if errors:
        print("ERRORS:")
        for s, e in errors:
            print(" ", s, e)


if __name__ == "__main__":
    main()
