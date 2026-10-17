#!/usr/bin/env python3
"""Task 109: poll GitHub check-runs for the Workers Builds status."""
import json, sys, time, urllib.request

TOKEN = open(sys.argv[1]).read().strip() if len(sys.argv) > 1 else open("/home/z/my-project/.gh-token").read().strip()
SHA = sys.argv[2] if len(sys.argv) > 2 else "1933a20"
HDR = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}

for i in range(40):
    url = f"https://api.github.com/repos/mahad717/hayaan/commits/{SHA}/check-runs"
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    runs = [(c["name"], c["status"], c["conclusion"]) for c in data.get("check_runs", [])]
    done = all(s == "completed" for _, s, _ in runs) and runs
    print(f"poll {i}: {runs}")
    if done:
        ok = all(c == "SUCCESS" for _, _, c in runs)
        print("CI:", "SUCCESS" if ok else "FAILED")
        sys.exit(0 if ok else 1)
    time.sleep(30)
print("timeout")
sys.exit(2)
