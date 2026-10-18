#!/usr/bin/env python3
# Task 113 E2E v3 — characterize PDP HTML staleness around a review write.
# Posts the QA review, polls the PDP every 2s logging when review[] and
# aggregateRating appear, deletes, polls until clean. Prints a timeline.
import json, re, time, urllib.request, urllib.error, http.cookiejar

BASE = "https://hayaan.co"
JAR = http.cookiejar.CookieJar()
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR))
OP.addheaders = [("User-Agent", "Mozilla/5.0 (task113-e2e-v3)"), ("Content-Type", "application/json")]

def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    try:
        with OP.open(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def state(html):
    rev = '"review":[{"@type":"Review"' in html
    agg = '"aggregateRating"' in html
    return rev, agg

_, body = call("GET", "/api/products?limit=50")
items = json.loads(body)
items = items if isinstance(items, list) else items.get("products") or []
a18 = next(p for p in items if p.get("slug") == "samsung-galaxy-a18")
PID, SLUG = a18["id"], a18["slug"]

s, _ = call("POST", "/api/auth/login", {"email": "qa.task113b@hayaan.co", "password": "Qa-Task113-pipeline-verify"})
print("login:", s, flush=True)

s, body = call("POST", f"/api/products/{PID}/reviews",
               {"rating": 5, "comment": "QA staleness characterization (Task 113) — deleted right after."})
print("POST:", s, json.loads(body).get("summary"), flush=True)

t0 = time.time()
seen_rev = seen_agg = False
while time.time() - t0 < 150:
    _, html = call("GET", f"/product/{SLUG}")
    rev, agg = state(html)
    tag = []
    if rev and not seen_rev: tag.append("review[] APPEARED"); seen_rev = True
    if agg and not seen_agg: tag.append("aggregateRating APPEARED"); seen_agg = True
    if not rev and seen_rev: tag.append("review[] GONE?!"); seen_rev = False
    if not agg and seen_agg: tag.append("aggregateRating GONE?!"); seen_agg = False
    if tag or int(time.time() - t0) % 10 == 0:
        print(f"T+{time.time()-t0:5.0f}s  review[]={rev} aggregateRating={agg}  {' | '.join(tag)}", flush=True)
    if seen_rev and seen_agg:
        print(f"T+{time.time()-t0:5.0f}s  BOTH PRESENT — done waiting", flush=True)
        break
    time.sleep(2)

s, body = call("DELETE", f"/api/products/{PID}/reviews")
print("DELETE:", s, json.loads(body).get("summary"), flush=True)

t1 = time.time()
while time.time() - t1 < 150:
    _, html = call("GET", f"/product/{SLUG}")
    rev, agg = state(html)
    if not rev and not agg:
        print(f"T+{time.time()-t1:5.0f}s after DELETE: page clean", flush=True)
        break
    if int(time.time() - t1) % 10 == 0:
        print(f"T+{time.time()-t1:5.0f}s after DELETE: still review[]={rev} aggregateRating={agg}", flush=True)
    time.sleep(2)
print("done", flush=True)
