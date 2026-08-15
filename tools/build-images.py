#!/usr/bin/env python3
"""Turn the client's product shots into web-ready WebP.

The originals land in assets/images/Kay_Fashion/<Folder>/ChatGPT Image ....png —
2-3 MB PNGs with timestamp names, in folders that describe the shoot rather than
the garment. This script renames them to the product handle, orders the frames so
the full-length front view leads, and writes WebP at the two sizes the site asks
for: 1000px for the product page and lightbox, 520px for the card grids.

Rerunnable — it always rebuilds from the untouched originals.

    python tools/build-images.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/images/Kay_Fashion"
OUT = ROOT / "assets/images/products"

FULL_W, FULL_Q = 1000, 82
THUMB_W, THUMB_Q = 520, 80

# handle -> (source folder, [frames in display order])
# Frame order matters: shot 1 becomes the card image and the PDP hero, so every
# garment leads with the full-length front view and keeps detail crops last.
SETS = {
    "bridal-lehenga-rust-zari": ("bridal_collection", [
        "11_05_37",  # full length, front
        "11_07_39",  # three-quarter
        "11_07_44",  # skirt spread
        "11_11_31",  # back
        "11_07_09",  # latkan / dupatta detail
        "11_27_37",  # neckline portrait
    ]),
    "bridal-lehenga-champagne-thread": ("Gold", [
        "06_16_58",  # full length, front
        "06_17_09",  # front with dupatta draped
        "06_17_20",  # twirl
        "06_17_12",  # back
        "06_17_14",  # seated
        "06_17_05",  # skirt thread-work detail
    ]),
    "lehenga-royal-blue-zari": ("Lehanga", [
        "05_17_17",  # full length, front
        "05_48_16",  # front, dupatta over shoulder
        "05_48_11",  # three-quarter
        "05_48_23",  # twirl
        "05_48_14",  # back
        "05_48_27",  # bodice and border detail
    ]),
    "gown-navy-sequin-cape": ("Navy_Blue", [
        "09_17_27",  # full length, front
        "09_29_54",  # full length under the chandelier
        "09_17_30",  # in movement
        "09_17_34",  # back
        "09_17_23",  # fishtail hem detail
        "09_17_19",  # sleeve embroidery detail
    ]),
    "saree-kanchipuram-royal-blue": ("Saree", [
        "06_55_32",  # full length, front
        "06_55_35",  # front, pallu forward
        "06_58_06",  # seated
        "06_55_40",  # back, pallu fall
        "07_06_17",  # border and blouse detail
    ]),
}


def find(folder: Path, stamp: str) -> Path:
    hits = [p for p in folder.glob("*.png") if stamp in p.name]
    if len(hits) != 1:
        sys.exit(f"expected exactly one file matching {stamp} in {folder}, got {len(hits)}")
    return hits[0]


def convert(src: Path, dst: Path, width: int, quality: int) -> None:
    subprocess.run(
        ["magick", str(src), "-auto-orient", "-resize", f"{width}x>",
         "-strip", "-quality", str(quality), "-define", "webp:method=6", str(dst)],
        check=True,
    )


def main() -> None:
    if not SRC.is_dir():
        sys.exit(f"missing source directory: {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)

    src_bytes = out_bytes = 0
    made = 0

    for handle, (folder, stamps) in SETS.items():
        d = SRC / folder
        for i, stamp in enumerate(stamps, start=1):
            s = find(d, stamp)
            full = OUT / f"{handle}-{i:02d}.webp"
            convert(s, full, FULL_W, FULL_Q)
            src_bytes += s.stat().st_size
            out_bytes += full.stat().st_size
            made += 1
            # Only frame 1 is ever shown in a card grid, so that is the only
            # frame that needs a small rendition.
            if i == 1:
                thumb = OUT / f"{handle}-01-sm.webp"
                convert(s, thumb, THUMB_W, THUMB_Q)
                out_bytes += thumb.stat().st_size
                made += 1
        print(f"  {handle}: {len(stamps)} frames")

    mb = lambda b: b / 1_000_000
    print(f"\n{made} files written to {OUT.relative_to(ROOT)}")
    print(f"source {mb(src_bytes):.1f} MB  ->  webp {mb(out_bytes):.1f} MB "
          f"({100 - out_bytes / src_bytes * 100:.1f}% smaller)")


if __name__ == "__main__":
    main()
