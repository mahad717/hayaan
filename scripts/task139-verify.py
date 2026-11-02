#!/usr/bin/env python3
"""Task 139 prod verification — phantom-404 fix live on hayaan.co.
Fingerprints:
  1. homepage 200 + normal content (logo / product anchors present)
  2. NEW scrape-safe selector present in inline script
  3. OLD exact-match literal GONE
  4. every inline <script> block parses (node --check) — template-literal safety
  5. href harvest on homepage yields NO phantom /product/ URLs
  6. A17 PDPs still 200 with Task-138 SEO titles (regression guard)
"""
import re, subprocess, sys, urllib.request

BASE = "https://hayaan.co"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"

def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")

fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        fails.append(name)

# 1-5: homepage
code, html = get("/")
check("homepage 200", code == 200, str(code))
check("content fingerprint (logo)", "hayaan-logo-green.svg" in html)
prod_anchors = len(re.findall(r'href="/product/[a-z0-9-]+"', html))
check("product anchors render", prod_anchors > 5, f"{prod_anchors} anchors")

new_sel = 'a[href^="/product/"][href$="'
old_lit = 'href="/product/'
scripts = re.findall(r"<script(?![^>]*src=)[^>]*>(.*?)</script>", html, re.S)
inline = "\n".join(scripts)
check("NEW selector present", new_sel in inline)
# the old literal must be gone from the whole document (script text included)
check("OLD bare literal gone", old_lit not in inline, "still present!" if old_lit in inline else "")
check("OLD phantom URL absent", "/product/'+d.top+'" not in html)

# 4: syntax-check every inline script with node (temp file; /dev/stdin unsupported)
import tempfile, os
syn_bad = []
for i, s in enumerate(scripts):
    if len(s.strip()) < 10:
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
        tf.write(s)
        tmp = tf.name
    p = subprocess.run(["node", "--check", tmp], capture_output=True)
    os.unlink(tmp)
    if p.returncode != 0:
        syn_bad.append((i, p.stderr.decode()[:120]))
check("all inline scripts parse", not syn_bad, str(syn_bad[:2]))

# 5: harvest hrefs like a naive crawler and look for phantoms
harv = set(re.findall(r'href="([^"#]+)"', html))
phantoms = [h for h in harv if "/product/" in h and not re.fullmatch(r"/product/[a-z0-9-]+", h)]
check("no phantom /product/ hrefs", not phantoms, str(phantoms[:3]))

# 6: A17 family regression guard (Task 138 SEO intact) + price self-consistency.
# NOTE: store slugs are spec-suffixed (-6gb128gb / -8gb256gb); sanguni's -2/-3
# URL suffixes were NOT carried over by the Task 138 import.
# Owner repriced 8/256 $240 -> $263 between Task 138 and Task 139 (JSON-LD
# "price":"263.00"); the A17 PDPs are price-live so they auto-updated, and the
# Task 139 blog sync realigned the two posts that hardcoded $240.
for slug, price in [("samsung-galaxy-a17", "$170"), ("samsung-galaxy-a17-6gb128gb", "$220"), ("samsung-galaxy-a17-8gb256gb", "$263")]:
    c2, h2 = get(f"/product/{slug}")
    ld = re.search(r'"price":"([0-9.]+)"', h2)
    ld_price = f"${int(float(ld.group(1)))}" if ld else None
    ok = (c2 == 200 and "Price in Somalia" in h2 and price in h2
          and ld_price == price)  # JSON-LD offer must equal the expected live price
    check(f"A17 PDP {slug} 200+title+price+JSON-LD", ok, f"code={c2} ld={ld_price}")

# 7: blog AEO honesty — the two posts Task 139 realigned to the $263 reprice
code3, b1 = get("/blog/how-to-buy-phones-online-in-somalia")
check("blog tier-2 shows 8GB/256GB at $263", code3 == 200 and "8GB/256GB at $263" in b1 and "8GB/256GB at $240" not in b1)
code4, b2 = get("/blog/samsung-galaxy-a18-price-in-somalia")
check("blog A18 ladder shows $145–$263 + top model $263", code4 == 200 and "$145–$263 ladder" in b2 and "top model at $263" in b2 and "top model at $240" not in b2)

print("\n" + ("ALL PASS" if not fails else f"FAILURES: {fails}"))
sys.exit(0 if not fails else 1)
