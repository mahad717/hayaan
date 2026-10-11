#!/bin/bash
# Task 94 deploy poll — waits until the Somali translation pass is live.
# Signals (all must appear):
#  1. Homepage SSR with hayaan_lang=so carries the Somali FAQ ("Maxay tahay Hayaan Market?")
#  2. /blog with so cookie carries the Somali "Read more" ("Akhri dheeraad ah")
#  3. 404 page with so cookie carries the Somali headline ("Boggan wuu lumay jidkiisa")
URL_HOMA="https://hayaan.co"
for i in $(seq 1 40); do
  H1=$(curl -s -H "Cookie: hayaan_lang=so" "$URL_HOMA" | grep -c "Maxay tahay Hayaan Market" || true)
  H2=$(curl -s -H "Cookie: hayaan_lang=so" "$URL_HOMA/blog" | grep -c "Akhri dheeraad ah" || true)
  H3=$(curl -s -H "Cookie: hayaan_lang=so" "$URL_HOMA/this-page-does-not-exist-94" | grep -c "Boggan wuu lumay jidkiisa" || true)
  echo "poll $i: homeFAQ=$H1 blogReadMore=$H2 notFound=$H3"
  if [ "$H1" -ge 1 ] && [ "$H2" -ge 1 ] && [ "$H3" -ge 1 ]; then
    echo "DEPLOYED: all 3 Somali signals live"
    exit 0
  fi
  sleep 15
done
echo "TIMEOUT: signals not found after 40 polls"
exit 1
