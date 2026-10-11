#!/usr/bin/env bash
# Task 88 deploy poll — waits until the wishlist API + new bundle are live on hayaan.co.
# Signals: /api/wishlist exists (guest 200 {products:[]}), homepage HTML carries
# wishlist aria-labels in the client bundle reference, card heart CSS class present.
set -uo pipefail
TOKEN_URL="https://hayaan.co"
for i in $(seq 1 40); do
  API=$(curl -s -o /tmp/t88-api.json -w '%{http_code}' "$TOKEN_URL/api/wishlist" 2>/dev/null || echo 000)
  OK_API=0; [ "$API" = "200" ] && OK_API=1
  OK_HTML=0
  if [ "$OK_API" = "1" ]; then
    curl -s "$TOKEN_URL/" -o /tmp/t88-home.html 2>/dev/null
    grep -q "wishlist" /tmp/t88-home.html && OK_HTML=1
  fi
  echo "poll $i: api=$API htmlhas=$OK_HTML"
  if [ "$OK_API" = "1" ] && [ "$OK_HTML" = "1" ]; then
    echo "DEPLOYED after $i polls"
    cat /tmp/t88-api.json
    exit 0
  fi
  sleep 15
done
echo "TIMEOUT waiting for deploy"
exit 1
