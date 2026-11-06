#!/usr/bin/env python3
"""Task 149 part 2 — LCP element, render-blocking, image + cache items, dependency chains."""
import json

lhr = json.load(open("/tmp/t149-lh.json"))
a = lhr["audits"]

def items(au, n=10):
    return ((a.get(au, {}) or {}).get("details", {}) or {}).get("items") or []

print("== LCP ELEMENT ==")
for it in items("largest-contentful-paint-element", 4):
    for sub in it.get("items", []) or [it]:
        node = (sub.get("node") or {}).get("selector", "") or sub.get("nodeLabel", "")
        print("  phase:", it.get("phase"), "|", node[:110], "|", sub.get("timing", ""))
e = a.get("largest-contentful-paint-element", {}).get("details", {})
print(json.dumps(e, indent=1)[:1500])

print("\n== LCP PHASES ==")
for it in items("lcp-phases", 6):
    print(" ", json.dumps({k: v for k, v in it.items() if k not in ("items",)})[:220])

print("\n== LCP LAZY? ==")
for it in items("lcp-lazy-loaded", 4):
    print(" ", json.dumps(it)[:220])

print("\n== RENDER BLOCKING ==")
for it in items("render-blocking-insight", 10):
    print(" ", json.dumps(it)[:240])

print("\n== IMAGE DELIVERY ITEMS ==")
for it in items("image-delivery-insight", 10):
    print(" ", json.dumps(it)[:240])

print("\n== CACHE ITEMS ==")
for it in items("cache-insight", 12):
    print(" ", json.dumps({k: it.get(k) for k in ("url", "lifetimeMs", "wastedBytes")})[:200])

print("\n== NETWORK DEPENDENCY TREE (long chains) ==")
for it in items("network-dependency-tree-insight", 12):
    print(" ", json.dumps(it)[:260])

print("\n== FORCED REFLOW ==")
for it in items("forced-reflow-insight", 6):
    print(" ", json.dumps(it)[:200])

print("\n== SSR / DCL timings ==")
for m in ("metrics",):
    au = a.get(m, {})
    for k, v in (au.get("details", {}) or {}).get("items", [{}])[0].items():
        if isinstance(v, (int, float)):
            print(f"  {k}: {v}")
