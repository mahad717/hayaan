#!/usr/bin/env python3
# Task 110 — poll GitHub check-runs for a pushed commit until they finish.
import json, sys, time, urllib.request

tok = open(sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/.gh-token").read().strip()
sha = sys.argv[2] if len(sys.argv) > 2 else "3404dcc"
url = f"https://api.github.com/repos/mahad717/hayaan/commits/{sha}/check-runs"
headers = {
    "Authorization": f"Bearer {tok}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "task110-ci-watch",
}

deadline = time.time() + 900  # 15 min max
last = None
while time.time() < deadline:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    runs = data.get("check_runs", [])
    if runs:
        summary = [(c["name"], c["status"], c.get("conclusion")) for c in runs]
        if summary != last:
            print(time.strftime("%H:%M:%S"), summary, flush=True)
            last = summary
        if all(c["status"] == "completed" for c in runs):
            ok = all(c.get("conclusion") == "success" for c in runs)
            print("ALL COMPLETED —", "PASS" if ok else "FAIL")
            sys.exit(0 if ok else 1)
    else:
        if last != "none":
            print(time.strftime("%H:%M:%S"), "no check-runs yet", flush=True)
            last = "none"
    time.sleep(20)
print("TIMEOUT waiting for check-runs")
sys.exit(2)
