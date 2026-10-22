#!/usr/bin/env python3
"""Task 118 post-deploy verify: content price strings now live after push 74aca6a.

Retry loop handles deploy propagation lag (task115 lesson). DB-only price
changes were already verified pre-push; this checks the SHIPPED content:
blog post titles/bodies, llms.txt route, plus one PDP sanity check.
"""
import json, time, urllib.request

BASE = "https://hayaan.co"
CHECKS = [
    # (url, [required substrings], [forbidden substrings], label)
    ("/blog/printer-price-in-somalia",
     ["HP Lasers From $165"], [], "printer post title"),
    ("/blog/hp-elitebook-price-in-somalia",
     ["$310", "$990"], ["$950"], "elitebook post range"),
    ("/blog/power-bank-price-in-somalia",
     ["$15\u2013$26"], [], "power-bank tier"),
    ("/blog/samsung-galaxy-a18-price-in-somalia",
     ["$145"], ["$118\u2013"], "A18 ladder (DB row + code)"),
    ("/llms.txt",
     ["HP lasers from $165", "$310 (840 G7) to $990 (840 G9)"], [], "llms.txt price lines"),
    ("/product/sony-playstation-5-digital-edition-slim",
     ["850"], ["1,650"], "PS5 Digital Slim PDP price"),
]

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept": "text/html,*/*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "replace")

def run_once():
    results = []
    for path, need, forbid, label in CHECKS:
        try:
            status, html = fetch(BASE + path)
        except Exception as e:
            results.append((path, label, False, f"FETCH FAIL: {e}"))
            continue
        missing = [s for s in need if s not in html]
        leaked = [s for s in forbid if s in html]
        ok = status == 200 and not missing and not leaked
        detail = f"HTTP {status}"
        if missing:
            detail += f" | missing {missing}"
        if leaked:
            detail += f" | STALE {leaked}"
        results.append((path, label, ok, detail))
    return results

deadline = time.time() + 7 * 60
attempt, final = 0, None
while True:
    attempt += 1
    final = run_once()
    all_ok = all(ok for _, _, ok, _ in final)
    print(f"--- attempt {attempt} ---")
    for path, label, ok, detail in final:
        print(("PASS " if ok else "FAIL ") + f"{label:32s} {path}  {detail}")
    if all_ok:
        print("ALL LIVE — PASS")
        break
    if time.time() > deadline:
        print("STILL STALE AFTER 7MIN — FAIL")
        break
    time.sleep(45)
