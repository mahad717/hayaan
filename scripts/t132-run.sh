#!/usr/bin/env bash
# Task 132: search suggestions UX — build + local prod-mode server + the
# interactive CDP harness (scripts/task132-search-check.mjs).
set -u
cd "$(dirname "$0")/.."
PORT=3155
BASE="http://127.0.0.1:$PORT"
LOG=/tmp/t132-server.log
FAIL=0

echo "== build =="
bun x next build || { echo "FAIL: build"; exit 1; }

if curl -s -m 2 -o /dev/null "$BASE"; then
  echo "FAIL: port $PORT already serving — stale server?"; exit 1
fi

echo "== start prod server on :$PORT =="
NODE_ENV=production setsid bun x next start -p "$PORT" >"$LOG" 2>&1 &
SRV=$!
for i in $(seq 1 45); do
  if curl -s -m 2 -o /dev/null "$BASE"; then break; fi
  sleep 1
done
if ! curl -s -m 3 -o /dev/null "$BASE"; then echo "FAIL: server never came up"; tail -20 "$LOG"; kill -- -"$SRV" 2>/dev/null; exit 1; fi
if grep -q "EADDRINUSE" "$LOG"; then echo "FAIL: EADDRINUSE in fresh server log"; kill -- -"$SRV" 2>/dev/null; exit 1; fi

echo "== interactive search checks =="
node scripts/task132-search-check.mjs || FAIL=1

kill -- -"$SRV" 2>/dev/null
if [ "$FAIL" = 0 ]; then echo "VERDICT: ALL PASS"; else echo "VERDICT: FAIL"; exit 1; fi
