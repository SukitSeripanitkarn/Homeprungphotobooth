#!/usr/bin/env python3
"""Optimise frame PNGs for the web (optional; the app also accepts raw files).

Usage:  python3 scripts/prepare-frames.py SRC.png OUT_ID [SRC2.png OUT_ID2 ...]

For each source frame this writes
  public/frames/<OUT_ID>.png         1024x1024 (center-cropped to square)
  public/frames/thumbs/<OUT_ID>.png  160x160 thumbnail for the picker
Requires Pillow (pip install pillow).
"""
import sys
from pathlib import Path
from PIL import Image

FULL, THUMB = 1024, 160
root = Path(__file__).resolve().parent.parent / "public" / "frames"
(root / "thumbs").mkdir(parents=True, exist_ok=True)

args = sys.argv[1:]
if not args or len(args) % 2:
    sys.exit(__doc__)

for src, out_id in zip(args[::2], args[1::2]):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    for size, path in ((FULL, root / f"{out_id}.png"), (THUMB, root / "thumbs" / f"{out_id}.png")):
        # Frames are flat graphics, so a 256-colour palette keeps them sharp at a fraction of the size.
        small = im.resize((size, size), Image.LANCZOS)
        small.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    print(f"{src} -> frames/{out_id}.png (+ thumb)")
