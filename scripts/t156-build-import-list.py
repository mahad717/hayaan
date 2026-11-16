#!/usr/bin/env python3
"""Task 156 — build the curated import list for Phase B.
Sources: scripts/t156/sanguni-fresh-catalog.json + changes.json
Curation:
  - ALL true microphones (owner: "also microphones"): card name matches
    mic patterns (Microphone*/Mic */Rode|RODE + mic/DJI Mic) from the
    microphone subcats, EXCLUDING stands/arms, cables, interfaces, mixers,
    speakers, phone grips, lenses.
  - genuinely-new since the Nov-1 baseline (7 in-stock items).
Name fixes: HTML entities decoded; card-title truncations fixed where the
PDP/homepage confirms the full name (Canon 2425i "Multifunctional").
Output: scripts/t156/import-list.json
"""
import json, re, html as ih
from pathlib import Path

T156 = Path("/home/z/my-project/scripts/t156")
fresh = json.load(open(T156 / "sanguni-fresh-catalog.json"))
changes = json.load(open(T156 / "changes.json"))

MIC_RE = re.compile(r"^(microphone|mic\b|mic \()|^(rode|rØde|dji mic)|mic\b.*(adapter)|wireless mic", re.I)
EXCLUDE_RE = re.compile(r"arm|cable|speaker|karaoke|caster|scarlett|focusrite|grip|lens|tripod|headphone", re.I)


def is_mic(item):
    cats = item.get("cats", [])
    if not any("/mic" in c or c.endswith("/microphone") or "microphone" in c for c in cats):
        return False
    return bool(MIC_RE.search(item["name"])) and not EXCLUDE_RE.search(item["name"])


mic_items = [(s, it) for s, it in fresh.items() if is_mic(it)]
new_slugs = {p["sanguniSlug"] for p in changes["genuinely_new"]}
new_items = [(s, fresh[s]) for s in new_slugs if s in fresh]

NAME_FIXES = {
    # card title truncates; sanguni homepage/PDP title shows the full name
    "printer-canon-image-runner-2425i-monochrome-a3-multifunc": "Printer Canon image Runner 2425i Monochrome A3 Multifunctional",
}

out = []
for s, it in sorted(mic_items + new_items, key=lambda x: x[1]["price"]):
    name = ih.unescape(re.sub(r"\s+", " ", it["name"])).strip()
    name = NAME_FIXES.get(s, name)
    m = re.search(r"\.([a-z]{3,4})$", it.get("img") or "")
    ext = (m.group(1) if m else "jpg").lower()
    if ext == "jpeg":
        ext = "jpg"
    out.append({
        "sanguniSlug": s,
        "name": name,
        "price": it["price"],
        "was_sale": bool(it.get("was_sale")),
        "oos": bool(it.get("oos")),
        "img": it.get("img", ""),
        "url": it["url"],
        "cats": it.get("cats", []),
        "imageRepoPath": f"images/products/{s}.{ext}",
        "source": "mic" if (s, it) in mic_items else "genuinely-new",
    })

json.dump(out, open(T156 / "import-list.json", "w"), indent=1, ensure_ascii=False)
mics = [p for p in out if p["source"] == "mic"]
news = [p for p in out if p["source"] == "genuinely-new"]
print(f"import list: {len(out)} ({len(mics)} microphones + {len(news)} genuinely-new)")
for p in out:
    print(f"  [{p['source'][:4]}] ${p['price']:>7.2f}  {p['name'][:58]}  img={'Y' if p['img'] else 'MISSING'}")
missing_img = [p for p in out if not p["img"]]
if missing_img:
    print("MISSING IMAGES:", [p["sanguniSlug"] for p in missing_img])
