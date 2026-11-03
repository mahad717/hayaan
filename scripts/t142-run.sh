#!/bin/bash
# Task 142 local verify — single session: fresh dev server + t141 regression + t142 geometry.
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 2
rm -f dev.log /tmp/t142.log
setsid nohup npx next dev -p 3000 > /tmp/t142-dev.log 2>&1 &
SRV=$!
# Wait for :3000 to answer (compile on first hit)
CODE=000
for i in $(seq 1 150); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$CODE" = "200" ] && break
  sleep 1
done
echo "warmup status: $CODE"
sleep 2
# Second warm-up hit: first 200 can still be the compile race; verify fingerprints now stable
curl -s http://localhost:3000/ | grep -c "hero-shopping-3d-v2" || true
echo "=== t141 regression (17 checks) ==="
node scripts/t141-verify.mjs http://localhost:3000
T141=$?
echo "T141_EXIT:$T141"
echo "=== t142 geometry (9 checks) ==="
node scripts/t142-verify.mjs http://localhost:3000
T142=$?
echo "T142_EXIT:$T142"
kill $SRV 2>/dev/null; pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null
echo "ALL_DONE"
