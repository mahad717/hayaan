#!/usr/bin/env python3
"""Task 148 CI watcher — poll check-runs for a commit SHA every 20s.
Usage: python3 scripts/t148-ci-watch.py <sha> [max_minutes]"""
import json
import sys
import time
import urllib.request

SHA = sys.argv[1]
MAX_MIN = int(sys.argv[2]) if len(sys.argv) > 2 else 12
TOKEN = open("/home/z/my-project/.gh-token").read().strip()

def api(path):
    req = urllib.request.Request(
        f"https://api.github.com/repos/mahad717/hayaan/{path}",
        headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "t148-ci-watch"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

start = time.time()
seen = {}
while (time.time() - start) < MAX_MIN * 60:
    try:
        runs = api(f"commits/{SHA}/check-runs")
        found = False
        for c in runs.get("check_runs", []):
            found = True
            seen[c["name"]] = (c["status"], c.get("conclusion"))
            print(f"[{int(time.time()-start)}s] {c['name']}: {c['status']} {c.get('conclusion') or ''}", flush=True)
        done = all(s == "completed" for s, _ in seen.values()) and seen
        if done:
            ok = all(cc == "success" for _, cc in seen.values())
            print("CI RESULT:", "PASS" if ok else "FAIL", json.dumps(seen))
            sys.exit(0 if ok else 2)
        if not found and (time.time() - start) > 300:
            print("NO CHECK-RUNS after ~5min — trigger-miss (Tasks 132/144/146 precedent). Retrigger with an empty commit.")
            sys.exit(3)
    except Exception as e:
        print("api err:", e, flush=True)
    time.sleep(20)
print("TIMEOUT waiting for CI")
sys.exit(4)
