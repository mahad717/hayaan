#!/usr/bin/env python3
"""Task 148: prepare a THROWAWAY local DB seeded with the Samsung A-series
catalog (mirroring prod prices verified 2026-11-05) so the PDP-override
checks and the hub post's /product/ deep links can be verified locally.
The repo DB file is never touched — we copy it to /tmp first.

Prod catalog prices (Supabase) verified on publish day:
  a06 $118, a07 $140, a16 $145, a17 $170, a17-6gb $220 (OUT of stock),
  a17-8gb $263, a18 $190, a36-5g $285, a37-5g $330, a56-5g $375,
  a57-5g-8gb256gb $375, a57-5g-12gb256gb $440.
"""
import shutil
import sqlite3
import json
import sys

SRC = "/home/z/my-project/db/custom.db"
DST = "/tmp/t148-seed.db"

shutil.copyfile(SRC, DST)
con = sqlite3.connect(DST)
cur = con.cursor()

cols = [r[1] for r in cur.execute("PRAGMA table_info(Product)").fetchall()]
print("Product columns:", cols)

PRODUCTS = [
    ("samsung-galaxy-a06", "Samsung Galaxy A06", 118.0, 7),
    ("samsung-galaxy-a07", "Samsung Galaxy A07", 140.0, 7),
    ("samsung-galaxy-a16", "Samsung Galaxy A16", 145.0, 7),
    ("samsung-galaxy-a17", "Samsung Galaxy A17", 170.0, 7),
    ("samsung-galaxy-a17-6gb128gb", "Samsung Galaxy A17 (6GB/128GB)", 220.0, 0),  # out of stock like prod
    ("samsung-galaxy-a17-8gb256gb", "Samsung Galaxy A17 (8GB/256GB)", 263.0, 7),
    ("samsung-galaxy-a18", "Samsung Galaxy A18", 190.0, 7),
    ("samsung-galaxy-a36-5g", "Samsung Galaxy A36 5G", 285.0, 7),
    ("samsung-galaxy-a37-5g", "Samsung Galaxy A37 5G", 330.0, 7),
    ("samsung-galaxy-a56-5g", "Samsung Galaxy A56 5G", 375.0, 7),
    ("samsung-galaxy-a57-5g-8gb256gb", "Samsung Galaxy A57 5G (8GB/256GB)", 375.0, 7),
    ("samsung-galaxy-a57-5g-12gb256gb", "Samsung Galaxy A57 5G (12GB/256GB)", 440.0, 7),
]

desc = "Samsung Galaxy A-series listing seeded for the Task 148 local verification run — mirrors the production catalog row (name, slug, price, stock) exactly."
img = json.dumps(["/images/placeholder-product.jpg"])

inserted = 0
for slug, name, price, stock in PRODUCTS:
    cur.execute("SELECT id FROM Product WHERE slug = ?", (slug,))
    if cur.fetchone():
        cur.execute("UPDATE Product SET name=?, price=?, stock=?, isActive=1 WHERE slug=?", (name, price, stock, slug))
    else:
        row = {
            "id": f"t148-{slug}",
            "name": name,
            "slug": slug,
            "description": desc,
            "price": price,
            "currency": "USD",
            "stock": stock,
            "images": img,
            "rating": 0,
            "reviewCount": 0,
            "featured": 0,
            "isActive": 1,
            "createdAt": "2026-11-05T00:00:00.000Z",
            "updatedAt": "2026-11-05T00:00:00.000Z",
            # local DB has no phones-wearables category — electronics is the
            # closest existing row; name-based guide matching (the funnel we
            # verify) does not depend on it
            "categoryId": "cmtog9cmg0001qix3hdgvu3lq",
        }
        keys = list(row.keys())
        if "compareAt" not in cols:
            keys = [k for k in keys if k in cols]
        placeholders = ",".join("?" for _ in keys)
        cur.execute(
            f"INSERT INTO Product ({','.join(keys)}) VALUES ({placeholders})",
            [row[k] for k in keys],
        )
    inserted += 1

con.commit()
n = cur.execute("SELECT COUNT(*) FROM Product WHERE slug LIKE 'samsung-galaxy-a%'").fetchone()[0]
print(f"seeded/updated {inserted} rows; samsung-galaxy-a* rows now: {n}")
if n < len(PRODUCTS):
    print("SEED INCOMPLETE"); sys.exit(1)
con.close()
print(f"OK -> {DST}")
