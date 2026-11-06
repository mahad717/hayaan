#!/bin/bash
# Task 149 local verification — production build, next start :3222, then:
#   1. t149-verify.mjs  — SSR fingerprints for every a11y/perf fix + split proof
#   2. t149-axe.mjs     — axe re-run: the 3 Lighthouse a11y rules must be CLEAN
#   3. local Lighthouse — agentic-browsing + performance direction check
#   4. screenshots      — homepage mobile, early + post-load
# Port-kill / EADDRINUSE lessons from t146-t148 kept; repo DB untouched.
cd /home/z/my-project
log() { echo "=== [$(date +%H:%M:%S)] $1 ==="; }

kill_port() {
  local pids
  pids=$(lsof -t -i tcp:"$1" 2>/dev/null)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  return 0
}

log "port cleanup"
kill_port 3222
kill_port 9362
pkill -9 -f "next-server" 2>/dev/null
sleep 1

log "typecheck (edited-file focus, baseline noise tolerated)"
npx tsc --noEmit 2>&1 | rg "header-search|product-card\.tsx|store/footer|storefront-app|src/app/layout" && { log "FATAL: type errors in edited files"; exit 3; } || log "edited files clean (hero pre-existing pair noted in worklog)"

log "production build"
timeout 480 bun x next build > /tmp/t149-build.log 2>&1
BUILD_RC=$?
if [ "$BUILD_RC" != "0" ]; then
  log "BUILD FAILED (rc=$BUILD_RC) — tail follows"
  tail -30 /tmp/t149-build.log
  exit 2
fi
log "build OK"

log "server start (repo DB, read-only usage)"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t149-server.log 2>&1 &
disown

log "poll"
up=0
for i in $(seq 1 60); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3222/ 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP — log follows"
  strings /tmp/t149-server.log | tail -20
  kill_port 3222; pkill -9 -f "next-server" 2>/dev/null
  exit 3
fi
if strings /tmp/t149-server.log | grep -q "EADDRINUSE"; then
  log "FATAL: EADDRINUSE — stale server. Aborting."
  kill_port 3222; pkill -9 -f "next-server" 2>/dev/null
  exit 3
fi

log "harness: SSR fingerprints + split proof + screenshots"
timeout 240 node scripts/t149-verify.mjs
echo "harness_rc=$?"

log "axe re-run (must be CLEAN on the 3 rules)"
timeout 120 node scripts/t149-axe.mjs http://127.0.0.1:3222/
echo "axe_rc=$?"

log "local Lighthouse (agentic + perf direction)"
CHROME_PATH=/tmp/chrome153/chrome/linux-157.0.8103.38/chrome-linux64/chrome \
  npx --yes lighthouse@latest "http://127.0.0.1:3222/" --quiet \
  --output=json --output-path=/tmp/t149-lh-local.json \
  --only-categories=agentic-browsing,performance,accessibility \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
  > /tmp/t149-lh-local.log 2>&1
python3 scripts/t149-lh-local.py

log "cleanup"
kill_port 3222
kill_port 9362
pkill -9 -f "next-server" 2>/dev/null
sleep 1
log "done"
