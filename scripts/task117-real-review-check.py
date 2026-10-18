#!/usr/bin/env python3
"""Task 117 bonus check — confirm the real customer review's stars are live
on the multivitamin PDP (aggregateRating + ratingValue in Product JSON-LD)."""
import re
import urllib.request

SLUG = "multivitamines-pour-hommes--boost-immunitaire-aux-vitamines-a-b12-c-d--nergie-quotidienne-et-non-ogm"
html = urllib.request.urlopen(
    urllib.request.Request(f"https://hayaan.co/product/{SLUG}", headers={"User-Agent": "task117-verify"}),
    timeout=25,
).read().decode("utf-8", "replace")

m = re.search(r'"aggregateRating"\s*:\s*(\{[^}]*\})', html)
print("aggregateRating JSON-LD:", m.group(1) if m else "MISSING")
stars = re.search(r'ratingValue\W+([0-9.]+)', html)
print("ratingValue:", stars.group(1) if stars else "MISSING")
print("Somali review text visible:", "energy-gayga" in html)
