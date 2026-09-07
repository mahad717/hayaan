#!/usr/bin/env python3
"""Generate the branded 1200x630 OpenGraph image for hayaan.co.

Uses the site's own brand assets: Panton Black/Bold (src/app/fonts) and the
Hayaan palette (ivory bg, deep green type, Market Orange accents).
Output: public/og.png
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
IVORY = (250, 248, 241)
GREEN = (20, 83, 45)        # --primary / #14532d
GREEN_MID = (63, 125, 74)   # #3f7d4a
ORANGE = (242, 140, 40)     # #f28c28
GRAY = (107, 114, 128)      # muted-foreground

F_BLACK = "/home/z/my-project/src/app/fonts/Panton-Black.otf"
F_BOLD = "/home/z/my-project/src/app/fonts/Panton-Bold.otf"
F_REG = "/home/z/my-project/src/app/fonts/Panton-Regular.otf"

img = Image.new("RGB", (W, H), IVORY)
d = ImageDraw.Draw(img)

# Left orange accent spine
d.rectangle([0, 0, 14, H], fill=ORANGE)

# Soft decorative circles, top-right (brand-adjacent, very subtle)
for (cx, cy, r, col) in [(1010, 120, 150, (233, 228, 213)), (1120, 300, 90, (238, 234, 222))]:
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

# Brand row: orange dot + "HAYAAN MARKET" eyebrow
f_eyebrow = ImageFont.truetype(F_BOLD, 30)
d.ellipse([80, 96, 110, 126], fill=ORANGE)
d.text((126, 92), "HAYAAN MARKET", font=f_eyebrow, fill=GREEN_MID)

# Headline (Panton Black, two lines)
f_head = ImageFont.truetype(F_BLACK, 108)
d.text((78, 168), "Everything you", font=f_head, fill=GREEN)
d.text((78, 292), "need to shop.", font=f_head, fill=GREEN)

# Tagline
f_tag = ImageFont.truetype(F_REG, 38)
d.text((82, 442), "Useful finds across fashion, beauty, electronics, and home —", font=f_tag, fill=GRAY)
d.text((82, 492), "delivered to your door.", font=f_tag, fill=GRAY)

# URL pill, bottom-left
f_url = ImageFont.truetype(F_BOLD, 30)
pill_w = d.textlength("hayaan.co", font=f_url) + 88
d.rounded_rectangle([80, 546, 80 + pill_w, 586], radius=20, fill=GREEN)
tw = d.textlength("hayaan.co", font=f_url)
bbox = f_url.getbbox("hayaan.co")
th = bbox[3] - bbox[1]
d.text((80 + (pill_w - tw) / 2, 566 - th / 2), "hayaan.co", font=f_url, fill=IVORY)

# Orange plus-badge, bottom-right corner accent
d.rounded_rectangle([1040, 500, 1130, 590], radius=24, fill=ORANGE)
d.line([1067, 545, 1103, 545], fill=IVORY, width=10)
d.line([1085, 527, 1085, 563], fill=IVORY, width=10)

img.save("/home/z/my-project/public/og.png", "PNG", optimize=True)
print("og.png written:", img.size)
