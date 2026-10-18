#!/usr/bin/env python3
# Task 112 — post-deploy audit of ALL product pages: pull every product URL
# from the live sitemap and verify the price-in-Somalia templates landed.
import json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mozilla/5.0 (audit)"}

def get(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def one(html, pattern):
    m = re.search(pattern, html, re.S)
    return m.group(1).strip() if m else None

def audit(url):
    try:
        html = get(url)
    except Exception as e:
        return {"url": url, "error": str(e)[:80]}
    title = one(html, r"<title>(.*?)</title>") or ""
    desc = one(html, r'<meta name="description" content="([^"]*)"') or ""
    canon = one(html, r'<link rel="canonical" href="([^"]*)"') or ""
    pvu = '"priceValidUntil":"20' in html
    return {
        "url": url.rsplit("/", 1)[-1],
        "title": title,
        "t_len": len(title),
        "kw_title": "Price in Somalia" in title,
        "price_in_title": bool(re.search(r"— \$[\d,]+", title)),
        "d_len": len(desc),
        "kw_desc": "price in Somalia" in desc,
        "canonical_ok": canon == url,
        "priceValidUntil": pvu,
        "brand_suffix": title.endswith("Hayaan Market"),
    }

sm = get("https://hayaan.co/sitemap.xml")
urls = re.findall(r"<loc>(https://hayaan\.co/product/[^<]+)</loc>", sm)
print(f"product URLs in sitemap: {len(urls)}", flush=True)

with ThreadPoolExecutor(max_workers=8) as ex:
    rows = list(ex.map(audit, urls))

errs = [r for r in rows if "error" in r]
ok = [r for r in rows if "error" not in r]
def pct(n): return f"{n}/{len(ok)} ({100*n//max(len(ok),1)}%)"
kw_t = sum(r["kw_title"] for r in ok)
pr_t = sum(r["price_in_title"] for r in ok)
kw_d = sum(r["kw_desc"] for r in ok)
canon_ok = sum(r["canonical_ok"] for r in ok)
pvu = sum(r["priceValidUntil"] for r in ok)
suffix = sum(r["brand_suffix"] for r in ok)
long_t = [r for r in ok if r["t_len"] > 65]
long_d = [r for r in ok if r["d_len"] > 160]
short_d = [r for r in ok if r["d_len"] < 40]
dupes = len(ok) - len({r["title"] for r in ok})
tmax = max(r["t_len"] for r in ok); dmax = max(r["d_len"] for r in ok)
no_suffix = [r for r in ok if not r["brand_suffix"]]

print(f"errors: {len(errs)}", [e["url"] for e in errs][:5])
print(f"'Price in Somalia' in title: {pct(kw_t)}")
print(f"live price in title:        {pct(pr_t)}")
print(f"'price in Somalia' in desc: {pct(kw_d)}")
print(f"canonical == URL:           {pct(canon_ok)}")
print(f"priceValidUntil in JSON-LD: {pct(pvu)}")
print(f"title ends 'Hayaan Market': {pct(suffix)}  (suffix dropped by design on long titles: {[r['url'] for r in no_suffix][:8]})")
print(f"title >65 chars: {len(long_t)} {[r['url'] for r in long_t][:6]}")
print(f"desc  >160 chars: {len(long_d)}")
print(f"desc  <40 chars:  {len(short_d)} {[r['url'] for r in short_d][:6]}")
print(f"duplicate titles: {dupes}   max title {tmax}, max desc {dmax}")
a18 = next((r for r in ok if r["url"] == "samsung-galaxy-a18"), None)
print("A18 override intact:", json.dumps(a18, ensure_ascii=False))
json.dump(rows, open("/tmp/task112-audit.json", "w"), indent=1)
print("sample titles:")
for r in ok[:5]: print("  ", r["t_len"], r["title"])
