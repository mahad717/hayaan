#!/bin/bash
# Task 128 local verification pipeline — every stage marked, hard-bounded.
cd /home/z/my-project
log() { echo "=== [$(date +%H:%M:%S)] $1 ==="; }

log "port cleanup"
fuser -k 3221/tcp 9357/tcp 2>/dev/null
sleep 1

log "server start"
NODE_ENV=production bun x next start -p 3221 > /tmp/t128-server.log 2>&1 &
SRV=$!
disown

log "poll"
up=0
for i in $(seq 1 40); do
  sleep 1
  code=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3221/investors 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then echo "server up (${i}s)"; up=1; break; fi
done
if [ "$up" != "1" ]; then
  log "SERVER NEVER CAME UP — log follows"
  tail -20 /tmp/t128-server.log
else
  log "harness (timeout 150)"
  timeout 150 node scripts/task128-investor-check.mjs
  echo "harness_rc=$?"
fi

log "cleanup"
kill -9 $SRV 2>/dev/null
fuser -k 3221/tcp 9357/tcp 2>/dev/null
sleep 1
python3 - << 'PYEOF'
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db', timeout=3)
cur = con.execute("DELETE FROM leads WHERE source='investors-page'")
con.commit(); print('cleaned test leads:', cur.rowcount)
PYEOF
log "done"
