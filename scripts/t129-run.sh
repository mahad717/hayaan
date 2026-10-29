#!/bin/bash
# Task 129 local verification pipeline — every stage marked, hard-bounded.
# Port-kill lessons from t128: fuser does NOT exist in this sandbox (lsof),
# `bun x next start` spawns a next-server CHILD (setsid + group kill).
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
kill_port 9358
pkill -9 -f "next-server" 2>/dev/null
sleep 1

log "server start"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t129-server.log 2>&1 &
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
  strings /tmp/t129-server.log | tail -20
else
  log "boot check (EADDRINUSE guard)"
  if strings /tmp/t129-server.log | grep -q "EADDRINUSE"; then
    log "FATAL: new server hit EADDRINUSE — results would come from a stale server. Aborting."
    kill_port 3222; kill_port 9358; pkill -9 -f "next-server" 2>/dev/null
    exit 3
  fi
  log "harness (timeout 150)"
  timeout 150 node scripts/task129-keyword-check.mjs
  echo "harness_rc=$?"
fi

log "cleanup"
kill_port 3222
kill_port 9358
pkill -9 -f "next-server" 2>/dev/null
sleep 1
log "done"
