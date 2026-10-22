#!/usr/bin/env python3
"""Task 119b prod verify: hero secondary CTA ("Browse categories") is now a
pill of the same height as the primary (h-12 rounded-full px-6), keeping its
outline style. Checks SSR HTML pairing of label + new classes. Retry loop for
propagation lag (task115 lesson).
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
    # label present (EN default SSR)
    if "Browse categories" not in html:
        notes.append("label 'Browse categories' missing")
    # pill classes wrap the outline button label (plain Button: children directly inside <button>)
    m = re.search(r'class="[^"]*h-12[^"]*rounded-full[^"]*border-brand[^"]*"[^>]*>\s*Browse categories', html)
    if not m:
        notes.append("'Browse categories' not wrapped by h-12 rounded-full outline pill")
    # primary pill still intact next to it
    if 'bg-[#14532d]' not in html:
        notes.append("primary pill bg-[#14532d] missing (regression?)")
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
        print("OUTLINE PILL LIVE — PASS")
        break
    if time.time() > deadline:
        print("STILL STALE AFTER 5MIN — FAIL")
        raise SystemExit(1)
    time.sleep(40)
