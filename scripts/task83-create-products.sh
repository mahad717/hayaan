#!/bin/bash
# Task 83 — create the two sanguni.so PS5 products on hayaan.co.
# Prereq: a promoted deploy containing the seed pagination fix (so
# POST /api/seed can re-assert admin@shop.demo / admin123), then this script
# logs in and creates both products through the normal admin API.
set -e
BASE="https://hayaan.co"
CJ=/tmp/hayaan-cookies.txt
CAT_ID="3646f5b1-2a55-4106-a96e-adc871904403"   # Computers & TV (gaming)

echo "== seed (re-asserts demo admin credentials) =="
curl -s -X POST "$BASE/api/seed" -H "Content-Type: application/json" -d '{}' | head -c 300; echo

echo "== login admin@shop.demo =="
curl -s -c $CJ -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@shop.demo","password":"admin123"}' | head -c 200; echo

echo "== session check =="
ROLE=$(curl -s -b $CJ "$BASE/api/auth/me" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('role',''))")
echo "role=$ROLE"
[ "$ROLE" = "admin" ] || { echo "NOT ADMIN — aborting"; exit 1; }

echo "== create PS5 Slim Digital Edition =="
curl -s -b $CJ -X POST "$BASE/api/products" -H "Content-Type: application/json" -d '{
  "name": "Sony PlayStation 5 Digital Edition (Slim)",
  "description": "<p>The PlayStation 5 Digital Edition (slim) is Sony'\''s sleeker, lighter PS5 — same lightning-fast SSD performance, with no disc drive. Comes as a complete bundle with the DualSense wireless controller, ready to play out of the box.</p><ul><li>PlayStation 5 console — Digital Edition, slim design</li><li>DualSense wireless controller included</li><li>1TB SSD (solid-state drive)</li><li>2 plastic stand feet to place the console horizontally</li><li>HDMI cable</li></ul><p>Digital games, storefront, and multiplayer all run on the same PS5 platform — buy and download titles directly from the PlayStation Store.</p>",
  "price": 720,
  "currency": "USD",
  "stock": 10,
  "categoryId": "'"$CAT_ID"'",
  "images": [
    "https://hayaan.co/images/products/ps5-slim-digital-1.jpg"
  ],
  "tags": ["sony", "playstation", "ps5", "console", "gaming"],
  "featured": false,
  "isActive": true,
  "supplierUrl": "https://sanguni.so/product/playstation5-digital-edition-slim/"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('product',{}); print('created:', p.get('slug'), '| id:', p.get('id'), '| err:', d.get('error'))"

echo "== create PS5 Pro 2TB =="
curl -s -b $CJ -X POST "$BASE/api/products" -H "Content-Type: application/json" -d '{
  "name": "Sony PlayStation 5 Pro 2TB",
  "description": "<p>The PlayStation 5 Pro is Sony'\''s most powerful console yet — built for serious 4K gaming with PlayStation Spectral Super Resolution (PSSR), AI-upscaled visuals, and advanced ray tracing. Ships with a 2TB NVMe SSD and the DualSense wireless controller.</p><ul><li>2TB NVMe SSD storage</li><li>All-digital design (disc drive sold separately)</li><li>PlayStation Spectral Super Resolution (PSSR)</li><li>Optimized console performance — 60fps, up to 120fps in compatible games</li><li>Wi-Fi 7 — next-level online wireless connectivity</li><li>DualSense wireless controller included</li></ul>",
  "price": 1180,
  "currency": "USD",
  "stock": 10,
  "categoryId": "'"$CAT_ID"'",
  "images": [
    "https://hayaan.co/images/products/ps5-pro-2tb-1.jpg",
    "https://hayaan.co/images/products/ps5-pro-2tb-2.jpg"
  ],
  "tags": ["sony", "playstation", "ps5 pro", "console", "gaming"],
  "featured": false,
  "isActive": true,
  "supplierUrl": "https://sanguni.so/product/playstation-sony-5pro-2tb-slim/"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('product',{}); print('created:', p.get('slug'), '| id:', p.get('id'), '| err:', d.get('error'))"
