#!/usr/bin/env python3
"""Task 149 — local Lighthouse summary vs the prod baseline (Chrome 157/LH 13.6)."""
import json

lhr = json.load(open("/tmp/t149-lh-local.json"))
a = lhr["audits"]

PROD = {  # baseline from /tmp/t149-lh.json (prod, same LH version + Chrome)
    "agentic-browsing": 0.67,
    "performance": 0.61,
    "accessibility": 0.88,
}

print("== LOCAL (post-fix) vs PROD BASELINE (same LH 13.6 / Chrome 157) ==")
for cid, base in PROD.items():
    cur = lhr["categories"][cid]["score"]
    print(f"  {cid}: {base} -> {cur}")

print("\n== AGENTIC AUDITS ==")
for ref in lhr["categories"]["agentic-browsing"]["auditRefs"]:
    au = a[ref["id"]]
    print(f"  {ref['id']}: score={au.get('score')}")

print("\n== METRICS (local) ==")
for m in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "speed-index", "interactive"):
    if a.get(m):
        print(f"  {m}: {a[m].get('displayValue')}")

print("\n== STILL-FAILED AUDITS ==")
for cid in ("performance", "accessibility"):
    for ref in lhr["categories"][cid]["auditRefs"]:
        au = a[ref["id"]]
        if au.get("score") is not None and au["score"] < 1 and au.get("scoreDisplayMode") != "informative":
            print(f"  [{cid}] {ref['id']} (w={ref.get('weight',0)}) {au.get('displayValue') or ''}")

for m in ("unused-javascript",):
    d = (a.get(m, {}).get("details") or {})
    ms = d.get("overallSavingsMs", 0)
    kb = round(d.get("overallSavingsBytes", 0) / 1024)
    print(f"\n  unused-javascript: {ms:.0f}ms / {kb}KiB (prod was 450ms / 164KiB)")
