#!/usr/bin/env python3
"""Task 107c deploy watch: poll GitHub commit status for 5c25bca until the
Cloudflare build finishes, then poll live HTML for the early-cover marker."""
import json, time, urllib.request, sys

SHA = "5c25bca4b39343be3d08491b1a78da34d1fd6421"
REPO = "mahad717/hayaan"
LIVE = "https://hayaan.co/"
TOKEN_FILE = "/home/z/my-project/.gh-token"

def gh(path):
    req = urllib.request.Request("https://api.github.com" + path,
        headers={"Authorization": "Bearer " + open(TOKEN_FILE).read().strip(),
                 "Accept": "application/vnd.github+json", "User-Agent": "deploy-watch"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def live_has(*needles):
    req = urllib.request.Request(LIVE, headers={"User-Agent": "deploy-watch", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    return {n: (n in html) for n in needles}, len(html)

needles = ["hayaan-cov", "__hayaanShopScroll"]
deadline = time.time() + 900  # 15 min ceiling
build_done = False
while time.time() < deadline:
    try:
        st = gh(f"/repos/{REPO}/commits/{SHA}/status")
        state = st.get("state")
        descs = [s.get("context") + ":" + str(s.get("state")) for s in st.get("statuses", [])]
        print(f"[{time.strftime('%H:%M:%S')}] build state={state} {descs}", flush=True)
        if state in ("success", "failure", "error"):
            build_done = True
            if state != "success":
                print("BUILD FAILED — aborting live probe", flush=True)
                sys.exit(1)
            break
    except Exception as e:
        print("status api err:", e, flush=True)
    time.sleep(30)

# Build green -> poll live HTML for the new marker
for i in range(20):
    try:
        found, size = live_has(*needles)
        print(f"[{time.strftime('%H:%M:%S')}] live probes {found} html={size}B", flush=True)
        if all(found.values()):
            print("DEPLOY CONFIRMED: early-cover + scroll markers both live", flush=True)
            sys.exit(0)
    except Exception as e:
        print("live err:", e, flush=True)
    time.sleep(20)
print("TIMEOUT waiting for live markers", flush=True)
sys.exit(2)
