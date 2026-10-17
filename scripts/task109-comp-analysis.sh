#!/bin/bash
# Task 109: quantify live homepage sub-resources + API payloads

UA="Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
H=/home/z/my-project/scripts/task109-home.html
OUT=/home/z/my-project/scripts/task109-comp.txt
: > "$OUT"

echo "== CSS =="
grep -o '<link rel="stylesheet"[^>]*href="[^"]*"' "$H" | grep -o 'href="[^"]*"' | sed 's/href="//;s/"//' | while read u; do
  sz=$(curl -s -A "$UA" --compressed -o /dev/null -w '%{size_download}' "https://hayaan.co$u")
  echo "$sz bytes  $u" | tee -a "$OUT"
done

echo "== Preloaded (from link header, not in body css) =="
for u in $(grep -o '<link[^>]*rel="preload"[^>]*>' "$H" | grep -o 'href="[^"]*"' | sed 's/href="//;s/"//'); do
  sz=$(curl -s -A "$UA" --compressed -o /dev/null -w '%{size_download}' "https://hayaan.co$u")
  echo "$sz bytes  $u" | tee -a "$OUT"
done

echo "== Scripts (next chunks) =="
grep -o '<script[^>]*src="[^"]*"' "$H" | grep -o 'src="[^"]*"' | sed 's/src="//;s/"//' | sort -u | while read u; do
  sz=$(curl -s -A "$UA" --compressed -o /dev/null -w '%{size_download}' "https://hayaan.co$u")
  echo "$sz bytes  $u" | tee -a "$OUT"
done

echo "== inline script bytes in doc =="
python3 - <<'EOF'
import re
html = open('/home/z/my-project/scripts/task109-home.html', encoding='utf-8', errors='replace').read()
inline = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.S)
tot = sum(len(s) for s in inline)
print(f"{tot} bytes total across {len(inline)} inline scripts")
for s in inline:
    head = s.strip()[:90].replace('\n', ' ')
    print(f"  {len(s):>8}  {head}")
EOF

echo "== API payloads =="
for p in /api/products /api/categories; do
  sz=$(curl -s -A "$UA" --compressed -o /dev/null -w '%{size_download} %{time_total}s' "https://hayaan.co$p")
  echo "$p -> $sz" | tee -a "$OUT"
done

echo "== images referenced in first 60KB of doc (above-fold candidates) =="
head -c 60000 "$H" | grep -o 'src="[^"]*\(jpg\|jpeg\|png\|webp\|avif\)[^"]*"' | sort -u | head -12
