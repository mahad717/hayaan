#!/usr/bin/env python3
"""Task 54 v2: robust Sanguni watermark detection + removal.
Full-image scan; logo = connected cluster containing BOTH logo-blue and
logo-orange; area-scaled thresholds; inpaint dilated logo strokes only.
Outputs: scripts/product_images_clean/ + crops/ before|after evidence sheets.
"""
import json, os, glob
import numpy as np
from PIL import Image
import cv2

SRC = "/home/z/my-project/scripts/product_images"
DST = "/home/z/my-project/scripts/product_images_clean"
CROPS = "/home/z/my-project/scripts/logo-crops"
REPORT = "/home/z/my-project/scripts/logo-detection.json"
os.makedirs(DST, exist_ok=True)
os.makedirs(CROPS, exist_ok=True)

BLUE = np.array([17, 97, 159])
ORANGE = np.array([243, 164, 46])
BASE_W, BASE_H = 1225.0, 1400.0  # reference scale for thresholds

def masks(rgb):
    db = np.abs(rgb.astype(int) - BLUE).sum(axis=2)
    do = np.abs(rgb.astype(int) - ORANGE).sum(axis=2)
    return db <= 170, do <= 170

report = []
for path in sorted(glob.glob(f"{SRC}/*.jpg")):
    slug = os.path.basename(path)[:-4]
    im = np.array(Image.open(path).convert("RGB"))
    h, w = im.shape[:2]
    scale = (w * h) / (BASE_W * BASE_H)
    min_blue, min_orange = max(60, 250 * scale), max(30, 120 * scale)

    mblue, morange = masks(im)
    combined = ((mblue | morange).astype(np.uint8)) * 255
    combined = cv2.dilate(combined, np.ones((7, 7), np.uint8))
    ncomp, labels, stats, _ = cv2.connectedComponentsWithStats(combined, 8)

    logo_mask = np.zeros((h, w), np.uint8)
    boxes = []
    for i in range(1, ncomp):
        x, y, cw, ch, area = stats[i]
        if cw < 30 or ch < 40 or cw > w * 0.5 or ch > h * 0.6:
            continue
        comp = labels == i
        nb = int((comp & mblue).sum())
        no = int((comp & morange).sum())
        if nb >= min_blue and no >= min_orange:
            ar = cw / ch
            if 0.45 <= ar <= 1.6:
                logo_mask[comp] = 255
                boxes.append([int(x), int(y), int(x + cw), int(y + ch), int(nb), int(no)])

    if boxes:
        full = cv2.dilate(logo_mask, np.ones((11, 11), np.uint8))
        clean = cv2.inpaint(im[:, :, ::-1].copy(), full, 6, cv2.INPAINT_TELEA)[:, :, ::-1]
        Image.fromarray(clean).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)
        status = "cleaned"
        # evidence crop: before/after side by side around union bbox
        xs0 = min(b[0] for b in boxes); ys0 = min(b[1] for b in boxes)
        xs1 = max(b[2] for b in boxes); ys1 = max(b[3] for b in boxes)
        pad = 40
        cx0, cy0 = max(0, xs0 - pad), max(0, ys0 - pad)
        cx1, cy1 = min(w, xs1 + pad), min(h, ys1 + pad)
        before = im[cy0:cy1, cx0:cx1]
        after = clean[cy0:cy1, cx0:cx1]
        gap = np.full((before.shape[0], 12, 3), 255, np.uint8)
        sheet = np.hstack([before, gap, after])
        Image.fromarray(sheet).save(f"{CROPS}/{slug}.jpg", "JPEG", quality=88)
    else:
        status = "none"
        Image.fromarray(im).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)

    report.append({"slug": slug, "status": status, "boxes": boxes})

json.dump(report, open(REPORT, "w"), indent=1)
n = sum(1 for r in report if r["status"] == "cleaned")
print(f"total={len(report)} cleaned={n} none={len(report)-n}")
for r in report:
    if r["status"] == "cleaned":
        for b in r["boxes"]:
            print(f'  {r["slug"]}: bbox={b[:4]} blue={b[4]} orange={b[5]}')
