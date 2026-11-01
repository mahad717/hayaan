#!/usr/bin/env python3
"""Parse sanguni.so A17 variant pages: title, prices, stock, images, specs."""
import re
import json
import sys

FILES = {
    "a17-1": "/home/z/my-project/scratch/s-a17-1.html",
    "a17-2": "/home/z/my-project/scratch/s-a17-2.html",
    "a17-3": "/home/z/my-project/scratch/s-a17-3.html",
}

out = {}
for key, path in FILES.items():
    try:
        h = open(path, encoding="utf-8", errors="ignore").read()
    except FileNotFoundError:
        out[key] = {"error": "file not found"}
        continue
    rec = {}

    t = re.search(r"<title>(.*?)</title>", h, re.S)
    rec["title"] = t.group(1).strip() if t else None

    # OpenGraph / meta
    og = {}
    for m in re.finditer(r'<meta\s+property="([^"]+)"\s+content="([^"]*)"', h):
        og[m.group(1)] = m.group(2)
    for m in re.finditer(r"<meta\s+content=\"([^\"]*)\"\s+property=\"([^\"]+)\"", h):
        og[m.group(2)] = m.group(1)
    rec["og"] = {k: v for k, v in og.items() if k in ("og:title", "og:description", "og:price:amount", "og:price:currency", "product:price:amount", "product:price:currency", "og:image", "og:url")}

    # WooCommerce price block
    prices = []
    for m in re.finditer(r'<p class="price">(.*?)</p>', h, re.S):
        blk = m.group(1)
        dels = re.findall(r"<del[^>]*>.*?</del>", blk, re.S)
        inss = re.findall(r"<ins[^>]*>.*?</ins>", blk, re.S)
        amounts = re.findall(r'woocommerce-Price-amount amount[^>]*>(?:<bdi>)?([^<]+)', blk)
        prices.append({"raw_amounts": [a.strip() for a in amounts], "has_del": bool(dels), "has_ins": bool(inss)})
    rec["price_blocks"] = prices

    # JSON-LD (WooCommerce usually emits Product schema)
    lds = []
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', h, re.S):
        txt = m.group(1).strip()
        lds.append(txt[:4000])
    rec["ldjson_count"] = len(lds)
    rec["ldjson"] = lds

    # stock
    stocks = re.findall(r'<p class="stock ([^"]*)">([^<]*)</p>', h)
    rec["stock_classes"] = [(c, s.strip()) for c, s in stocks]
    rec["oos_markers"] = len(re.findall(r"out-of-stock|Out of stock", h))

    # gallery images
    imgs = []
    for m in re.finditer(r'data-large_image="([^"]+)"', h):
        if m.group(1) not in imgs:
            imgs.append(m.group(1))
    for m in re.finditer(r'property="og:image" content="([^"]+)"', h):
        if m.group(1) not in imgs:
            imgs.append(m.group(1))
    rec["images"] = imgs

    # short description / description sections
    sd = re.search(r'<div class="woocommerce-product-details__short-description">(.*?)</div>', h, re.S)
    if sd:
        rec["short_description"] = " ".join(re.sub(r"<[^>]+>", " ", sd.group(1)).split())[:600]

    # attributes table
    attrs = []
    for m in re.finditer(r'<th class="woocommerce-product-attributes-item__label">.*?>([^<]+)</.*?<td class="woocommerce-product-attributes-item__value">.*?<p>([^<]+)</p>', h, re.S):
        attrs.append((m.group(1).strip(), m.group(2).strip()))
    rec["attributes"] = attrs

    # SKU
    sku = re.search(r'<span class="sku">([^<]+)</span>', h)
    rec["sku"] = sku.group(1).strip() if sku else None

    out[key] = rec

print(json.dumps(out, indent=2, ensure_ascii=False))
