#!/usr/bin/env python3
# Task 113 E2E v2 — cache-aware rerun of the reviews-pipeline proof.
# v1 proved the API write path; the PDP JSON-LD asserts failed because the
# E2E hit the Worker before the Task 113 deploy propagated, and the catalog
# cache (products-server.ts, FRESH_MS=60s stale-while-revalidate) lags
# product.rating by design. This version: re-upserts the same QA review,
# proves review[] on the FIRST GET (direct DB query, uncached), waits past
# the 60s fresh window, then proves aggregateRating, then deletes.
import json, re, time, urllib.request, urllib.error, http.cookiejar, secrets

BASE = "https://hayaan.co"
JAR = http.cookiejar.CookieJar()
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR))
OP.addheaders = [("User-Agent", "Mozilla/5.0 (task113-e2e-v2)"), ("Content-Type", "application/json")]

def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    try:
        with OP.open(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def step(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)

_, body = call("GET", "/api/products?limit=50")
items = json.loads(body)
items = items if isinstance(items, list) else items.get("products") or []
a18 = next((p for p in items if p.get("slug") == "samsung-galaxy-a18"), None)
PID, SLUG = a18["id"], a18["slug"]
print(f"target: {SLUG} {PID}", flush=True)

EMAIL = "qa.task113b@hayaan.co"
PW = "Qa-Task113-pipeline-verify"  # deterministic: the account already exists from v1 (signup 409s, login still works)
s, _ = call("POST", "/api/auth/signup", {"email": EMAIL, "password": PW, "name": "QA Test (Task 113)"})
print(f"signup HTTP {s} (200=new, 409=already exists — both fine)", flush=True)
s, _ = call("POST", "/api/auth/login", {"email": EMAIL, "password": PW})
step("login", s == 200)

s, body = call("POST", f"/api/products/{PID}/reviews",
               {"rating": 5, "comment": "QA pipeline verification for Task 113 — this review is deleted moments after posting."})
d = json.loads(body)
step("POST review (upsert same QA row)", s == 200 and d.get("summary", {}).get("count") == 1,
     f"summary={json.dumps(d.get('summary'))}")

# DB truth at this instant — direct query, no cache involved
_, body = call("GET", f"/api/products/{PID}/reviews")
d = json.loads(body)
step("reviews API sees it (DB truth)", d.get("summary", {}).get("count") == 1)

# FIRST PDP GET: review[] comes from the direct DB query — must appear NOW
# (proves the Task 113 page code is deployed and working).
_, html = call("GET", f"/product/{SLUG}")
rev = re.search(r'"review":\[\{"@type":"Review","author":\{"@type":"Person","name":"([^"]*)".*?"ratingValue":(\d)', html)
step("review[] on first GET (uncached query)", bool(rev), rev and f"author={rev.group(1)} rating={rev.group(2)}")

# aggregateRating rides on the CACHED product row (<=60s fresh window) —
# warm the cache past the window, then read again.
print("waiting 70s for the catalog cache fresh window to lapse...", flush=True)
time.sleep(70)
call("GET", f"/product/{SLUG}")  # stale hit — triggers background refresh
time.sleep(3)
_, html = call("GET", f"/product/{SLUG}")  # refreshed copy
agg = re.search(r'"aggregateRating":\{"@type":"AggregateRating","ratingValue":([\d.]+),"reviewCount":(\d+)\}', html)
step("aggregateRating after cache refresh", bool(agg), agg and f"rating={agg.group(1)} count={agg.group(2)}")

# delete + clean
s, body = call("DELETE", f"/api/products/{PID}/reviews")
d = json.loads(body)
step("DELETE review", s == 200 and d.get("summary", {}).get("count") == 0)
call("GET", f"/product/{SLUG}")  # warm stale
time.sleep(3)
_, html = call("GET", f"/product/{SLUG}")
step("PDP clean again (after refresh)", "aggregateRating" not in html and '"@type":"Review"' not in html)
print("QA account remains for cleanup queue:", EMAIL, flush=True)
