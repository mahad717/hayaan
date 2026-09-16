#!/usr/bin/env python3
"""Branded 'photo coming soon' placeholder for imported Hayaan products.

800x800 PNG (product cards render aspect-square), warm cream background
matching the card frame (#faf8f1), Hayaan green + market orange accents.
Uploaded to Supabase Storage and referenced as images[0] for every
imported product until the owner adds real photos via the admin form.
"""
from PIL import Image, ImageDraw, ImageFont

W = H = 800
CREAM = (250, 248, 241)      # card bg
GREEN = (63, 125, 74)        # Hayaan green (stock badge color)
ORANGE = (242, 140, 40)      # market orange (sale badge color)
INK = (55, 65, 81)           # soft slate for glyph
MUTED = (156, 163, 175)

img = Image.new("RGB", (W, H), CREAM)
d = ImageDraw.Draw(img)

# thin brand stripe on top
d.rectangle([0, 0, W, 14], fill=GREEN)
d.rectangle([0, 14, W, 20], fill=ORANGE)

# centered rounded photo frame
fx0, fy0, fx1, fy1 = 160, 170, 640, 570
d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=36, outline=GREEN, width=6)
d.rounded_rectangle([fx0 + 14, fy0 + 14, fx1 - 14, fy1 - 14], radius=26,
                    fill=(255, 255, 255))

# classic image glyph: sun + mountains inside the frame
d.ellipse([475, 225, 545, 295], fill=ORANGE)
d.polygon([(230, 520), (360, 340), (450, 460), (510, 390), (590, 520)],
          fill=(229, 231, 235), outline=(209, 213, 219), width=3)

def load_font(size, bold=True):
    path = f"/home/z/my-project/src/app/fonts/Panton-{'Bold' if bold else 'Regular'}.otf"
    return ImageFont.truetype(path, size)

# wordmark + caption
f_brand = load_font(58)
f_cap = load_font(34, bold=False)
brand = "Hayaan Market"
cap = "Photo coming soon"
bw = d.textlength(brand, font=f_brand)
cw = d.textlength(cap, font=f_cap)
d.text(((W - bw) / 2, 610), brand, font=f_brand, fill=GREEN)
d.text(((W - cw) / 2, 690), cap, font=f_cap, fill=MUTED)

out = "/home/z/my-project/scripts/placeholder-hayaan.png"
img.save(out, "PNG", optimize=True)
print("saved", out, img.size)
