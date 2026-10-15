"""Make the small HEIC test files in tests/heic/ (needs Pillow and pillow-heif).

Usage: python3 scripts/make_heic_samples.py [out_dir]

  iphone.heic     4032x3024 in 512 px tiles with a 320 px thumbnail and Exif
                  (Apple iPhone 13, taken 2023:07:14 18:22:05): laid out like an iPhone photo
  plain.heic      2016x1512, no Exif, under 20 KB: a full-size picture that must be kept
  thumb.heic      320x240, no Exif: a preview copy

These are encoded by libheif (x265), not by an iPhone. They follow the same structure
(grid of tiles, thumbnail item, Exif item located through iloc), but are not real camera files.
"""
import os
import random
import sys

import pillow_heif
from PIL import Image, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "tests/heic"
os.makedirs(out, exist_ok=True)
pillow_heif.register_heif_opener()
random.seed(7)


def photo(w, h):
    small = Image.effect_noise((max(4, w // 64), max(4, h // 64)), 90).convert("L")
    base = Image.merge("RGB", [small.point(lambda v, t=t: (v + t) // 2) for t in (60, 140, 200)])
    return base.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(4))


def save(img, name, **kw):
    path = os.path.join(out, name)
    img.save(path, **kw)
    print(f"{path}: {os.path.getsize(path)} bytes")


exif = Image.Exif()
exif[0x010F] = "Apple"
exif[0x0110] = "iPhone 13"
exif[0x0132] = "2023:07:14 18:22:05"
exif.get_ifd(0x8769)[0x9003] = "2023:07:14 18:22:05"

pillow_heif.options.GRID_TILE_SIZE = 512
save(photo(4032, 3024), "iphone.heic", quality=5, exif=exif.tobytes(), thumbnails=[320])
pillow_heif.options.GRID_TILE_SIZE = 0
save(photo(2016, 1512), "plain.heic", quality=10, thumbnails=[])
save(photo(320, 240), "thumb.heic", quality=40, thumbnails=[])
