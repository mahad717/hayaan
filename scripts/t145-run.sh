#!/bin/bash
# Task 145 local verification pipeline — production build, then next start :3222,
# then the keyword harness. Port-kill + EADDRINUSE lessons from t143 kept.
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
kill_port 9360
pkill -9 -f "next-server" 2>/dev/null
sleep 1

log "typecheck (changed-file focus, baseline noise tolerated)"
npx tsc --noEmit 2>&1 | rg "blog-seo-posts|llms.txt" && { log "FATAL: type errors in changed files"; exit 3; } || log "changed files clean"

log "production build"
timeout 480 bun x next build > /tmp/t145-build.log 2>&1
BUILD_RC=$?
if [ "$BUILD_RC" != "0" ]; then
  log "BUILD FAILED (rc=$BUILD_RC) — tail follows"
  tail -30 /tmp/t145-build.log
  exit 2
fi
log "build OK ($(grep -c 'Compiled successfully' /tmp/t145-build.log) compile marker)"

log "server start"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t145-server.log 2>&1 &
disown

log "poll"
up=0
for i in $(seq 1 40); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3222/blog 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP — log follows"
  strings /tmp/t145-server.log | tail -20
else
  log "boot check (EADDRINUSE guard)"
  if strings /tmp/t145-server.log | grep -q "EADDRINUSE"; then
    log "FATAL: new server hit EADDRINUSE — results would come from a stale server. Aborting."
    kill_port 3222; kill_port 9360; pkill -9 -f "next-server" 2>/dev/null
    exit 3
  fi
  log "harness (timeout 300)"
  timeout 300 node scripts/task145-keyword-check.mjs
  echo "harness_rc=$?"
fi

log "cleanup"
kill_port 3222
kill_port 9360
pkill -9 -f "next-server" 2>/dev/null
sleep 1
log "done"
