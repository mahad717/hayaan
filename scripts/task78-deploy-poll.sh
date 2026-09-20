#!/usr/bin/env bash
# Task 78 deploy poll: content-hash chunk marker probe.
# Baseline the live chunk set, then poll until a chunk hash appears that
# was NOT in the baseline set (new build deployed). Never trusts HTML cache
# headers — we compare actual bytes of chunk URLs found in fresh HTML fetches.
set -u
BASE="https://hayaan.co"
CACHE_BUST="$RANDOM$RANDOM"

baseline_chunks() {
  curl -s -H 'Cache-Control: no-cache' "$BASE/?cb=$CACHE_BUST" \
    | grep -oE '/_next/static/chunks/[a-zA-Z0-9._/-]+\.js' | sort -u
}

echo "== baseline chunk set =="
BASELINE=$(baseline_chunks)
echo "$BASELINE" | head -50
echo "== baseline count: $(echo "$BASELINE" | wc -l) =="

for i in $(seq 1 60); do
  CACHE_BUST="$RANDOM$RANDOM"
  LIVE=$(baseline_chunks)
  NEW=$(comm -13 <(echo "$BASELINE") <(echo "$LIVE"))
  if [ -n "$NEW" ]; then
    echo "DEPLOYED after poll #$i — new chunk(s):"
    echo "$NEW"
    exit 0
  fi
  echo "poll #$i: no new chunks yet ($(echo "$LIVE" | wc -l) chunks)"
  sleep 20
done
echo "TIMEOUT: no new chunk hashes after 60 polls"
exit 1
