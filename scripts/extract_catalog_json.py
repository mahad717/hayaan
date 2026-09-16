#!/usr/bin/env python3
"""Extract SECTIONS (4 tier product lists) from build_product_price_list.py
into clean JSON for the Supabase import, without executing the xlsx builder.

- price None  -> item goes to `no_price` (cannot be created via POST /api/products
  which requires a price; owner will add these in the admin panel)
- name " / "  -> " or " so the API-derived slug stays URL-safe (a literal "/"
  inside a slug would break /product/[slug] routing)
"""
import ast, json

SRC = "/home/z/my-project/scripts/build_product_price_list.py"
OUT = "/home/z/my-project/scripts/catalog_data.json"

tree = ast.parse(open(SRC, encoding="utf-8").read())
sections = None
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        isinstance(t, ast.Name) and t.id == "SECTIONS" for t in node.targets
    ):
        sections = ast.literal_eval(node.value)
if sections is None:
    raise SystemExit("SECTIONS not found")

def clean(name: str) -> str:
    return name.replace(" / ", " or ").strip()

result, no_price, renamed = [], [], []
for title, items in sections:
    tier_no = int(title.split()[1].lstrip("TIER"))  # "TIER 1 —" -> 1
    prods = []
    for name, price in items:
        new_name = clean(name)
        if new_name != name:
            renamed.append({"from": name, "to": new_name})
        if price is None:
            no_price.append({"tier": tier_no, "name": name})
            continue
        prods.append({"name": new_name, "price": float(price)})
    result.append({"tier": tier_no, "title": title, "products": prods})

total = sum(len(s["products"]) for s in result)
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"tiers={len(result)} priced_products={total} no_price={len(no_price)} renamed={len(renamed)}")
for r in renamed:
    print("  rename:", r["from"], "->", r["to"])
for n in no_price:
    print(f"  skip (no price) T{n['tier']}:", n["name"])
