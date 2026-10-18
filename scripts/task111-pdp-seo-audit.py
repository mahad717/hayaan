#!/usr/bin/env python3
# Task 111 — live PDP SEO/AEO audit: fetch two product pages and verify
# every SEO + AEO signal we claim to ship.
import json, re, sys, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (audit)"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def one(html, pattern):
    m = re.search(pattern, html, re.S)
    return m.group(1).strip() if m else None

def audit(url):
    html = get(url)
    out = {"url": url, "bytes": len(html)}
    out["title"] = one(html, r"<title>(.*?)</title>")
    out["meta_desc"] = one(html, r'<meta name="description" content="([^"]*)"')
    out["canonical"] = one(html, r'<link rel="canonical" href="([^"]*)"')
    out["og_title"] = one(html, r'<meta property="og:title" content="([^"]*)"')
    out["og_image"] = one(html, r'<meta property="og:image" content="([^"]*)"')
    out["price_meta"] = one(html, r'<meta name="product:price:amount" content="([^"]*)"')
    out["currency_meta"] = one(html, r'<meta name="product:price:currency" content="([^"]*)"')
    out["twitter_card"] = one(html, r'<meta name="twitter:card" content="([^"]*)"')
    out["robots_meta"] = one(html, r'<meta name="robots" content="([^"]*)"')
    h1 = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    out["h1_count"] = len(h1)
    out["h1_text"] = re.sub(r"<[^>]+>", "", h1[0]).strip()[:70] if h1 else None
    # JSON-LD blocks
    lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    types, prod, faq_n, crumb, rating = [], None, 0, None, None
    for ld in lds:
        try:
            data = json.loads(ld)
        except Exception:
            types.append("PARSE-FAIL"); continue
        graph = data.get("@graph", [data])
        for node in graph:
            t = node.get("@type")
            types.append(t if isinstance(t, str) else ",".join(t))
            if t == "Product":
                prod = node
                off = node.get("offers", {})
                rating = node.get("aggregateRating")
                out["product_fields"] = {
                    "name": bool(node.get("name")),
                    "images": len(node.get("image", []) or []),
                    "sku": bool(node.get("sku")),
                    "brand": (node.get("brand") or {}).get("name"),
                    "price": off.get("price"),
                    "currency": off.get("priceCurrency"),
                    "availability": (off.get("availability") or "").rsplit("/", 1)[-1],
                    "condition": (off.get("itemCondition") or "").rsplit("/", 1)[-1],
                    "seller": (off.get("seller") or {}).get("name"),
                    "offer_url": bool(off.get("url")),
                }
            if t == "FAQPage":
                faq_n = len(node.get("mainEntity", []))
            if t == "BreadcrumbList":
                crumb = len(node.get("itemListElement", []))
    out["ld_types"] = types
    out["faq_questions"] = faq_n
    out["breadcrumbs"] = crumb
    out["aggregateRating"] = rating
    # image alt coverage in the SSR HTML
    imgs = re.findall(r"<img[^>]*>", html)
    alts = [i for i in imgs if re.search(r'alt="[^"]+"', i)]
    out["img_total"] = len(imgs)
    out["img_with_alt"] = len(alts)
    return out

targets = sys.argv[1:] or [
    "https://hayaan.co/product/samsung-galaxy-a18",
    "https://hayaan.co/product/samsung-galaxy-z-flip7",
]
for t in targets:
    print(json.dumps(audit(t), indent=1, ensure_ascii=False))
