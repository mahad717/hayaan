#!/usr/bin/env bash
# Task 136: guest checkout (audit F1) + footer trust pages (audit F4) —
# build + local prod server (FAKE Sifalo creds so the guest branch reaches
# order creation; the gateway call itself fails and is asserted as such) +
# CDP harness phases + DB-level assertions via Prisma.
set -u
cd "$(dirname "$0")/.."
PORT=3159
BASE="http://127.0.0.1:$PORT"
LOG=/tmp/t136-server.log
FAIL=0

echo "== build =="
bun x next build || { echo "FAIL: build"; exit 1; }

if curl -s -m 2 -o /dev/null "$BASE"; then
  echo "FAIL: port $PORT already serving — stale server?"; exit 1
fi

echo "== start prod server on :$PORT (fake Sifalo creds) =="
SIFALO_USERNAME=t136-fake SIFALO_PASSWORD=t136-fake \
NODE_ENV=production setsid bun x next start -p "$PORT" >"$LOG" 2>&1 &
SRV=$!
for i in $(seq 1 60); do
  if curl -s -m 2 -o /dev/null "$BASE"; then break; fi
  sleep 1
done
if ! curl -s -m 3 -o /dev/null "$BASE"; then echo "FAIL: server never came up"; tail -20 "$LOG"; kill -- -"$SRV" 2>/dev/null; exit 1; fi
if grep -q "EADDRINUSE" "$LOG"; then echo "FAIL: EADDRINUSE"; kill -- -"$SRV" 2>/dev/null; exit 1; fi

echo "== phase 1: guest UI flow + trust pages =="
BASE="$BASE" node scripts/t136-check.mjs || FAIL=1

echo "== DB assert: pending guest order exists (user_id NULL) =="
GUEST_JSON=$(node scripts/t136-db-check.mjs guest --marker "T136 Guest Tester" 2>&1)
echo "$GUEST_JSON"
node -e '
const o = JSON.parse(process.argv[1] ?? "null");
const good = o && o.userId === null && o.status === "pending" && o.paymentStatus === "pending" && Array.isArray(o.items) && o.items.length >= 1;
console.log((good ? "PASS" : "FAIL") + "  DB: guest order pending, user_id NULL, items present");
process.exit(good ? 0 : 1);
' "$GUEST_JSON" || FAIL=1
ORDER_ID=$(node -e 'try { console.log(JSON.parse(process.argv[1]).id); } catch { console.log(""); }' "$GUEST_JSON")

echo "== phase 2: lookup / return page / merge / signed-in regression =="
BASE="$BASE" PHASE=verify ORDER_ID="$ORDER_ID" node scripts/t136-check.mjs 2>&1 | tee /tmp/t136-phase2.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then FAIL=1; fi

echo "== DB assert: signed-in order created under the account =="
TUID=$(grep -o "T136UID=[a-zA-Z0-9c]*" /tmp/t136-phase2.log 2>/dev/null | head -1 | cut -d= -f2)
if [ -z "$TUID" ]; then
  TUID=$(node -e '
    const { PrismaClient } = require("@prisma/client");
    const db = new PrismaClient();
    db.user.findFirst({ where: { email: { contains: "t136-" } }, orderBy: { createdAt: "desc" } })
      .then((u) => { console.log(u?.id ?? ""); return db.$disconnect(); });
  ' 2>/dev/null)
fi
if [ -n "$TUID" ]; then
  USER_JSON=$(node scripts/t136-db-check.mjs user --uid "$TUID" --marker "SIGNEDIN" 2>&1)
  echo "$USER_JSON"
  node -e '
    const o = JSON.parse(process.argv[1] ?? "null");
    const good = o && typeof o.userId === "string" && o.userId.length > 0 && o.status === "pending";
    console.log((good ? "PASS" : "FAIL") + "  DB: signed-in order has user_id attached");
    process.exit(good ? 0 : 1);
  ' "$USER_JSON" || FAIL=1
else
  echo "FAIL  DB: could not resolve the signup user id"; FAIL=1
fi

kill -- -"$SRV" 2>/dev/null
if [ "$FAIL" = 0 ]; then echo "VERDICT: ALL PASS"; else echo "VERDICT: FAIL"; exit 1; fi
