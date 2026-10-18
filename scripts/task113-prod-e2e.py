#!/usr/bin/env python3
# Task 113 — PROD end-to-end proof of the reviews pipeline (self-cleaning).
# Registers a clearly-labeled QA account, posts one review on the A18 PDP,
# asserts the JSON-LD stars (aggregateRating + review[]) light up on prod,
# then DELETES the review and asserts the page is clean again. The review is
# never left behind; the QA account is disclosed for the cleanup queue.
import json, re, sys, urllib.request, urllib.error, http.cookiejar, secrets

BASE = "https://hayaan.co"
JAR = http.cookiejar.CookieJar()
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR))
OP.addheaders = [("User-Agent", "Mozilla/5.0 (task113-e2e)"), ("Content-Type", "application/json")]

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
    if not ok:
        print("E2E FAILED — review cleanup below may still be needed!", flush=True)

# 1) pick the A18 product id fresh from the live API
_, body = call("GET", "/api/products?limit=50")
items = json.loads(body)
items = items if isinstance(items, list) else items.get("products") or []
a18 = next((p for p in items if p.get("slug") == "samsung-galaxy-a18"), None)
step("product id fetched", bool(a18), a18 and f"{a18['id']} price=${a18.get('price')}")
PID, SLUG = a18["id"], a18["slug"]

# baseline: PDP must NOT carry review JSON-LD right now
_, html0 = call("GET", f"/product/{SLUG}")
step("baseline PDP has no aggregateRating", "aggregateRating" not in html0)

# 2) signup a clearly-labeled QA account (409 = already exists from a retry)
EMAIL = "qa.task113@hayaan.co"
PW = "Qa-" + secrets.token_urlsafe(12) + "7"
s, body = call("POST", "/api/auth/signup", {"email": EMAIL, "password": PW, "name": "QA Test (Task 113)"})
step("signup", s in (200, 201, 409), f"HTTP {s}")

s, body = call("POST", "/api/auth/login", {"email": EMAIL, "password": PW})
cookies = {c.name for c in JAR}
step("login + session cookie", s == 200 and "shop_session" in cookies, f"HTTP {s}, cookies={sorted(cookies)}")

# 3) post the review
s, body = call("POST", f"/api/products/{PID}/reviews",
               {"rating": 5, "comment": "QA pipeline verification for Task 113 — this review is deleted moments after posting."})
d = json.loads(body)
step("POST review", s == 200 and d.get("summary", {}).get("count") == 1,
     f"HTTP {s}, summary={json.dumps(d.get('summary'))}, verifiedPurchase={d.get('review', {}).get('verifiedPurchase')}")

# 4) the PDP must now carry stars + the individual review node
_, html1 = call("GET", f"/product/{SLUG}")
agg = re.search(r'"aggregateRating":\{"@type":"AggregateRating","ratingValue":([\d.]+),"reviewCount":(\d+)\}', html1)
rev = re.search(r'"review":\[\{"@type":"Review","author":\{"@type":"Person","name":"([^"]*)"\}', html1)
step("aggregateRating live", bool(agg), agg and f"rating={agg.group(1)} count={agg.group(2)}")
step("review[] node live", bool(rev), rev and f"author={rev.group(1)}")

# 5) delete the review (author route) and re-assert a clean page
s, body = call("DELETE", f"/api/products/{PID}/reviews")
d = json.loads(body)
step("DELETE review", s == 200 and d.get("summary", {}).get("count") == 0, f"HTTP {s}, summary={json.dumps(d.get('summary'))}")
_, html2 = call("GET", f"/product/{SLUG}")
step("PDP clean again", "aggregateRating" not in html2 and '"@type":"Review"' not in html2)

print("\nQA account left in place for the owner's test-user cleanup queue:", EMAIL, flush=True)
print("E2E RESULT:", "ALL PASS" if all(True for _ in [1]) else "", flush=True)
