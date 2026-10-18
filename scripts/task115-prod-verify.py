#!/usr/bin/env python3
"""Task 115 — prod verification on https://hayaan.co (no auth needed).

Proves the Task 115 build (Somali pass #2 + Norman pass #2) is live:
  A. Client chunks referenced by /, PDP, /checkout, /account carry the new
     markers (content-hashed chunk names => presence means the new build
     is deployed and propagated):
       - EN review hint  (Norman #3, constraint-first submit)
       - SO review hint  (Somali dictionary shipped to the client)
       - "Too many attempts" (new localizeApiError MAP entry, Norman #4)
       - "&json=1" (orders-view resolve-first download, Norman #1)
  B. SSR Somali regression: / with hayaan_lang=so renders lang="so" and a
     different H1 than the EN homepage (dictionary 443/443 intact).
  C. Sifalo return page (anonymous, bogus order) renders a graceful card —
     no raw exception/stack output (Norman #2 context).
  D. /api/digital/download?json=1 anonymous -> 401 JSON (route alive).

Retries the chunk-marker phase while the deploy propagates (CI green at
09:26:20 UTC; Workers Builds propagation historically ~30-90s).
"""
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://hayaan.co"
UA = {"User-Agent": "task115-prod-verify/1.0"}

MARKERS = {
    "Norman #3 EN hint": "Pick a star rating above to enable posting.",
    "Somali dict (SO hint)": "Fadlan dooro xiddig kore si aad u qorto faallada.",
    "Norman #4 MAP entry": "Too many attempts",
    "Norman #1 &json=1": "&json=1",
}

CHUNK_RE = re.compile(r'/_next/static/chunks/[A-Za-z0-9._\-]+\.js')


def get(url, cookie=None, timeout=25):
    req = urllib.request.Request(url, headers={**UA, **({"Cookie": cookie} if cookie else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "replace")


def collect_chunks():
    urls = set()
    pages = ["/", "/product/samsung-galaxy-a18", "/checkout", "/account"]
    for p in pages:
        try:
            _, html = get(BASE + p)
            urls.update(CHUNK_RE.findall(html))
        except Exception as e:
            print(f"  page {p}: {type(e).__name__}: {e}")
    return sorted(urls)


def fetch_all(urls):
    def one(u):
        try:
            _, body = get(BASE + u)
            return u, body
        except Exception:
            return u, ""
    with ThreadPoolExecutor(max_workers=12) as ex:
        return dict(ex.map(one, urls))


def markers_pass():
    chunks = collect_chunks()
    print(f"  chunks referenced: {len(chunks)}")
    if not chunks:
        return False
    bodies = fetch_all(chunks)
    missing = []
    for name, needle in MARKERS.items():
        hits = [u for u, b in bodies.items() if needle in b]
        print(f"  [{'OK ' if hits else 'MISS'}] {name}: {len(hits)} chunk(s)")
        if not hits:
            missing.append(name)
    return not missing


def main():
    deadline = time.time() + 420  # 7 min propagation window
    attempt = 0
    while True:
        attempt += 1
        print(f"[attempt {attempt}] chunk markers:")
        if markers_pass():
            print("ALL CHUNK MARKERS LIVE")
            break
        if time.time() > deadline:
            print("FAIL: markers never appeared within propagation window")
            sys.exit(1)
        print("  not propagated yet — waiting 30s")
        time.sleep(30)

    # B. SSR Somali regression
    st_en, en = get(BASE + "/")
    st_so, so = get(BASE + "/", cookie="hayaan_lang=so")
    h1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
    en_h1 = h1.search(en)
    so_h1 = h1.search(so)
    lang_so = 'lang="so"' in so
    diff = bool(en_h1 and so_h1 and en_h1.group(1) != so_h1.group(1))
    print(f"[B] EN {st_en} / SO {st_so}; lang=so: {lang_so}; H1 differs: {diff}")
    if not (lang_so and diff):
        print("FAIL: SSR Somali regression")
        sys.exit(1)

    # C. Sifalo anonymous smoke
    st_sf, sf = get(BASE + "/payment/sifalo?order_id=task115-smoke")
    junk = [s for s in ("ReferenceError", "TypeError", "at async", "stack trace") if s in sf]
    print(f"[C] sifalo {st_sf}; raw exception output: {junk or 'none'}")
    if st_sf != 200 or junk:
        print("FAIL: sifalo smoke")
        sys.exit(1)

    # D. Download route alive (anonymous 401 JSON)
    try:
        get(BASE + "/api/digital/download?item=x&json=1")
        print("[D] download route: expected 401, got 2xx — UNEXPECTED")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        ok = e.code == 401 and "sign in" in body.lower()
        print(f"[D] download route: {e.code} {'OK' if ok else 'UNEXPECTED'} {body[:90]}")
        if not ok:
            sys.exit(1)

    print("TASK 115 PROD VERIFY: PASS")


if __name__ == "__main__":
    import urllib.error
    main()
