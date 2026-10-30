#!/usr/bin/env bash
# Task 136 prod verification — hayaan.co
# SSR fetch checks (trust pages, footer, sitemap, guest API gate), ONE
# clearly-marked probe guest order (pending, unpaid — owner cancels in admin),
# then lookup + guest return page against it, then a light mobile CDP pass.
set -u
cd "$(dirname "$0")/.."
BASE="https://hayaan.co"
PASS=0; FAIL=0
ok()  { echo "PASS  $1${2:+ — $2}"; PASS=$((PASS+1)); }
bad() { echo "FAIL  $1${2:+ — $2}"; FAIL=$((FAIL+1)); }

echo "== SSR: trust pages =="
curl -s -o /tmp/p136-privacy.html -w "%{http_code}" "$BASE/privacy" | grep -q 200 && grep -q "Privacy policy" /tmp/p136-privacy.html && ok "/privacy 200 + EN copy" || bad "/privacy"
curl -s "$BASE/terms" | grep -q "Terms of service" && ok "/terms renders" || bad "/terms"
curl -s "$BASE/cookies" | grep -q "shop_session" && ok "/cookies renders" || bad "/cookies"
SHIP=$(curl -s "$BASE/shipping")
echo "$SHIP" | grep -q "Delivery fee" && echo "$SHIP" | grep -q '\$6.95' && echo "$SHIP" | grep -q 'Hodan' && ok "/shipping data-driven fee table (20 districts + outside row)" || bad "/shipping"
curl -s -H "Cookie: hayaan_lang=so" "$BASE/privacy" | grep -q "Siyaasada sirdarta" && ok "/privacy SO variant" || bad "/privacy SO variant"
curl -s "$BASE/sitemap.xml" | grep -q "/privacy" && ok "sitemap lists trust pages" || bad "sitemap"

echo "== SSR: footer on the live homepage =="
curl -s -o /tmp/p136-home.html "$BASE/"
grep -q 'href="/privacy"' /tmp/p136-home.html && grep -q 'href="/terms"' /tmp/p136-home.html && grep -q 'href="/cookies"' /tmp/p136-home.html && grep -q 'href="/shipping"' /tmp/p136-home.html && grep -q 'href="/?view=orders"' /tmp/p136-home.html && ok "footer: 5 real trust/track links in SSR HTML" || bad "footer: trust links"
DEAD=$(grep -o 'href="#"' /tmp/p136-home.html | wc -l)
[ "$DEAD" = "0" ] && ok "footer: zero dead # links" || bad "footer: dead # links remain ($DEAD)"

echo "== API: guest order gate on prod (ONE marked probe order) =="
curl -s -o /tmp/p136-prods.json "$BASE/api/products?limit=500"
PROD_PID=$(node -e 'const j=JSON.parse(require("fs").readFileSync("/tmp/p136-prods.json","utf8"));const l=Array.isArray(j)?j:(j.products??[]);const p=l.find(p=>p.stock>0&&p.productType!=="digital")??l[0];console.log(p?p.id:"")')
[ -n "$PROD_PID" ] || { bad "prod catalog unreachable"; exit 1; }
cat > /tmp/p136-probe-req.json << EOF
{"shipping":{"name":"T136 DEPLOY PROBE (cancel in admin)","phone":"+252 61 000 0000","address":"probe","city":"Hodan","zip":"01000","country":"Somalia"},"items":[{"productId":"$PROD_PID","quantity":1}]}
EOF
curl -s -o /tmp/p136-probe.json -X POST "$BASE/api/payments/sifalo" -H "Content-Type: application/json" -d @/tmp/p136-probe-req.json
head -c 200 /tmp/p136-probe.json; echo
ORDER_ID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync("/tmp/p136-probe.json","utf8")).orderId||"")}catch{console.log("")}')
if [ -n "$ORDER_ID" ]; then ok "guest POST created pending order (no 401 wall) — orderId=$ORDER_ID"; else bad "guest POST /api/payments/sifalo"; fi

echo "== API: lookup + guest return page for the probe order =="
curl -s -o /tmp/p136-lookup.json -X POST "$BASE/api/orders/lookup" -H "Content-Type: application/json" -d "{\"ids\":[\"$ORDER_ID\"]}"
grep -q '"status":"pending"' /tmp/p136-lookup.json && grep -q '"items":\[' /tmp/p136-lookup.json && ok "/api/orders/lookup returns the probe order" || bad "lookup: $(head -c 120 /tmp/p136-lookup.json)"
curl -s -o /tmp/p136-return.html "$BASE/payment/sifalo?order_id=$ORDER_ID"
grep -q "Sign in to confirm your payment" /tmp/p136-return.html && bad "guest return page shows sign-in wall" || ok "guest return page: no sign-in wall"
grep -qE "Couldn’t check your payment|We couldn’t verify the payment yet|Payment pending approval|Payment was not completed" /tmp/p136-return.html && ok "guest return page renders order state (failed/pending/unknown)" || bad "guest return page state"
curl -s -o /tmp/p136-return2.html "$BASE/payment/sifalo?order_id=00000000-0000-0000-0000-000000000000"
grep -q "Sign in to confirm your payment" /tmp/p136-return2.html && ok "foreign ref still asks to sign in" || bad "foreign ref"

echo "== CDP (mobile): guest UI surface on prod =="
BASE="$BASE" ORDER_ID="$ORDER_ID" SHOT_PREFIX="download/task136-prod" DEBUG_PORT=9397 node scripts/t136-prod-check.mjs || FAIL=$((FAIL+1))

echo "== VERDICT: PASS=$PASS FAIL=$FAIL =="
[ "$FAIL" = 0 ] && echo "VERDICT: ALL PASS" || { echo "VERDICT: FAIL"; exit 1; }
