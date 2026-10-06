#!/usr/bin/env bash
# Task 85 local E2E: product ratings & comments, dual-mode (local SQLite path).
# Tests: auth guard, post, upsert-edit, aggregate denormalization, admin
# moderation (hide/approve/delete), author delete, and pre-migration shape.
set -u
BASE="http://localhost:3000"
JAR="/tmp/t85-customer.jar"
AJAR="/tmp/t85-admin.jar"
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); echo "  ok: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1"; }
expect() { # expect <desc> <actual> <needle>  (grep -F: literal match)
  if echo "$2" | grep -qF "$3"; then ok "$1"; else bad "$1 — got: $(echo "$2" | head -c 220)"; fi
}

# --- setup: a customer + admin session, and a product id to review ----------
R=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d '{"email":"t85-reviewer@hayaan-testing.com","password":"test123456","name":"Task85 Tester"}')
if ! echo "$R" | grep -q "user"; then
  curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d '{"email":"t85-reviewer@hayaan-testing.com","password":"test123456"}' > /dev/null
fi

curl -s -c "$AJAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@hayaan.demo","password":"admin123"}' > /dev/null

PID=$(curl -s "$BASE/api/products?limit=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['products'][0]['id'])")
echo "product: $PID"

# --- 1. unauthenticated POST is blocked ------------------------------------
R=$(curl -s -X POST "$BASE/api/products/$PID/reviews" -H 'Content-Type: application/json' -d '{"rating":5}')
expect "POST without session -> 401" "$R" "Sign in to write a review"

# --- 2. GET (public) works pre-data: empty summary --------------------------
R=$(curl -s "$BASE/api/products/$PID/reviews")
expect "GET returns summary object" "$R" '"summary"'
expect "GET marks canReview=false for guests" "$R" '"canReview":false'

# --- 3. customer posts a review (rating + comment) --------------------------
R=$(curl -s -b "$JAR" -X POST "$BASE/api/products/$PID/reviews" -H 'Content-Type: application/json' \
  -d '{"rating":5,"comment":"Excellent console, fast delivery. EVC Plus payment worked first try."}')
expect "POST review succeeds" "$R" '"authorName":"Task85 Tester"'
expect "summary average=5 count=1" "$R" '"summary":{"average":5,"count":1'
expect "comment stored" "$R" "EVC Plus payment worked"

# --- 4. aggregate denormalized onto the product row --------------------------
R=$(curl -s "$BASE/api/products/$PID" 2>/dev/null; curl -s "$BASE/api/products?limit=100" | python3 -c "
import json,sys
for p in json.load(sys.stdin)['products']:
    if p['id']=='$PID': print(json.dumps({'rating':p['rating'],'reviewCount':p['reviewCount']}))")
expect "product row carries rating=5 reviewCount=1" "$R" '"rating": 5, "reviewCount": 1'

# --- 5. re-post = update (one review per user/product) ----------------------
R=$(curl -s -b "$JAR" -X POST "$BASE/api/products/$PID/reviews" -H 'Content-Type: application/json' \
  -d '{"rating":4,"comment":"Updated: still great, dock sold separately."}')
expect "upsert updates the same review" "$R" '"summary":{"average":4,"count":1'

# --- 6. admin sees it in the queue ------------------------------------------
R=$(curl -s -b "$AJAR" "$BASE/api/admin/reviews")
expect "admin queue lists the review" "$R" 'Task85 Tester'
expect "admin queue carries product context" "$R" '"product":{'

# --- 7. admin hide -> public list + aggregate exclude it ---------------------
RID=$(curl -s -b "$AJAR" "$BASE/api/admin/reviews" | python3 -c "import json,sys; print(json.load(sys.stdin)['reviews'][0]['id'])")
R=$(curl -s -b "$AJAR" -X PATCH "$BASE/api/admin/reviews/$RID" -H 'Content-Type: application/json' -d '{"status":"hidden"}')
expect "PATCH hide -> ok" "$R" '"status":"hidden"'
R=$(curl -s "$BASE/api/products/$PID/reviews")
expect "hidden review out of public list" "$R" '"reviews":[]'
R=$(curl -s "$BASE/api/products?limit=100" | python3 -c "
import json,sys
for p in json.load(sys.stdin)['products']:
    if p['id']=='$PID': print(json.dumps({'rating':p['rating'],'reviewCount':p['reviewCount']}))")
expect "product aggregates reset to 0" "$R" '"rating": 0, "reviewCount": 0'

# --- 8. author still sees their own (hidden) review via GET ------------------
R=$(curl -s -b "$JAR" "$BASE/api/products/$PID/reviews")
expect "myReview returned to its author" "$R" '"userId"'
expect "author review marked hidden" "$R" '"status":"hidden"'

# --- 9. re-approve ------------------------------------------------------------
R=$(curl -s -b "$AJAR" -X PATCH "$BASE/api/admin/reviews/$RID" -H 'Content-Type: application/json' -d '{"status":"approved"}')
expect "PATCH approve -> ok" "$R" '"status":"approved"'
R=$(curl -s "$BASE/api/products/$PID/reviews")
expect "review back in public list" "$R" "Updated: still great"

# --- 10. invalid rating rejected ----------------------------------------------
R=$(curl -s -b "$JAR" -X POST "$BASE/api/products/$PID/reviews" -H 'Content-Type: application/json' -d '{"rating":9}')
expect "rating=9 -> 400" "$R" "1 to 5"

# --- 11. author deletes their own review --------------------------------------
R=$(curl -s -b "$JAR" -X DELETE "$BASE/api/products/$PID/reviews")
expect "author DELETE -> ok, summary 0" "$R" '"ok":true,"summary":{"average":0,"count":0'

# --- 12. admin re-posts (as admin user) then deletes via queue ----------------
R=$(curl -s -b "$AJAR" -X POST "$BASE/api/products/$PID/reviews" -H 'Content-Type: application/json' -d '{"rating":5,"comment":"cleanup probe"}')
AID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['review']['id'])")
R=$(curl -s -b "$AJAR" -X DELETE "$BASE/api/admin/reviews/$AID")
expect "admin DELETE -> ok" "$R" '"ok":true'
R=$(curl -s -b "$AJAR" "$BASE/api/admin/reviews")
expect "queue empty after cleanup" "$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")" "0"

# --- 13. non-admin blocked from admin queue -----------------------------------
R=$(curl -s -b "$JAR" "$BASE/api/admin/reviews")
expect "customer -> 403 on admin queue" "$R" "Admin access required"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
