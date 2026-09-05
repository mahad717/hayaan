#!/usr/bin/env python3
"""
Refactor API routes to use lazy Prisma loading.

For each route file:
  1. Replace `import { db } from "@/lib/db";` with `import { getDb } from "@/lib/db";`
  2. Wrap each `db.<model>.<method>(...)` call with `(await getDb()).<model>.<method>(...)`

This is necessary so @prisma/client is never statically imported — it gets
tree-shaken out of the Cloudflare bundle since the Supabase branch always runs.
"""
import re
import os
from pathlib import Path

ROUTES_DIR = Path("/home/z/my-project/src/app/api")

def refactor_file(path: Path) -> int:
    """Returns number of replacements made."""
    content = path.read_text()
    original = content

    # 1. Replace the import
    content = content.replace(
        'import { db } from "@/lib/db";',
        'import { getDb } from "@/lib/db";',
    )

    # 2. Replace `await db.` with `await (await getDb()).`
    # This handles: await db.product.findMany(...) → await (await getDb()).product.findMany(...)
    content = re.sub(r'await db\.', 'await (await getDb()).', content)

    # 3. Replace bare `db.` (not preceded by `await`) when used as the start of
    #    a property access chain. Be conservative — only match `db.<word>.` patterns.
    #    This catches: const x = db.product.findUnique(...) → const x = (await getDb()).product.findUnique(...)
    #    But leaves `db` references that aren't property accesses alone.
    # Use a pattern that doesn't match `await db.` (already handled above).
    # We need to be careful — match `db.model.method` but not `await db.` or `(await getDb()).db.`
    # The simplest: match `db.` NOT preceded by `await ` or `getDb()).`
    # Use negative lookbehind
    content = re.sub(r'(?<!await )(?<!getDb\)\.)\bdb\.', '(await getDb()).', content)

    if content == original:
        return 0

    path.write_text(content)
    return 1

count = 0
for ts_file in ROUTES_DIR.rglob("*.ts"):
    if refactor_file(ts_file):
        count += 1
        print(f"  ✓ {ts_file.relative_to(ROUTES_DIR)}")

print(f"\nRefactored {count} files")
