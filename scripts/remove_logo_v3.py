#!/usr/bin/env python3
"""Task 54 v3: STRICT Sanguni watermark removal.
The watermark is a fixed-size template: ~133x159 px at base scale
(1225x1400), aspect ~0.84, balanced blue/orange (~4000 px each).
Accept ONLY boxes matching that fingerprint (dims 0.8-1.25x expected,
aspect 0.70-1.05, counts 2000-7000 x scale, balance 0.5-2.0).
Everything else is copied through UNTOUCHED.
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
BASE_AREA = 1225.0 * 1400.0
LOGO_W, LOGO_H = 133.0, 159.0

report = []
for path in sorted(glob.glob(f"{SRC}/*.jpg")):
    slug = os.path.basename(path)[:-4]
    im = np.array(Image.open(path).convert("RGB"))
    h, w = im.shape[:2]
    s = np.sqrt((w * h) / BASE_AREA)
    exp_w, exp_h = LOGO_W * s, LOGO_H * s

    mblue = np.abs(im.astype(int) - BLUE).sum(axis=2) <= 170
    morange = np.abs(im.astype(int) - ORANGE).sum(axis=2) <= 170
    combined = ((mblue | morange).astype(np.uint8)) * 255
    combined = cv2.dilate(combined, np.ones((7, 7), np.uint8))
    ncomp, labels, stats, _ = cv2.connectedComponentsWithStats(combined, 8)

    accepted = []
    for i in range(1, ncomp):
        x, y, cw, ch, _area = stats[i]
        comp = labels == i
        nb = int((comp & mblue).sum())
        no = int((comp & morange).sum())
        dw, dh = cw / exp_w, ch / exp_h
        ar = cw / max(1, ch)
        if not (0.80 <= dw <= 1.25 and 0.80 <= dh <= 1.25):
            continue
        if not (0.70 <= ar <= 1.05):
            continue
        if not (2000 * s <= min(nb, no) and max(nb, no) <= 7000 * s):
            continue
        if not (0.5 <= nb / max(1, no) <= 2.0):
            continue
        accepted.append([int(x), int(y), int(x + cw), int(y + ch), nb, no])

    if accepted:
        full = np.zeros((h, w), np.uint8)
        for x0, y0, x1, y1, _, _ in accepted:
            # solid-rect mask. The watermark's soft anti-aliased bottom tip
            # extends ~35px BELOW the tight color-threshold bbox (it forms a
            # separate small component that the strict rules reject) — so pad
            # bottom by 52px to swallow it, 14px elsewhere. Verified: tip ends
            # y1+34, background below is pure white (dist ~490 from logo blue).
            full[max(0, y0 - 14):min(h, y1 + 52), max(0, x0 - 14):min(w, x1 + 14)] = 255
        clean = cv2.inpaint(im[:, :, ::-1].copy(), full, 6, cv2.INPAINT_TELEA)[:, :, ::-1]
        Image.fromarray(clean).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)
        # evidence crop before|after
        xs0 = min(b[0] for b in accepted); ys0 = min(b[1] for b in accepted)
        xs1 = max(b[2] for b in accepted); ys1 = max(b[3] for b in accepted)
        pad = 45
        cx0, cy0 = max(0, xs0 - pad), max(0, ys0 - pad)
        cx1, cy1 = min(w, xs1 + pad), min(h, ys1 + pad)
        before, after = im[cy0:cy1, cx0:cx1], clean[cy0:cy1, cx0:cx1]
        gap = np.full((before.shape[0], 12, 3), 255, np.uint8)
        Image.fromarray(np.hstack([before, gap, after])).save(f"{CROPS}/{slug}.jpg", "JPEG", quality=88)
        status = "cleaned"
    else:
        Image.fromarray(im).save(f"{DST}/{slug}.jpg", "JPEG", quality=85, optimize=True)
        status = "none"
    report.append({"slug": slug, "status": status, "boxes": accepted})

json.dump(report, open(REPORT, "w"), indent=1)
n = sum(1 for r in report if r["status"] == "cleaned")
print(f"total={len(report)} cleaned={n} untouched={len(report)-n}")
for r in report:
    if r["status"] == "cleaned":
        print(f'  {r["slug"]}: {r["boxes"]}')
