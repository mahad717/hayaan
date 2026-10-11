#!/bin/bash
# Task 93: poll Cloudflare deploy — signals = 3 new covers 200, /blog HTML
# carrying the new slugs, router post serving its quick-answer text, and a
# router PDP rendering the new guide card.
BASE="https://hayaan.co"
C1="$BASE/images/blog/wifi-router-price-in-somalia.jpg"
C2="$BASE/images/blog/printer-price-in-somalia.jpg"
C3="$BASE/images/blog/online-shopping-in-hargeisa.jpg"
for i in $(seq 1 20); do
  K1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$C1")
  K2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$C2")
  K3=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -H "Cache-Control: no-cache" "$C3")
  BLOG=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/blog" | rg -c 'wifi-router-price-in-somalia|printer-price-in-somalia|online-shopping-in-hargeisa' || true)
  POST=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/blog/wifi-router-price-in-somalia" | rg -c 'cheapest piece of technology' || true)
  PDP=$(curl -s --max-time 25 -H "Cache-Control: no-cache" "$BASE/product/tp-link-ac750-wireless-dual-band-router" | rg -c 'wifi-router-price-in-somalia' || true)
  LLM=$(curl -s --max-time 20 -H "Cache-Control: no-cache" "$BASE/llms.txt" | rg -c 'online-shopping-in-hargeisa' || true)
  echo "poll $i: covers=$K1/$K2/$K3 blog_refs=$BLOG post_quickanswer=$POST pdp_guide=$PDP llms=$LLM  $(date -u +%H:%M:%SZ)"
  if [ "$K1" = "200" ] && [ "$K2" = "200" ] && [ "$K3" = "200" ] && [ "${BLOG:-0}" -ge 1 ] && [ "${POST:-0}" -ge 1 ] && [ "${PDP:-0}" -ge 1 ] && [ "${LLM:-0}" -ge 1 ]; then
    echo "DEPLOYED"
    exit 0
  fi
  sleep 45
done
echo "TIMEOUT after 20 polls"
exit 1
