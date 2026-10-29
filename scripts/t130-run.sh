#!/bin/bash
# Task 130 local verify pipeline — server lifecycle in ONE tool call.
# Reuses t129 lessons: lsof port kills (no fuser), setsid + group kill
# (next-server is a child), EADDRINUSE guard.
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

log "server start"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t130-server.log 2>&1 &
disown

log "poll"
up=0
for i in $(seq 1 40); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3222/investors 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP — log follows"
  strings /tmp/t130-server.log | tail -20
else
  log "boot check (EADDRINUSE guard)"
  if strings /tmp/t130-server.log | grep -q "EADDRINUSE"; then
    log "FATAL: new server hit EADDRINUSE — results would come from a stale server. Aborting."
    kill_port 3222; kill_port 9360; pkill -9 -f "next-server" 2>/dev/null
    exit 3
  fi
  log "harness (timeout 150)"
  timeout 150 node scripts/task130-investors-copy-check.mjs
  echo "harness_rc=$?"
fi

log "cleanup"
kill_port 3222
kill_port 9360
pkill -9 -f "next-server" 2>/dev/null
sleep 1
log "done"
