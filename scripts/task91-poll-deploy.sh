#!/bin/bash
# Task 91 deploy poll: wait for the truncation-fix deploy to go live.
# Signals: homepage SSR carries >100 product links (141 expected);
# new-mobile PDPs 200; a NEW product appears in SSR HTML (iPhone 18).
set -e
for i in $(seq 1 20); do
  N=$(curl -s "https://hayaan.co/?t=$(date +%s)" | rg -o '/product/[a-z0-9()\-]+' | sort -u | wc -l)
  HAS18=$(curl -s "https://hayaan.co/?t=$(date +%s)" | rg -c 'iphone-18' || true)
  echo "poll $i: SSR product links=$N iphone-18-refs=$HAS18"
  if [ "$N" -ge 130 ] && [ "$HAS18" -ge 1 ]; then echo "DEPLOY LIVE"; exit 0; fi
  sleep 20
done
echo "TIMEOUT: fix not detected in 20 polls"
exit 1
