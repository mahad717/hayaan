#!/bin/bash
# Task 98: poll Cloudflare deploy — signals = A18 post serving the revised
# 128GB claims ("same 128GB"), zero 256GB left in the POST HTML, llms.txt
# bullet "(128GB)", and the A18 PDP guide card blurb "$187 with 128GB".
BASE="https://hayaan.co"
for i in $(seq 1 20); do
  POST_NEW=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/blog/samsung-galaxy-a18-price-in-somalia" -o /tmp/task98-post.html -w "%{http_code}")
  SAME128=$(grep -c 'same 128GB' /tmp/task98-post.html 2>/dev/null || echo 0)
  OLD256=$(grep -c '256GB' /tmp/task98-post.html 2>/dev/null || echo 0)
  LLM=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/llms.txt" | grep -c '\$187 (128GB)' || true)
  PDP=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/product/samsung-galaxy-a18" | grep -c 'with 128GB' || true)
  echo "poll $i: post_http=$POST_NEW same128=$SAME128 old256_left=$OLD256 llms_128gb=$LLM pdp_guide_128gb=$PDP  $(date -u +%H:%M:%SZ)"
  if [ "$POST_NEW" = "200" ] && [ "${SAME128:-0}" -ge 2 ] && [ "${OLD256:-0}" = "0" ] && [ "${LLM:-0}" -ge 1 ] && [ "${PDP:-0}" -ge 1 ]; then
    echo "DEPLOYED"
    exit 0
  fi
  sleep 45
done
echo "TIMEOUT after 20 polls"
exit 1
