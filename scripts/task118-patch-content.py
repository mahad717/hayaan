#!/usr/bin/env python3
"""Task 118 content sync: patch shipped blog posts / guides / llms.txt so every
price claim matches the 13 Task 118 catalog updates. Each replacement asserts an
exact occurrence count; any mismatch aborts with zero writes (atomic via list)."""
import sys

REPL = [
    # ---- where-to-buy-electronics-online-in-somalia ----
    ("src/lib/blog-seo-posts.ts",
     "Pro M5 around $1,900", "Pro M5 around $2,150", 1),
    ("src/lib/blog-seo-posts.ts",
     "the Digital Slim edition near $720", "the Digital Slim edition near $850", 1),
    # ---- how-to-buy-phones-online-in-somalia ----
    ("src/lib/blog-seo-posts.ts",
     "budget Android models like the Galaxy A16 start around $118",
     "budget Android models like the Galaxy A06 start around $118", 1),
    ("src/lib/blog-seo-posts.ts",
     "Budget models like the Galaxy A16 (around $118) are the entry point",
     "Budget models like the Galaxy A06 (around $118) are the entry point", 1),
    ("src/lib/blog-seo-posts.ts",
     "at $118 and the Galaxy A17 at $165",
     "at $145 and the Galaxy A17 at $165", 1),
    # ---- setting-up-a-home-office-in-somalia ----
    ("src/lib/blog-seo-posts.ts",
     "at $75 — the classic no-nonsense monochrome laser for documents.",
     "at $165 — the classic no-nonsense monochrome laser for documents.", 1),
    ("src/lib/blog-seo-posts.ts",
     "at $165 — adds scanning and copying, which every small business eventually needs.",
     "at $224.90 — adds scanning and copying, which every small business eventually needs.", 1),
    ("src/lib/blog-seo-posts.ts",
     "at $277 — buying original toner alongside the printer is cheaper than replacing a damaged drum unit later.",
     "at $1,580 — the original-cartridge option for bigger office Color LaserJets; match the exact cartridge number before you order.", 1),
    # ---- ps5-price-in-somalia (Digital Slim $720 -> $850; also fix a Task 97 escape) ----
    ("src/lib/blog-seo-posts.ts",
     "the Digital Slim at $720 and the Pro 2TB at $1,180",
     "the Digital Slim at $850 and the Pro 2TB at $1,180", 1),
    ("src/lib/blog-seo-posts.ts",
     "starts at $720 for the PlayStation 5 Digital Edition (Slim)",
     "starts at $850 for the PlayStation 5 Digital Edition (Slim)", 1),
    ("src/lib/blog-seo-posts.ts",
     "Choose the Digital Edition Slim at $720", "Choose the Digital Edition Slim at $850", 1),
    ("src/lib/blog-seo-posts.ts",
     "The PlayStation 5 Digital Edition (Slim) is $720",
     "The PlayStation 5 Digital Edition (Slim) is $850", 1),
    ("src/lib/blog-seo-posts.ts",
     "The Digital Slim ($720) suits", "The Digital Slim ($850) suits", 1),
    ("src/lib/blog-seo-posts.ts",
     "PlayStation 5 Digital Edition (Slim) — $720.", "PlayStation 5 Digital Edition (Slim) — $850.", 1),
    ("src/lib/blog-seo-posts.ts",
     "Choose the Digital Slim ($720)", "Choose the Digital Slim ($850)", 1),
    ("src/lib/blog-seo-posts.ts",
     "[PS5 Digital Slim](https://hayaan.co/product/sony-playstation-5-digital-edition-slim) at $720",
     "[PS5 Digital Slim](https://hayaan.co/product/sony-playstation-5-digital-edition-slim) at $850", 1),
    # ---- iphone-price-in-somalia (A06 $110 -> $118) ----
    ("src/lib/blog-seo-posts.ts",
     "Samsung Galaxy models start at $110", "Samsung Galaxy models start at $118", 1),
    # ---- printer-price-in-somalia (107A $75->$165, MFP 135A $165->$224.90, 651A $277->$1,580) ----
    ("src/lib/blog-seo-posts.ts",
     'title: "Printer Price in Somalia (2026): HP Lasers From $75, Plus What Toner Really Costs"',
     'title: "Printer Price in Somalia (2026): HP Lasers From $165, Plus What Toner Really Costs"', 1),
    ("src/lib/blog-seo-posts.ts",
     "start at $75 for the HP Laser 107A", "start at $165 for the HP Laser 107A", 1),
    ("src/lib/blog-seo-posts.ts",
     "Print only: the 107A at $75.", "Print only: the 107A at $165.", 1),
    ("src/lib/blog-seo-posts.ts",
     "the MFP 135A at $165 replaces two machines.", "the MFP 135A at $224.90 replaces two machines.", 1),
    ("src/lib/blog-seo-posts.ts",
     "the HP Laser 107A is $75 and the HP Laser MFP 135A (print, scan, copy) is $165",
     "the HP Laser 107A is $165 and the HP Laser MFP 135A (print, scan, copy) is $224.90", 1),
    ("src/lib/blog-seo-posts.ts",
     "The HP Laser 107A at $75 covers essays", "The HP Laser 107A at $165 covers essays", 1),
    ("src/lib/blog-seo-posts.ts",
     "the MFP 135A at $165 is the better", "the MFP 135A at $224.90 is the better", 1),
    ("src/lib/blog-seo-posts.ts",
     "like the 651A set at $277", "like the 651A set at $1,580", 2),
    ("src/lib/blog-seo-posts.ts",
     "**HP Laser 107A — $75.**", "**HP Laser 107A — $165.**", 1),
    ("src/lib/blog-seo-posts.ts",
     "**HP Laser MFP 135A — $165.**", "**HP Laser MFP 135A — $224.90.**", 1),
    ("src/lib/blog-seo-posts.ts",
     "**HP 651A Original Toner Set — $277.**", "**HP 651A Original Toner Set — $1,580.**", 1),
    ("src/lib/blog-seo-posts.ts",
     "**HP Laser 107A ($75):**", "**HP Laser 107A ($165):**", 1),
    ("src/lib/blog-seo-posts.ts",
     "**HP Laser MFP 135A ($165):**", "**HP Laser MFP 135A ($224.90):**", 1),
    ("src/lib/blog-seo-posts.ts",
     "the [651A original set at $277]", "the [651A original set at $1,580]", 1),
    # ---- online-shopping-in-hargeisa ----
    ("src/lib/blog-seo-posts.ts",
     "covers HP lasers from $75 and the toner math", "covers HP lasers from $165 and the toner math", 1),
    # ---- samsung-galaxy-a18-price-in-somalia (A16 $118 -> $145) ----
    ("src/lib/blog-seo-posts.ts",
     "The A17 ($165) and A16 ($118) remain solid buys",
     "The A17 ($165) and A16 ($145) remain solid buys", 1),
    ("src/lib/blog-seo-posts.ts",
     "## A16, A17 or A18? The $118–$190 ladder", "## A16, A17 or A18? The $145–$190 ladder", 1),
    ("src/lib/blog-seo-posts.ts",
     "**Galaxy A16 — $118.**", "**Galaxy A16 — $145.**", 1),
    # ---- hp-elitebook-price-in-somalia (840 G9 $950 -> $990) ----
    ("src/lib/blog-seo-posts.ts",
     'title: "Refurbished HP EliteBook Price in Somalia (2026): $310–$950, Which Model to Buy"',
     'title: "Refurbished HP EliteBook Price in Somalia (2026): $310–$990, Which Model to Buy"', 1),
    ("src/lib/blog-seo-posts.ts",
     "$380 830 G8 and $950 840 G9", "$380 830 G8 and $990 840 G9", 1),
    ("src/lib/blog-seo-posts.ts",
     "cost $310–$950 at Hayaan Market", "cost $310–$990 at Hayaan Market", 1),
    ("src/lib/blog-seo-posts.ts",
     "and $950 for the 840 G9 (12th-gen Core i7)", "and $990 for the 840 G9 (12th-gen Core i7)", 1),
    ("src/lib/blog-seo-posts.ts",
     "tops the range at **$950**", "tops the range at **$990**", 1),
    ("src/lib/blog-seo-posts.ts",
     "**HP EliteBook 840 G9 — $950.**", "**HP EliteBook 840 G9 — $990.**", 1),
    ("src/lib/blog-seo-posts.ts",
     "## Which EliteBook should you buy? The $310–$950 ladder",
     "## Which EliteBook should you buy? The $310–$990 ladder", 1),
    ("src/lib/blog-seo-posts.ts",
     "**EliteBook 840 G9 — $950.**", "**EliteBook 840 G9 — $990.**", 1),
    # publish-day catalog comment
    ("src/lib/blog-seo-posts.ts",
     "// catalog on publish day: 840 G9 $950 / 830 G8 $380 / 830 G7 $340 / 840 G7 $310.",
     "// catalog prices: 840 G9 $990 (Task 118) / 830 G8 $380 / 830 G7 $340 / 840 G7 $310.", 1),
    ("src/lib/blog-seo-posts.ts",
     "// catalog on publish day (840 G9 $950 / 830 G8 $380 / 830 G7 $340 / 840 G7 $310).",
     "// catalog prices (840 G9 $990 since Task 118 / 830 G8 $380 / 830 G7 $340 / 840 G7 $310).", 1),
    ("src/lib/blog-seo-posts.ts",
     "// Prices verified against the live catalog (phones $118+, EliteBook $310+,",
     "// Prices verified against the live catalog (phones $118+, EliteBook $310+,", 0),  # anchor only, pair below
    ("src/lib/blog-seo-posts.ts",
     "// TVs $175+, printers $75+, routers $15+, AC $260+, PS5 $720).",
     "// TVs $175+, printers $165+, routers $15+, AC $260+, PS5 $850).", 1),
    # ---- electronics-store-near-me-in-somalia ----
    ("src/lib/blog-seo-posts.ts",
     "smartphones from **$118** (the budget Galaxy A16)",
     "smartphones from **$118** (the budget Galaxy A06)", 1),
    ("src/lib/blog-seo-posts.ts",
     "HP lasers from **$75**, with the toner pairing", "HP lasers from **$165**, with the toner pairing", 1),
    ("src/lib/blog-seo-posts.ts",
     "[PS5 from $720]", "[PS5 from $850]", 1),
    # ---- product-guides.ts card blurbs ----
    ("src/lib/product-guides.ts",
     "HP lasers from $75, print-only vs MFP", "HP lasers from $165, print-only vs MFP", 1),
    ("src/lib/product-guides.ts",
     "Every refurbished EliteBook from $310 to $950 priced",
     "Every refurbished EliteBook from $310 to $990 priced", 1),
    # ---- llms.txt route ----
    ("src/app/llms.txt/route.ts",
     "Digital Slim ($720) vs Pro 2TB ($1,180)", "Digital Slim ($850) vs Pro 2TB ($1,180)", 1),
    ("src/app/llms.txt/route.ts",
     "HP lasers from $75, print-only vs MFP", "HP lasers from $165, print-only vs MFP", 1),
    ("src/app/llms.txt/route.ts",
     "every refurbished EliteBook from $310 (840 G7) to $950 (840 G9)",
     "every refurbished EliteBook from $310 (840 G7) to $990 (840 G9)", 1),
]

# Task 97 escape spotted in the PS5 excerpt while auditing — fix in the same pass
REPL.append(("src/lib/blog-seo-posts.ts",
             "delivered free to your door", "delivered to your door (fees shown at checkout)", 1))

files = {}
ok = True
for path, old, new, n in REPL:
    if n == 0:
        continue
    if path not in files:
        files[path] = open(path).read()
    c = files[path].count(old)
    if c != n:
        print(f"MISMATCH {path}: {old[:60]!r} found {c}x expected {n}x")
        ok = False
if not ok:
    print("ABORT — no files written")
    sys.exit(1)

for path, s in files.items():
    for p2, old, new, n in REPL:
        if p2 == path and n > 0:
            s = s.replace(old, new)
    open(path, "w").write(s)
    print(f"patched {path} ({len(s)} bytes)")
print("all replacements applied")
