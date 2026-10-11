#!/bin/bash
# Task 87: poll Cloudflare deploy — signals = new AC cover 200, /blog HTML
# containing the new slugs, Mogadishu post serving its quick-answer text,
# and a product page carrying the "Before you order" guides section.
BASE="https://hayaan.co"
COVER="$BASE/images/blog/air-conditioner-price-in-somalia.jpg"
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$COVER")
  BLOG=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/blog" | rg -c 'online-shopping-in-mogadishu|air-conditioner-price-in-somalia|what-size-tv-to-buy-in-somalia' || true)
  POST=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/blog/online-shopping-in-mogadishu" | rg -c 'what does delivery cost to my street' || true)
  PDP=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/product/tv-lg-55-inch-smart" | rg -c 'Before you order' || true)
  echo "poll $i: cover=$CODE blog_refs=$BLOG post_quickanswer=$POST pdp_guides=$PDP  $(date -u +%H:%M:%SZ)"
  if [ "$CODE" = "200" ] && [ "${BLOG:-0}" -ge 1 ] && [ "${POST:-0}" -ge 1 ] && [ "${PDP:-0}" -ge 1 ]; then
    echo "DEPLOYED"
    exit 0
  fi
  sleep 45
done
echo "TIMEOUT after 20 polls"
exit 1
