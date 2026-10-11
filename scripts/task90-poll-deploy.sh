#!/usr/bin/env bash
# Task 90 deploy poll — waits until the Norman UX pass is live on hayaan.co.
# Signal: the SSR'd PDP HTML carries the new delivery-preview markup
# ("pdp-delivery" is not a class; use the stable string "Free delivery on
# every order over" — only Task 90 renders it on the PDP), and the client
# checkout bundle carries the new key "co.payErrTitle".
set -uo pipefail
BASE="https://hayaan.co"
# A real, crawlable product page (used in prior tasks).
PDP_URL="$BASE/product/tv-lg-43-inch-smart"
if [ $# -ge 1 ]; then PDP_URL="$1"; fi

for i in $(seq 1 40); do
  OK_PDP=0; OK_JS=0
  PDP=$(curl -s --max-time 25 "$PDP_URL?cb=$RANDOM$RANDOM" 2>/dev/null)
  echo "$PDP" | grep -q "Free delivery on every order over" && OK_PDP=1
  # Grab the first _next/static chunk referenced and search for the new dict key
  CHUNK=$(echo "$PDP" | grep -o '/_next/static/chunks/[^"]*\.js' | head -1)
  if [ -n "$CHUNK" ]; then
    curl -s --max-time 25 "$BASE$CHUNK" 2>/dev/null | grep -q "payErrTitle" && OK_JS=1
  fi
  echo "poll $i: pdp-preview=$OK_PDP chunk=$OK_JS"
  if [ "$OK_PDP" = "1" ] && [ "$OK_JS" = "1" ]; then
    echo "DEPLOYED after $i polls (~$((i*15))s)"
    exit 0
  fi
  sleep 15
done
echo "TIMEOUT waiting for deploy"
exit 1
