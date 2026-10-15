"""Generate a synthetic PhotoRec-style recovery folder with an answer key.

Usage: python3 scripts/make_fixture.py [out_dir] [--scale N]

Writes recup_dir.1, recup_dir.2, ... (500 files each) with PhotoRec-style
names (f<number>.<ext>) and a labels.json mapping each relative path to the
group a perfect sorter would choose:
  keep | system | damaged | small | duplicate
"""
import io
import json
import os
import random
import shutil
import sys

from PIL import Image, ImageFilter

try:  # HEIC files (iPhone photos) are added only when pillow-heif is installed
    import pillow_heif

    pillow_heif.register_heif_opener()
    pillow_heif.options.GRID_TILE_SIZE = 512  # tiled like iPhone photos
except ImportError:
    pillow_heif = None

SEED = 42
rng = random.Random(SEED)

out_dir = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "fixtures/recovery"
scale = 1
if "--scale" in sys.argv:
    scale = int(sys.argv[sys.argv.index("--scale") + 1])

CAMERAS = [("Apple", "iPhone 11"), ("samsung", "SM-A515F"), ("Canon", "Canon EOS 200D"), ("OPPO", "CPH2083")]


def photo_bytes(w, h, date=None, camera=None, quality=85, fmt="JPEG"):
    """A photo-like image: blurred colour noise compresses like a real photo."""
    small = Image.effect_noise((max(8, w // 16), max(8, h // 16)), 90).convert("L")
    tint = tuple(rng.randint(40, 220) for _ in range(3))
    base = Image.merge("RGB", [small.point(lambda v, t=t: (v + t) // 2) for t in tint])
    img = base.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
    detail = Image.effect_noise((w, h), 18).convert("RGB")
    img = Image.blend(img, detail, 0.12)
    buf = io.BytesIO()
    if fmt in ("JPEG", "HEIF"):
        exif = Image.Exif()
        if camera:
            exif[0x010F], exif[0x0110] = camera
        if date:
            exif[0x0132] = date
            exif.get_ifd(0x8769)[0x9003] = date
        extra = {"thumbnails": [320]} if fmt == "HEIF" and min(w, h) > 400 else {}
        if camera or date:
            extra["exif"] = exif.tobytes()
        img.save(buf, fmt, quality=quality, **extra)
    else:
        img.save(buf, fmt)
    return buf.getvalue()


def rand_date(year_lo=2019, year_hi=2024):
    y = rng.randint(year_lo, year_hi)
    return f"{y}:{rng.randint(1, 12):02d}:{rng.randint(1, 28):02d} {rng.randint(7, 21):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}"


def video_bytes(brand=b"isom", size=300_000):
    head = (24).to_bytes(4, "big") + b"ftyp" + brand + b"\x00\x00\x02\x00" + b"isomiso2"
    return head + rng.randbytes(size)


items = []  # (ext, bytes, label, note)


def add(ext, data, label, note):
    items.append((ext, data, label, note))


n = scale
# Keepers: dated phone and camera photos
keepers = []
for _ in range(220 * n):
    d = photo_bytes(rng.choice([1024, 1200]), rng.choice([768, 900]), rand_date(), rng.choice(CAMERAS))
    keepers.append(d)
    add("jpg", d, "keep", "dated photo")
# Keepers that test the edges of the rules
for _ in range(30 * n):
    add("jpg", photo_bytes(1024, 768, None, None), "keep", "undated photo, no camera info")
for _ in range(15 * n):
    add("jpg", photo_bytes(640, 480, rand_date(2009, 2012), ("Nokia", "Nokia 5800")), "keep", "old 640x480 phone photo")
for _ in range(8 * n):
    add("jpg", photo_bytes(320, 240, rand_date(2006, 2008), ("SonyEricsson", "K800i")), "keep", "very old 320x240 phone photo with camera info")
for _ in range(20 * n):
    add("png", photo_bytes(540, 1170, fmt="PNG"), "keep", "phone screenshot")
for _ in range(25 * n):
    add("mp4", video_bytes(b"isom", rng.randint(200_000, 600_000)), "keep", "video")
for _ in range(5 * n):
    add("mov", video_bytes(b"qt  ", rng.randint(200_000, 600_000)), "keep", "video")

# Small previews: gallery thumbnails and app icons, no camera info
for _ in range(500 * n):
    add("jpg", photo_bytes(rng.choice([160, 256, 320]), rng.choice([120, 192, 240]), None, None, quality=70), "small", "thumbnail")
for _ in range(120 * n):
    add("png", photo_bytes(rng.choice([48, 64, 96]), rng.choice([48, 64, 96]), fmt="PNG"), "small", "icon")

# Exact duplicates of keepers
for _ in range(160 * n):
    add("jpg", rng.choice(keepers), "duplicate", "exact copy")

# Damaged: truncated JPEGs (PhotoRec carved part of the file)
for _ in range(90 * n):
    d = photo_bytes(1024, 768, rand_date(), rng.choice(CAMERAS))
    add("jpg", d[: rng.randint(len(d) // 5, len(d) * 4 // 5)], "damaged", "truncated jpeg")
for _ in range(10 * n):
    add("jpg", b"\xff\xd8\xff\xe0" + rng.randbytes(rng.randint(30_000, 90_000)), "damaged", "jpeg header, garbage body")
for _ in range(4 * n):
    add("jpg", b"", "damaged", "0-byte file")

# App and system files
for _ in range(80 * n):
    add("txt", ("log line %d\n" % rng.randint(0, 10**6) * rng.randint(5, 400)).encode(), "system", "text")
for _ in range(40 * n):
    add("xml", b'<?xml version="1.0"?><cfg>' + rng.randbytes(200).hex().encode() + b"</cfg>", "system", "xml")
for _ in range(30 * n):
    add("sqlite", b"SQLite format 3\x00" + rng.randbytes(rng.randint(4_000, 60_000)), "system", "database")
for _ in range(30 * n):
    add("gz", b"\x1f\x8b\x08\x00" + rng.randbytes(rng.randint(2_000, 40_000)), "system", "archive")
for _ in range(20 * n):
    add("html", b"<!doctype html><html><body>cache</body></html>", "system", "web cache")

# iPhone-style HEIC photos (needs pillow-heif): kept, previews, copies and cut-off files
if pillow_heif:
    heic_keepers = []
    for _ in range(30 * n):
        w, h = rng.choice([(2016, 1512), (1512, 2016)])
        d = photo_bytes(w, h, rand_date(), ("Apple", rng.choice(["iPhone 11", "iPhone 13", "iPhone 15 Pro"])), quality=30, fmt="HEIF")
        heic_keepers.append(d)
        add("heic", d, "keep", "dated iPhone HEIC")
    for _ in range(10 * n):
        add("heic", photo_bytes(1512, 2016, None, None, quality=30, fmt="HEIF"), "keep", "undated HEIC, no camera info")
    for _ in range(40 * n):
        add("heic", photo_bytes(rng.choice([256, 320]), rng.choice([192, 240]), None, None, quality=50, fmt="HEIF"), "small", "HEIC thumbnail")
    for _ in range(8 * n):
        add("heic", rng.choice(heic_keepers), "duplicate", "exact copy")
    for _ in range(15 * n):
        d = photo_bytes(2016, 1512, rand_date(), ("Apple", "iPhone 13"), quality=30, fmt="HEIF")
        add("heic", d[: rng.randint(len(d) // 5, len(d) * 4 // 5)], "damaged", "truncated HEIC")
else:
    print("pillow-heif not installed: no HEIC files in this fixture (pip install pillow-heif)")

rng.shuffle(items)

# The first copy of any duplicated bytes is the keeper; later ones are duplicates.
seen = set()
fixed = []
for ext, data, label, note in items:
    key = (ext, data)
    if label in ("keep", "duplicate"):
        if key in seen:
            label, note = "duplicate", "exact copy"
        else:
            label = "keep" if label == "duplicate" else label
            note = "original of a copied photo" if note == "exact copy" else note
            seen.add(key)
    fixed.append((ext, data, label, note))

if os.path.exists(out_dir):
    shutil.rmtree(out_dir)
labels = {}
file_no = rng.randint(1_000_000, 2_000_000)
for i, (ext, data, label, note) in enumerate(fixed):
    folder = f"recup_dir.{i // 500 + 1}"
    os.makedirs(os.path.join(out_dir, folder), exist_ok=True)
    file_no += rng.randint(8, 4_000)
    rel = f"{folder}/f{file_no}.{ext}"
    with open(os.path.join(out_dir, rel), "wb") as f:
        f.write(data)
    labels[rel] = {"label": label, "note": note}

with open(os.path.join(out_dir, "..", "labels.json"), "w") as f:
    json.dump(labels, f, indent=1)

counts = {}
for v in labels.values():
    counts[v["label"]] = counts.get(v["label"], 0) + 1
print(f"wrote {len(labels)} files to {out_dir}: {counts}")
