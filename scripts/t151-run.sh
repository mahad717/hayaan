#!/bin/bash
# Task 151 local verification — product-card title clamp regression fix.
# Prod build already done. Start next start :3222, run t151-verify.mjs, kill.
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
pkill -9 -f "next-server" 2>/dev/null
sleep 1

log "server start"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t151-server.log 2>&1 &
disown

log "poll"
up=0
for i in $(seq 1 60); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3222/ 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP"
  strings /tmp/t151-server.log | tail -20
  kill_port 3222; pkill -9 -f "next-server" 2>/dev/null
  exit 3
fi

log "harness: clamp measurement + screenshot"
node scripts/t151-verify.mjs
RC=$?

log "server stop"
kill_port 3222
pkill -9 -f "next-server" 2>/dev/null

if [ "$RC" = "0" ]; then log "ALL GREEN"; else log "HARNESS FAILED rc=$RC"; fi
exit $RC
