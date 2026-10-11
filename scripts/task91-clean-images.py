#!/usr/bin/env python3
"""Task 91 phase 2: strip the sanguni watermark from raw images with the strict
fingerprint (remove_logo_v3 logic) -> task91-img-clean/<slug>.jpg (<=1600px).
"""
import json, os
import numpy as np
from PIL import Image
import cv2

BASE = "/home/z/my-project/scripts"
RAW = f"{BASE}/task91-img-raw"
CLEAN = f"{BASE}/task91-img-clean"
os.makedirs(CLEAN, exist_ok=True)

BLUE = np.array([17, 97, 159])
ORANGE = np.array([243, 164, 46])
BASE_AREA = 1225.0 * 1400.0
LOGO_W, LOGO_H = 133.0, 159.0


def strip_watermark(im):
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
        x, y, cw, ch, _a = stats[i]
        comp = labels == i
        nb = int((comp & mblue).sum())
        no = int((comp & morange).sum())
        # Task 91 recalibration: 2026 watermarks are ~2x bolder than the 2025
        # template (nb/no ~13.5k each at s~1.83) — count cap raised 7000*s -> 40000*s.
        # Balance (both colors present) + dims fingerprint still required: on every
        # probe, product-pixel components were single-color (no=0).
        if not (1500 * s <= min(nb, no) and max(nb, no) <= 40000 * s):
            continue
        if not (0.4 <= nb / max(1, no) <= 2.5):
            continue
        dw, dh = cw / exp_w, ch / exp_h
        if not (0.70 <= dw <= 1.40 and 0.70 <= dh <= 1.40):
            continue
        ar = cw / max(1, ch)
        if not (0.60 <= ar <= 1.30):
            continue
        accepted.append([int(x), int(y), int(x + cw), int(y + ch)])
    if not accepted:
        return im, False
    mask = np.zeros((h, w), np.uint8)
    for x0, y0, x1, y1 in accepted:
        # bottom pad 90px: the blue-only tip below the main blob extends ~70px
        mask[max(0, y0 - 16): min(h, y1 + 90), max(0, x0 - 16): min(w, x1 + 16)] = 255
    clean = cv2.inpaint(im[:, :, ::-1].copy(), mask, 6, cv2.INPAINT_TELEA)[:, :, ::-1]
    return clean, True


def main():
    payload = json.load(open(f"{BASE}/task91-payload.json"))
    done = 0
    for it in payload:
        src = f"{RAW}/{it['slug']}{it['ext']}"
        dst = f"{CLEAN}/{it['slug']}.jpg"
        if not os.path.exists(src):
            print(f"  {it['slug']}: RAW MISSING")
            continue
        if os.path.exists(dst) and os.path.getsize(dst) > 3000:
            done += 1
            continue
        im = Image.open(src).convert("RGB")
        arr, cleaned = strip_watermark(np.array(im))
        out = Image.fromarray(arr)
        if out.width > 1600:
            out = out.resize((1600, round(out.height * 1600 / out.width)), Image.LANCZOS)
        out.save(dst, "JPEG", quality=85, optimize=True)
        if os.path.getsize(dst) > 4.5 * 1024 * 1024:
            out.save(dst, "JPEG", quality=70, optimize=True)
        done += 1
        print(f"  {it['slug']}: {out.size} {os.path.getsize(dst)//1024}KB wm={'removed' if cleaned else 'none'}")
    print(f"clean: {done}/{len(payload)}")
    missing = [it["slug"] for it in payload if not os.path.exists(f"{CLEAN}/{it['slug']}.jpg")]
    if missing:
        print("MISSING:", missing)


if __name__ == "__main__":
    main()
