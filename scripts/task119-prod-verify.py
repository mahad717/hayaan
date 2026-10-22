#!/usr/bin/env python3
"""Task 119 prod verify: hero sliding-arrow pill live on hayaan.co.

Checks SSR HTML for the new pill classes around "Start shopping", then
fetches the CSS chunk referenced by the page and asserts the compiled
selectors exist. Retry loop for deploy propagation (task115 lesson).
"""
import re, time, urllib.request

BASE = "https://hayaan.co"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "replace")

def run_once():
    notes = []
    status, html = fetch(BASE + "/")
    if status != 200:
        return False, [f"homepage HTTP {status}"]
    # 1) label present
    if "Start shopping" not in html:
        notes.append("label 'Start shopping' missing")
    # 2) pill classes in SSR HTML
    for cls in ['bg-[#14532d]', 'bg-[#faf8f1]',
                'group-hover:right-[calc(100%-44px)]', 'hover:ps-14']:
        if cls not in html:
            notes.append(f"class missing in HTML: {cls}")
    # 3) label sits inside the pill (class attr immediately before <span>Start shopping)
    m = re.search(r'class="[^"]*bg-\[#14532d\][^"]*"[^>]*>\s*<span[^>]*>\s*Start shopping', html)
    if not m:
        notes.append("'Start shopping' not wrapped by the #14532d pill")
    # 4) ALL compiled CSS chunks — any containing the selectors passes.
    # Tailwind v4 escapes [ ( ] # in selectors: right-\[calc\(100\%-44px\)\]
    css_urls = re.findall(r'href="([^"]+\.css[^"]*)"', html)
    if not css_urls:
        notes.append("no css link found")
    else:
        probes = [r'right-\\\[calc\\\(\d+\\%-44px\\\)',   # escaped arbitrary calc
                  r'hover\\:ps-14', r'bg-\\\[\\#14532d\\\]',
                  r'bg-\\\[\\#faf8f1\\\]', r'group-hover\\:rotate-45']
        css_all = ""
        for u in css_urls:
            url = u if u.startswith("http") else BASE + u
            try:
                cstat, chunk = fetch(url)
                css_all += chunk if cstat == 200 else ""
            except Exception as e:
                notes.append(f"css fetch fail {u[:60]}: {e}")
        if css_all:
            for sel in probes:
                if not re.search(sel, css_all):
                    notes.append(f"css selector missing: {sel}")
        elif not notes:
            notes.append("css chunks all failed to fetch")
    return (len(notes) == 0), notes

deadline = time.time() + 5 * 60
attempt = 0
while True:
    attempt += 1
    ok, notes = run_once()
    print(f"--- attempt {attempt} ---")
    for n in notes or ["ALL CHECKS PASS"]:
        print(("PASS " if not notes else "FAIL ") + n)
    if ok:
        print("HERO PILL LIVE — PASS")
        break
    if time.time() > deadline:
        print("STILL STALE AFTER 5MIN — FAIL")
        raise SystemExit(1)
    time.sleep(40)
