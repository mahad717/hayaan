#!/usr/bin/env python3
"""Task 118 — local SSR smoke for the 3 new blog posts (dev server on :3000).
Asserts per post: 200, title, quick answer box, FAQ JSON-LD, HowTo JSON-LD
(all three define howtoSteps), cover image reference, and product links
percent-encoded where slugs contain parens. Also checks /blog index cards,
sitemap.xml and llms.txt carry the new slugs."""
import json
import re
import urllib.request

BASE = "http://localhost:3000"
POSTS = [
    ("power-bank-price-in-somalia", "Power Bank Price in Somalia", "$15"),
    ("nokia-phones-price-in-somalia", "Nokia Phones in Somalia", "$16"),
    ("projector-price-in-somalia", "Projector Price in Somalia", "$120"),
]
fails = []

def get(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers={"User-Agent": "task118-smoke"}), timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")

for slug, title_part, price in POSTS:
    st, html = get(f"/blog/{slug}")
    checks = {
        "status 200": st == 200,
        "title": title_part in html,
        "quick answer": "Quick answer" in html,
        "FAQPage JSON-LD": '"@type":"FAQPage"' in html or '"@type": "FAQPage"' in html,
        "HowTo JSON-LD": '"@type":"HowTo"' in html or '"@type": "HowTo"' in html,
        "cover image": f"/images/blog/{slug}.jpg" in html,
        "no raw markdown links": "](" not in re.sub(r"<script[\s\S]*?</script>", "", html),
    }
    line = f"[{st}] {slug}: " + " ".join(f"{k}={'OK' if v else 'FAIL'}" for k, v in checks.items())
    print(line)
    fails += [f"{slug}: {k}" for k, v in checks.items() if not v]

st, idx = get("/blog")
cards = sum(1 for s, _, _ in POSTS if f"/blog/{s}" in idx)
print(f"[{st}] /blog index: {cards}/3 new cards present")
if cards != 3:
    fails.append(f"index cards {cards}/3")

st, sm = get("/sitemap.xml")
sm_ok = all(f"/blog/{s}" in sm for s, _, _ in POSTS)
print(f"[{st}] sitemap.xml carries 3 new slugs: {'OK' if sm_ok else 'FAIL'}")
if not sm_ok:
    fails.append("sitemap missing new slugs")

st, llms = get("/llms.txt")
l_ok = all(s in llms for s, _, _ in POSTS)
print(f"[{st}] llms.txt carries 3 new guides: {'OK' if l_ok else 'FAIL'}")
if not l_ok:
    fails.append("llms.txt missing new guides")

# encoded-paren link spot check (power bank post links the Apple 20W adapter)
_, pb = get("/blog/power-bank-price-in-somalia")
enc_ok = "apple-20w-usb-c-power-adapter-%28original%29" in pb
print(f"encoded paren link: {'OK' if enc_ok else 'FAIL'}")
if not enc_ok:
    fails.append("paren link not encoded")

print("\nTASK 118 LOCAL SMOKE:", "PASS" if not fails else f"FAIL — {fails}")
raise SystemExit(1 if fails else 0)
