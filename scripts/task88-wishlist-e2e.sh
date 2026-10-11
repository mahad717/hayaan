#!/usr/bin/env bash
# Task 88 — local E2E for the wishlist API (Prisma/SQLite path).
# Boots nothing itself: expects the dev server on :3000 (started by the caller).
# Flow: guest GET -> guest POST 401 -> signup -> save -> idempotent re-save ->
# list -> delete -> empty list -> invalid payload 400.
set -uo pipefail

BASE="http://localhost:3000"
JAR="$(mktemp)"
EMAIL="t88-wishlist-$(date +%s)@shop.demo"
PASS="t88-Passw0rd!"
PID=""
FAILS=0

say()  { printf '%s\n' "$*"; }
pass() { say "PASS  $*"; }
fail() { say "FAIL  $*"; FAILS=$((FAILS+1)); }

jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))" 2>/dev/null; }

# 0. server up?
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "$BASE/api/products"; then break; fi
  sleep 1
done
curl -sf -o /dev/null "$BASE/api/products" || { say "server not ready"; exit 1; }

# 1. guest GET -> empty list
R=$(curl -s "$BASE/api/wishlist")
[ "$(echo "$R" | jqget "['products']" | head -1)" = "[]" ] && pass "guest GET returns empty list" || fail "guest GET: $R"

# 2. guest POST -> 401
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/wishlist" \
  -H 'Content-Type: application/json' -d '{"productId":"x"}')
[ "$CODE" = "401" ] && pass "guest POST rejected 401" || fail "guest POST code=$CODE"

# 3. signup throwaway user (cookie jar keeps the session)
CODE=$(curl -s -o /tmp/t88-signup.json -w '%{http_code}' -c "$JAR" -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"name\":\"T88 Tester\",\"password\":\"$PASS\"}")
[ "$CODE" = "200" ] || { say "signup body: $(cat /tmp/t88-signup.json)"; }
[ "$CODE" = "200" ] && pass "signup ok ($EMAIL)" || fail "signup code=$CODE"

# 4. pick a real product id
PID=$(curl -s "$BASE/api/products" | jqget "['products'][0]['id']")
[ -n "$PID" ] && pass "picked product $PID" || { fail "no product id"; exit 1; }

# 5. save it
R=$(curl -s -b "$JAR" -X POST "$BASE/api/wishlist" \
  -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\"}")
N=$(echo "$R" | jqget "['products'].__len__()")
SAVED=$(echo "$R" | jqget "['saved']")
{ [ "$SAVED" = "True" ] && [ "$N" = "1" ]; } && pass "POST saved the product (list=1)" || fail "POST: saved=$SAVED n=$N :: $R"

# 6. idempotent re-save
R=$(curl -s -b "$JAR" -X POST "$BASE/api/wishlist" \
  -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\"}")
N=$(echo "$R" | jqget "['products'].__len__()")
[ "$N" = "1" ] && pass "re-save stays at one row" || fail "re-save n=$N"

# 7. list returns the product with name+slug
NAME=$(echo "$R" | jqget "['products'][0]['name']")
[ -n "$NAME" ] && pass "list carries product rows (name=$NAME)" || fail "list empty"

# 8. remove it
R=$(curl -s -b "$JAR" -X DELETE "$BASE/api/wishlist?productId=$PID")
N=$(echo "$R" | jqget "['products'].__len__()")
[ "$N" = "0" ] && pass "DELETE removes the row (list=0)" || fail "DELETE n=$N :: $R"

# 9. invalid payload -> 400
CODE=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/wishlist" \
  -H 'Content-Type: application/json' -d '{}')
[ "$CODE" = "400" ] && pass "missing productId -> 400" || fail "invalid payload code=$CODE"

rm -f "$JAR" /tmp/t88-signup.json
say "----------------------------------------"
if [ "$FAILS" -eq 0 ]; then say "TASK88 E2E: ALL PASS"; else say "TASK88 E2E: $FAILS FAILURES"; exit 1; fi
