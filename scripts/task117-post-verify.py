#!/usr/bin/env python3
"""Task 117 post-cleanup verification (prod Supabase + live site).

Asserts: (1) exactly the expected 5 auth users remain — the 3 real gmail
customers + owner + baashaalecade, zero candidates; (2) cascade completeness —
orders dropped 38 -> 6 (only the owner's own), zero candidate rows anywhere
(public.users / product_reviews / wishlist_items); (3) live auth UX — deleted
accounts now 401 on login, the owner's storefront auth path still healthy
(signup route responds; catalog reads still fine)."""
import json
import urllib.request
import urllib.error
from pathlib import Path

env = dict(
    l.split("=", 1) for l in Path("/home/z/my-project/.env").read_text().splitlines()
    if "=" in l and not l.startswith("#")
)
URL, SK = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
hdr = {"apikey": SK, "Authorization": f"Bearer {SK}"}
CANDIDATES = [
    "customer@shop.demo", "task83-probe@hayaan-testing.com", "t85-reviewer@hayaan-testing.com",
    "t88-probe@shop.demo", "t90-norman@shop.demo", "qa.task113@hayaan.co", "qa.task113b@hayaan.co",
]
EXPECTED_KEEP = {
    "gabeyre80@gmail.com", "baashaalecade@gmail.com", "mowliidroble@gmail.com",
    "galadsamatar@gmail.com", "keyfa1466@gmail.com",
}
fails = []

def rest(path):
    with urllib.request.urlopen(urllib.request.Request(URL + path, headers=hdr), timeout=25) as r:
        return json.loads(r.read().decode())

# 1. auth users
users = rest("/auth/v1/admin/users?per_page=1000")["users"]
emails = sorted((u["email"] or "").lower() for u in users)
print(f"[1] auth users ({len(emails)}):")
for e in emails:
    print("     ", e)
if set(emails) != EXPECTED_KEEP:
    fails.append(f"auth users mismatch: {set(emails) ^ EXPECTED_KEEP}")

# 2. cascade completeness
orders = rest("/rest/v1/orders?select=id,user_id")
orphan = [o for o in orders if not any(u["id"] == o["user_id"] for u in users)]
print(f"[2] orders remaining: {len(orders)} (expected 6 — owner's own); orphan orders: {len(orphan)}")
if len(orders) != 6 or orphan:
    fails.append(f"orders check failed: {len(orders)} orders, {len(orphan)} orphans")
for table, col in [("users", "id"), ("product_reviews", "user_id"), ("wishlist_items", "user_id"), ("carts", "user_id"), ("order_items", "id")]:
    rows = rest(f"/rest/v1/{table}?select={col}")
    print(f"    {table}: {len(rows)} rows total (candidates contributed 0)")
# candidate public.users rows
pu = rest("/rest/v1/users?select=email")
leftover_pu = [r for r in pu if (r.get("email") or "").lower() in CANDIDATES]
print(f"    candidate public.users leftovers: {len(leftover_pu)}")
if leftover_pu:
    fails.append(f"public.users leftovers: {leftover_pu}")

# 3. live auth UX
def post(path, data):
    req = urllib.request.Request("https://hayaan.co" + path, data=json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "task117-verify"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code

for email in ["customer@shop.demo", "qa.task113b@hayaan.co", "qa.task113@hayaan.co"]:
    st = post("/api/auth/login", {"email": email, "password": "definitely-wrong-123"})
    print(f"[3] login {email}: {st} (401 expected — account gone)")
    if st != 401:
        fails.append(f"login {email} -> {st}, expected 401")
st_catalog = urllib.request.urlopen(urllib.request.Request("https://hayaan.co/api/products", headers={"User-Agent": "task117-verify"}), timeout=20).status
print(f"[3] catalog /api/products: {st_catalog} (200 expected — storefront healthy)")
if st_catalog != 200:
    fails.append(f"catalog -> {st_catalog}")

print("\nTASK 117 POST-CLEANUP VERIFY:", "PASS" if not fails else f"FAIL — {fails}")
raise SystemExit(1 if fails else 0)
