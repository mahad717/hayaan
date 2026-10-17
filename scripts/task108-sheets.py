#!/usr/bin/env python3
"""Build labeled contact sheets (4 cols) from the 1fps frames with timestamps."""
import glob, subprocess, os

frames = sorted(glob.glob("/home/z/my-project/scripts/a18-108-frames/f_*.png"))
OUT = "/home/z/my-project/scripts/a18-108-frames"
COLS, CW, CH = 4, 366, 860
per = 12  # 12 frames per sheet => 4x3
for s in range(0, len(frames), per):
    group = frames[s:s+per]
    n = len(group)
    rows = (n + COLS - 1) // COLS
    inputs, labels, lay = [], [], []
    for i, f in enumerate(group):
        inputs += ["-i", f]
        ts = int(os.path.basename(f)[2:4]) - 1  # f_01 => t=0s
        # labeled: drawtext needs font; instead pad top strip is fine without text,
        # we rely on order; add timestamp via drawtext with default font if avail
        labels.append(f"[{i}:v]scale=360:-1,pad=360:{CH-40}:0:40:0xfaf8f1,drawtext=text='{ts}s':x=8:y=8:fontsize=28:fontcolor=black[l{i}]")
    fc = ";".join(labels)
    layout = "|".join(f"{(i%COLS)*CW}_{(i//COLS)*CH}" for i in range(n))
    fc += f";{''.join(f'[l{i}]' for i in range(n))}xstack=inputs={n}:layout={layout}"
    out = f"{OUT}/sheet{s//per+1}.png"
    r = subprocess.run(["ffmpeg","-v","error","-y",*inputs,"-filter_complex",fc,out],capture_output=True,text=True)
    print(out, "rc:", r.returncode, r.stderr[:200])
