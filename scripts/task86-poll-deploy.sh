#!/bin/bash
# Task 86: poll Cloudflare deploy — signal = new cover asset 200 + /blog HTML
# containing the new slugs + post page serving the quick-answer text.
BASE="https://hayaan.co"
COVER="$BASE/images/blog/ps5-price-in-somalia.jpg"
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$COVER")
  BLOG=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/blog" | rg -c 'ps5-price-in-somalia' || true)
  POST=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/blog/ps5-price-in-somalia" | rg -c 'The PS5 price in Somalia starts at' || true)
  echo "poll $i: cover=$CODE blog_refs=$BLOG post_quickanswer=$POST  $(date -u +%H:%M:%SZ)"
  if [ "$CODE" = "200" ] && [ "${BLOG:-0}" -ge 1 ] && [ "${POST:-0}" -ge 1 ]; then
    echo "DEPLOYED"
    exit 0
  fi
  sleep 45
done
echo "TIMEOUT after 20 polls"
exit 1
