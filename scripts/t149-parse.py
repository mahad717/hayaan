#!/usr/bin/env python3
"""Task 149 — extract actionable Lighthouse data for hayaan.co (prod, mobile)."""
import json

lhr = json.load(open("/tmp/t149-lh.json"))
a = lhr["audits"]
print("LH version:", lhr.get("lighthouseVersion"), "| fetchTime:", lhr.get("fetchTime"))

print("\n== CATEGORY SCORES ==")
for cid, cat in lhr["categories"].items():
    print(f"  {cid}: {cat.get('score')}")

print("\n== AGENTIC BROWSING AUDITS ==")
ab = lhr["categories"].get("agentic-browsing")
if ab:
    for ref in ab["auditRefs"]:
        au = a[ref["id"]]
        print(f"  {ref['id']}: score={au.get('score')} display={au.get('displayValue')} title={au.get('title')[:80]}")
        if au.get("score") not in (1, None) or "llms" in ref["id"]:
            expl = au.get("explanation") or au.get("description", "")[:200]
            print(f"    -> {expl[:300]}")
else:
    print("  (category missing)")

print("\n== FAILED AUDITS BY CATEGORY ==")
for cid in ("performance", "accessibility", "best-practices", "seo"):
    failed = []
    for ref in lhr["categories"][cid]["auditRefs"]:
        au = a[ref["id"]]
        if au.get("score") is not None and au["score"] < 1 and au.get("scoreDisplayMode") != "informative":
            failed.append((ref.get("weight", 0), ref["id"], au.get("title"), au.get("displayValue")))
    print(f"\n  [{cid}]")
    for w, i, t, d in sorted(failed, reverse=True):
        print(f"    {i} (w={w}) {d or ''} — {t[:70]}")

print("\n== KEY METRICS ==")
for m in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "server-response-time", "interactive"):
    au = a.get(m)
    if au:
        print(f"  {m}: {au.get('displayValue')}")

print("\n== OPPORTUNITIES (savings) ==")
for ref in lhr["categories"]["performance"]["auditRefs"]:
    au = a[ref["id"]]
    d = au.get("details") or {}
    if d.get("type") == "opportunity" and (d.get("overallSavingsMs") or d.get("overallSavingsBytes")):
        ms = d.get("overallSavingsMs", 0)
        kb = round(d.get("overallSavingsBytes", 0) / 1024)
        print(f"  {ref['id']}: {ms:.0f}ms / {kb}KiB — {au['title'][:60]}")
        for it in d.get("items", [])[:6]:
            u = it.get("url", "")
            wastes = {k: it.get(k) for k in ("wastedMs", "wastedBytes", "totalBytes", "wastedPercent") if it.get(k) is not None}
            print(f"      {u[:100]} {wastes}")

print("\n== UNUSED JS (top) ==")
for it in (a.get("unused-javascript", {}).get("details", {}).get("items") or [])[:8]:
    print(f"  {it.get('url','')[:100]} wasted={round(it.get('wastedBytes',0)/1024)}KiB total={round(it.get('totalBytes',0)/1024)}KiB")

print("\n== TOTAL PAYLOAD (top 8) ==")
for it in (a.get("total-byte-weight", {}).get("details", {}).get("items") or [])[:8]:
    print(f"  {round(it.get('totalBytes',0)/1024)}KiB {it.get('url','')[:100]}")

print("\n== LONG TASKS ==")
lt = a.get("long-tasks", {}).get("details", {}).get("items") or []
for it in lt[:8]:
    print(f"  {it.get('duration',0):.0f}ms {it.get('url','')[:90]}")

print("\n== MAIN THREAD (top) ==")
for it in (a.get("mainthread-work-breakdown", {}).get("details", {}).get("items") or [])[:6]:
    print(f"  {it.get('groupLabel')}: {it.get('duration',0):.0f}ms")

print("\n== BOOTUP JS (top) ==")
for it in (a.get("bootup-time", {}).get("details", {}).get("items") or [])[:6]:
    print(f"  {it.get('url','')[:90]} scripting={it.get('scripting',0):.0f}ms total={round(it.get('total',0))}ms")
