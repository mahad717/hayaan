#!/usr/bin/env python3
"""Task 87: Extract text from Norman's 'The Design of Everyday Things' .mobi for UX principle grounding."""
import tempfile, re, html
from pathlib import Path
import mobi

SRC = Path("/home/z/my-project/upload/Norman, Donald A - The Design of Everyday Things - Revised and Expanded Edition (2013, Basic Books) [10.1207_s15327051hci0401_3] - libgen.li.mobi")
OUT = Path("/home/z/my-project/scripts/doet-fulltext.txt")

tempdir, extracted = mobi.extract(str(SRC))
print("Extracted to:", tempdir)

# Find the main html file
root = Path(tempdir)
html_files = list(root.rglob("*.html")) + list(root.rglob("*.htm")) + list(root.rglob("*.xhtml"))
print("HTML files:", [str(f) for f in html_files][:5])

if html_files:
    raw = html_files[0].read_text(encoding="utf-8", errors="ignore")
else:
    raise SystemExit("No HTML found inside mobi")

# Strip tags -> plain text
raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
raw = re.sub(r"<br[^>]*>|</p>|</div>|</h[1-6]>|</blockquote>", "\n", raw, flags=re.I)
text = re.sub(r"<[^>]+>", " ", raw)
text = html.unescape(text)
text = re.sub(r"[ \t]+", " ", text)
text = re.sub(r"\n\s*\n+", "\n\n", text)

OUT.write_text(text, encoding="utf-8")
print(f"Saved {len(text):,} chars to {OUT}")

# Show TOC-ish anchor lines to locate chapters
lines = [l.strip() for l in text.split("\n") if l.strip()]
chap_idx = [i for i, l in enumerate(lines) if re.match(r"^(chapter\s+\d+|[1-8]\s*[-–—]?\s*[A-Z])", l, re.I) and len(l) < 80]
print("\nPossible chapter markers (first 40):")
for i in chap_idx[:40]:
    print(f"  line {i}: {lines[i][:70]}")
