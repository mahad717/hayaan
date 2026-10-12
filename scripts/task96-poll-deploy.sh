#!/bin/bash
# Task 96: poll Cloudflare deploy — signals = A18 cover 200, /blog HTML carrying
# the new slug, the post serving its quick-answer text, the A18 PDP rendering the
# new guide card, and llms.txt carrying the bullet.
BASE="https://hayaan.co"
C1="$BASE/images/blog/samsung-galaxy-a18-price-in-somalia.jpg"
for i in $(seq 1 20); do
  K1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$C1")
  BLOG=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/blog" | grep -c 'samsung-galaxy-a18-price-in-somalia' || true)
  POST=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/blog/samsung-galaxy-a18-price-in-somalia" | grep -c 'European launch price' || true)
  PDP=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/product/samsung-galaxy-a18" | grep -c 'samsung-galaxy-a18-price-in-somalia' || true)
  LLM=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/llms.txt" | grep -c 'samsung-galaxy-a18-price-in-somalia' || true)
  echo "poll $i: cover=$K1 blog_refs=$BLOG post_quickanswer=$POST pdp_guide=$PDP llms=$LLM  $(date -u +%H:%M:%SZ)"
  if [ "$K1" = "200" ] && [ "${BLOG:-0}" -ge 1 ] && [ "${POST:-0}" -ge 1 ] && [ "${PDP:-0}" -ge 1 ] && [ "${LLM:-0}" -ge 1 ]; then
    echo "DEPLOYED"
    exit 0
  fi
  sleep 45
done
echo "TIMEOUT after 20 polls"
exit 1
