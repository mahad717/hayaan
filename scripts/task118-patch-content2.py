#!/usr/bin/env python3
"""Task 118 content sync pass 2 (v2): residual stale prices + the $11.50 stabilizer family."""
import sys

REPL = [
    # A18 post bottom line (A16 $118 -> $145)
    ("src/lib/blog-seo-posts.ts",
     "Tighter budgets are still covered by the [A16 at $118]",
     "Tighter budgets are still covered by the [A16 at $145]", 1),
    # EliteBook post residuals ($950 -> $990)
    ("src/lib/blog-seo-posts.ts",
     "and the 840 G9 (12th-gen Core i7) at $950 — are refurbished",
     "and the 840 G9 (12th-gen Core i7) at $990 — are refurbished", 1),
    ("src/lib/blog-seo-posts.ts",
     "step up to the 840 G9 at $950.", "step up to the 840 G9 at $990.", 1),
    ("src/lib/blog-seo-posts.ts",
     "spanning **$310 to $950**", "spanning **$310 to $990**", 1),
    ("src/lib/blog-seo-posts.ts",
     "the $950 840 G9 is for anyone whose laptop IS the office.",
     "the $990 840 G9 is for anyone whose laptop IS the office.", 1),
    ("src/lib/blog-seo-posts.ts",
     "the [840 G9 at $950](https://hayaan.co/product/hp-elitebook-840-g9-intel-core-i7-12gen)",
     "the [840 G9 at $990](https://hayaan.co/product/hp-elitebook-840-g9-intel-core-i7-12gen)", 1),
    ("src/lib/blog-seo-posts.ts",
     "Pair either with one of the [HP laser printers from $75]",
     "Pair either with one of the [HP laser printers from $165]", 1),
    # near-me post FAQ (printers + PS5)
    ("src/lib/blog-seo-posts.ts",
     "HP laser printers from $75, Wi-Fi routers from $15, split air conditioners from $260, PS5 consoles from $720",
     "HP laser printers from $165, Wi-Fi routers from $15, split air conditioners from $260, PS5 consoles from $850", 1),
    # printer post excerpt: MFP tail was still $165
    ("src/lib/blog-seo-posts.ts",
     "with the HP Laser MFP 135A — print, scan and copy — at $165.",
     "with the HP Laser MFP 135A — print, scan and copy — at $224.90.", 1),
    # voltage stabilizer family ($11.50 -> $65)
    ("src/lib/blog-seo-posts.ts",
     "voltage stabilizers from about $11.50", "voltage stabilizers from $65", 1),
    ("src/lib/blog-seo-posts.ts",
     "a voltage stabilizer ($11.50) protects the compressor",
     "a voltage stabilizer ($65) protects the compressor", 1),
    ("src/lib/blog-seo-posts.ts",
     "The $11.50 Lightwave digital stabilizer", "The $65 Lightwave digital stabilizer", 1),
    ("src/lib/blog-seo-posts.ts",
     "the Lightwave digital unit is $11.50 in the shop",
     "the Lightwave digital unit is $65 in the shop", 1),
    ("src/lib/blog-seo-posts.ts",
     "## The $11.50 accessory that protects your $460 AC",
     "## The $65 accessory that protects your $460 AC", 1),
    ("src/lib/blog-seo-posts.ts",
     "The [Lightwave digital voltage stabilizer at $11.50]",
     "The [Lightwave digital voltage stabilizer at $65]", 1),
    ("src/lib/blog-seo-posts.ts",
     "the [$11.50 Lightwave stabilizer]", "the [$65 Lightwave stabilizer]", 1),
]

files = {}
ok = True
for path, old, new, n in REPL:
    if path not in files:
        files[path] = open(path).read()
    c = files[path].count(old)
    if c != n:
        print(f"MISMATCH: {old[:60]!r} found {c}x expected {n}x")
        ok = False
if not ok:
    print("ABORT — no files written")
    sys.exit(1)

for path, s in files.items():
    for p2, old, new, n in REPL:
        if p2 == path:
            s = s.replace(old, new)
    open(path, "w").write(s)
    print(f"patched {path}")
print("pass 2 (v2) applied")
