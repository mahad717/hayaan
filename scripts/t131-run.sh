#!/bin/bash
# Task 131 local verify: footer backlink present + dofollow + footer shot.
cd /home/z/my-project
log() { echo "=== [$(date +%H:%M:%S)] $1 ==="; }
kill_port() { local pids; pids=$(lsof -t -i tcp:"$1" 2>/dev/null); [ -n "$pids" ] && kill -9 $pids 2>/dev/null; return 0; }

kill_port 3222; kill_port 9361; pkill -9 -f "next-server" 2>/dev/null; sleep 1

log "server start"
setsid env NODE_ENV=production bun x next start -p 3222 > /tmp/t131-server.log 2>&1 &
disown

log "poll"
up=0
for i in $(seq 1 40); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3222/ 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP"; strings /tmp/t131-server.log | tail -15; exit 3
fi
if strings /tmp/t131-server.log | grep -q "EADDRINUSE"; then
  log "FATAL: EADDRINUSE — stale server would fake results"; kill_port 3222; kill_port 9361; exit 3
fi

log "asserts"
H=$(curl -s --max-time 10 http://127.0.0.1:3222/)
echo "$H" | rg -q 'href="https://androva.ai/"' && echo "PASS link href present" || echo "FAIL link href missing"
echo "$H" | rg -q 'rel="noopener"' && echo "PASS rel=noopener (dofollow preserved)" || echo "FAIL rel missing"
echo "$H" | rg -q 'androva[^>]*nofollow|nofollow[^>]*androva' && echo "FAIL nofollow found" || echo "PASS no nofollow"
echo "$H" | rg -q 'Marketing partner' && echo "PASS anchor context present" || echo "FAIL anchor context missing"
I=$(curl -s --max-time 10 http://127.0.0.1:3222/investors)
echo "$I" | rg -q 'href="https://androva.ai/"' && echo "PASS sitewide: on /investors too" || echo "FAIL not on /investors"

log "footer screenshot"
timeout 90 node scripts/task131-footer-shot.mjs
echo "shot_rc=$?"

log "cleanup"
kill_port 3222; kill_port 9361; pkill -9 -f "next-server" 2>/dev/null; sleep 1
log "done"
