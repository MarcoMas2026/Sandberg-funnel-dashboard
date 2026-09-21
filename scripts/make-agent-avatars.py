#!/usr/bin/env python3
"""Head-and-shoulders square crops of public/team/*.jpg -> public/team-avatars/*.jpg.

The team photos are full-body; the Live Grid shows agents in a small circle, so each
gets a square crop from the top of the head to the shoulders. FACES holds a hand-tuned
(face centre x, face centre y, head height) in source pixels per agent; agents not listed
fall back to a top-anchored square (full width, from y=0). Re-run after adding a photo.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "public" / "team", ROOT / "public" / "team-avatars"
FACES = {
    "angus-campbell": (75, 63, 24),
    "anne-sophie-kayrak": (100, 68, 50),
    "cecilia-schwalbach": (87, 65, 26),
    "christopher-calvin-klatt": (82, 63, 24),
    "daniel-ballmann": (81, 93, 35),
    "lauren-payet": (68, 40, 30),
    "michael-schwalbach": (71, 55, 24),
    "natalie-crossley": (54, 50, 28),
    "nathan-dilks": (80, 47, 50),
    "rebuar-georg-wentz": (78, 35, 35),
    "sabine-kersten": (98, 55, 30),
    "tim-schemann": (80, 30, 30),
}
SIDE_PER_HEAD = 2.9  # crop side as a multiple of head height
OUT.mkdir(exist_ok=True)
for f in sorted(SRC.glob("*.jpg")):
    im = Image.open(f).convert("RGB")
    w, h = im.size
    if f.stem in FACES:
        cx, cy, hh = FACES[f.stem]
        side = min(int(hh * SIDE_PER_HEAD), w, h)
        x = min(max(int(cx - side / 2), 0), w - side)
        y = min(max(int(cy - 0.45 * side), 0), h - side)
    else:
        side, x, y = w, 0, 0
    im.crop((x, y, x + side, y + side)).resize((256, 256), Image.LANCZOS).save(OUT / f.name, quality=90)
    print(f.stem, (x, y, side))
