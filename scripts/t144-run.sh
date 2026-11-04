#!/bin/bash
# Task 144 local verify — single session: fresh dev server + t144 (badge removal)
# + t141 regression (17) + t142 regression (9, chip geometry untouched).
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 2
rm -f /tmp/t144-dev.log
setsid nohup npx next dev -p 3000 > /tmp/t144-dev.log 2>&1 &
SRV=$!
CODE=000
for i in $(seq 1 150); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$CODE" = "200" ] && break
  sleep 1
done
echo "warmup status: $CODE"
sleep 2
curl -s http://localhost:3000/ > /dev/null   # second warm-up hit (compile race guard)
echo "=== t144 badge removal (15 checks) ==="
node scripts/t144-verify.mjs http://localhost:3000
echo "T144_EXIT:$?"
echo "=== t141 regression (17 checks) ==="
node scripts/t141-verify.mjs http://localhost:3000
echo "T141_EXIT:$?"
echo "=== t142 regression (9 checks) ==="
node scripts/t142-verify.mjs http://localhost:3000
echo "T142_EXIT:$?"
kill $SRV 2>/dev/null; pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null
echo "ALL_DONE"
