#!/usr/bin/env python3
"""Task 54: detect + remove the Sanguni watermark (blue hexagon + orange G)
from the scraped product images, then save clean copies.
Detection: top-right region, pixels close to logo blue RGB(17,97,159) or
orange RGB(243,164,46); require both colors present -> logo bbox.
Removal: cv2.inpaint (TELEA) with dilated logo-color mask.
Output: scripts/product_images_clean/<slug>.jpg + detection report JSON.
"""
import json, os, glob
import numpy as np
from PIL import Image
import cv2

SRC = "/home/z/my-project/scripts/product_images"
DST = "/home/z/my-project/scripts/product_images_clean"
REPORT = "/home/z/my-project/scripts/logo-detection.json"
os.makedirs(DST, exist_ok=True)

BLUE = np.array([17, 97, 159])
ORANGE = np.array([243, 164, 46])

def color_mask(rgb, ref, tol):
    d = np.abs(rgb.astype(int) - ref).sum(axis=2)
    return d <= tol

report = []
for path in sorted(glob.glob(f"{SRC}/*.jpg")):
    slug = os.path.basename(path)[:-4]
    im = np.array(Image.open(path).convert("RGB"))
    h, w = im.shape[:2]
    # search window: top-right region where the watermark sits
    x0, y1 = int(w * 0.55), int(h * 0.35)
    win = im[0:y1, x0:w]
    mblue = color_mask(win, BLUE, 150)
    morange = color_mask(win, ORANGE, 150)
    nb, no = int(mblue.sum()), int(morange.sum())
    # logo requires a meaningful amount of BOTH colors
    if nb > 250 and no > 120:
        m = (mblue | morange).astype(np.uint8) * 255
        m = cv2.dilate(m, np.ones((9, 9), np.uint8))
        ys, xs = np.where(m > 0)
        bx0, bx1 = x0 + int(xs.min()), x0 + int(xs.max())
        by0, by1 = int(ys.min()), int(ys.max())
        # build full-image mask and inpaint
        full = np.zeros((h, w), np.uint8)
        full[0:y1, x0:w] = m
        clean = cv2.inpaint(im[:, :, ::-1].copy(), full, 5, cv2.INPAINT_TELEA)[:, :, ::-1]
        status = "cleaned"
    elif nb + no > 0:
        bx0 = bx1 = by0 = by1 = 0
        status = "faint"
    else:
        bx0 = bx1 = by0 = by1 = 0
        status = "none"
    if status == "cleaned":
        Image.fromarray(clean).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)
    else:
        Image.fromarray(im).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)
    report.append({"slug": slug, "status": status, "bbox": [bx0, by0, bx1, by1],
                   "blue_px": nb, "orange_px": no})

json.dump(report, open(REPORT, "w"), indent=1)
n_clean = sum(1 for r in report if r["status"] == "cleaned")
n_faint = sum(1 for r in report if r["status"] == "faint")
print(f"total={len(report)} cleaned={n_clean} faint={n_faint} none={len(report)-n_clean-n_faint}")
for r in report:
    if r["status"] != "none":
        print(f'  {r["status"]:7s} {r["slug"]} bbox={r["bbox"]} blue={r["blue_px"]} orange={r["orange_px"]}')
