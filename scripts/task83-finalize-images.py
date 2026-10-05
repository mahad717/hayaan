"""Task 83: finalize PS5 product images — 1200px wide, repo-hosted (public/images/products/)."""
from PIL import Image

SRC = "/home/z/my-project/download/task83"
OUT = "/home/z/my-project/public/images/products"

targets = {
    "ps5-slim-digital-1.jpg": f"{SRC}/slim-1-clean.jpg",   # console + DualSense
    "ps5-pro-2tb-1.jpg":      f"{SRC}/pro-2-clean.jpg",    # console + DualSense (card)
    "ps5-pro-2tb-2.jpg":      f"{SRC}/pro-1-clean.jpg",    # retail box shot
}
for out_name, src in targets.items():
    img = Image.open(src).convert("RGB")
    w, h = img.size
    if w > 1200:
        img = img.resize((1200, round(h * 1200 / w)), Image.LANCZOS)
    img.save(f"{OUT}/{out_name}", quality=85, optimize=True, progressive=True)
    print(out_name, img.size)
