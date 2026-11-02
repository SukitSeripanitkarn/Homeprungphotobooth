#!/usr/bin/env python3
"""Optimise frame PNGs for the web (optional; the app also accepts raw files).

Usage:  python3 scripts/prepare-frames.py SRC.png OUT_ID [SRC2.png OUT_ID2 ...]

Use a source of at least 2560 x 2560 px (render vector artwork straight to that
size, e.g. `pdftocairo -png -transp -scale-to 2560 -singlefile -f N -l N sticker.ai fN`).
For each source frame this writes
  public/frames/<OUT_ID>.png         1280 px: students' stickers (≤ 1200 px) and previews
  public/frames/hd/<OUT_ID>.png      2560 px: admin batch stickers up to 10.4 cm at 600 DPI
  public/frames/thumbs/<OUT_ID>.png  160 px thumbnail for the picker
(center-cropped to square). Add "hd": "hd/<OUT_ID>.png" to the frame's line
in frames.json so the admin editor uses the HD file.
Requires Pillow (pip install pillow).
"""
import sys
from pathlib import Path
from PIL import Image

SIZES = (("", 1280), ("hd", 2560), ("thumbs", 160))
root = Path(__file__).resolve().parent.parent / "public" / "frames"

args = sys.argv[1:]
if not args or len(args) % 2:
    sys.exit(__doc__)

for sub, _ in SIZES:
    (root / sub).mkdir(parents=True, exist_ok=True)

for src, out_id in zip(args[::2], args[1::2]):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    s = min(w, h)
    if s < 2560:
        print(f"warning: {src} is {s}px; the HD frame will be upscaled", file=sys.stderr)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    for sub, size in SIZES:
        # Frames are flat graphics, so a 256-colour palette keeps them sharp at a fraction of the size.
        small = im if size == s else im.resize((size, size), Image.LANCZOS)
        small.quantize(256, method=Image.Quantize.FASTOCTREE).save(root / sub / f"{out_id}.png", optimize=True)
    print(f"{src} -> frames/{out_id}.png, hd/{out_id}.png, thumbs/{out_id}.png")
