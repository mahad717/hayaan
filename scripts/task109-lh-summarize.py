#!/usr/bin/env python3
"""Task 109: summarize a Lighthouse JSON report - score, metrics, top opportunities/diagnostics."""
import json, sys

path = sys.argv[1]
r = json.load(open(path))
a = r["audits"]

print(f"URL: {r['finalDisplayedUrl']}")
print(f"Perf score: {r['categories']['performance']['score']*100:.0f}")
print("\n== Metrics ==")
for k in ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time",
          "cumulative-layout-shift", "speed-index", "interactive"]:
    if k in a:
        m = a[k]
        print(f"  {m['title']:<28} {m['displayValue']}  (score {m['score']})")

lcp_el = a.get("largest-contentful-paint-element", {})
try:
    items = lcp_el["details"]["items"][0]["items"]
    for it in items:
        n = it.get("node", {})
        print(f"\nLCP element: {n.get('snippet','?')[:160]}")
except Exception:
    pass

print("\n== Opportunities (savings) ==")
rows = []
for k, v in a.items():
    d = v.get("details") or {}
    if v.get("score") is not None and v["score"] < 0.9 and d.get("overallSavingsMs"):
        rows.append((d["overallSavingsMs"], d.get("overallSavingsBytes") or 0, v["title"], k))
for ms, b, t, k in sorted(rows, reverse=True):
    print(f"  {ms:>7.0f}ms {b/1024:>7.0f}KB  {t} [{k}]")

print("\n== Diagnostics (score<0.9, no savingsMs) ==")
for k, v in a.items():
    d = v.get("details") or {}
    if v.get("score") is not None and v["score"] < 0.9 and not d.get("overallSavingsMs") and k not in (
        "largest-contentful-paint-element", "lcp-lazy-loaded", "metrics", "metric-savings"):
        print(f"  {v['title']} [{k}] score={v['score']:.2f}")
        if k == "network-requests":
            pass

# big network items
try:
    nr = a["network-requests"]["details"]["items"]
    print("\n== Top 14 network requests by transfer size ==")
    for it in sorted(nr, key=lambda x: -x.get("transferSize", 0))[:14]:
        print(f"  {it.get('transferSize',0)/1024:>7.0f}KB  {it.get('resourceType','?'):<12} {it.get('url','')[:110]}")
    tot = sum(i.get("transferSize", 0) for i in nr)
    print(f"  TOTAL transfer: {tot/1024:.0f}KB across {len(nr)} requests")
except Exception:
    pass

# render blocking
try:
    rb = a["render-blocking-resources"]["details"]["items"]
    print("\n== Render-blocking ==")
    for it in rb:
        print(f"  {it.get('wastedMs',0):>5.0f}ms {it.get('transferSize',0)/1024:>6.0f}KB  {it['url'][:110]}")
except Exception:
    pass

# long tasks summary
try:
    lt = a.get("long-tasks", {}).get("details", {}).get("items", [])
    print(f"\n== Long tasks: {len(lt)} ==")
    for it in lt[:6]:
        print(f"  {it.get('duration',0):>5.0f}ms {it.get('url','')[:100]}")
except Exception:
    pass

# unused js
try:
    uj = a.get("unused-javascript", {}).get("details", {}).get("items", [])
    print("\n== Unused JS ==")
    for it in uj[:8]:
        print(f"  {it.get('wastedBytes',0)/1024:>6.0f}KB wasted  {it.get('url','')[:100]}")
except Exception:
    pass
