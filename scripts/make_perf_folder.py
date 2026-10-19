"""Build a big, realistic PhotoRec-style folder for browser speed and memory tests (T27).

Usage: python3 scripts/make_perf_folder.py <out_dir> [--files 40000] [--big 900] [--heic 250]

Writes recup_dir.1, recup_dir.2, ... (500 files each, f<number>.<ext> names) and
<out_dir>/../perf-labels.json (relative path -> expected group). Default mix, ~5.6 GB:
  --big full-size 12 MP camera JPEGs (3-5 MB, each with its own date and size),
  --heic 12 MP iPhone HEICs (~2 MB), 1,500 shared/WhatsApp-size photos (~250 KB),
  150 videos (1-6 MB), ~5% exact copies of photos, ~300 cut-off photos, 0-byte files,
  ~5,500 app/system files, and the rest (~31,000) gallery thumbnails and icons.
Pixels come from a small pool of encoded pictures; each file gets its own Exif date and a
comment block of random length, so files differ in bytes and (mostly) in size, as real
photos do. Needs Pillow, and pillow-heif for the HEIC part. Delete the folder after use.
"""
import io
import json
import os
import pickle
import random
import shutil
import struct
import sys
from multiprocessing import Pool

from PIL import Image

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

args = sys.argv[1:]
out = args[0]
opt = lambda k, d: int(args[args.index(k) + 1]) if k in args else d
FILES, BIG, HEIC = opt("--files", 40000), opt("--big", 900), opt("--heic", 250)
rng = random.Random(27)
CAMERAS = [("Apple", "iPhone 12"), ("samsung", "SM-G991B"), ("Google", "Pixel 7"), ("Canon", "Canon EOS 250D")]


def picture(w, h, seed):
    r = random.Random(seed)
    small = Image.effect_noise((max(8, w // 24), max(8, h // 24)), 80).convert("L")
    tint = [r.randint(40, 220) for _ in range(3)]
    base = Image.merge("RGB", [small.point(lambda v, t=t: (v + t) // 2) for t in tint]).resize((w, h), Image.BICUBIC)
    return Image.blend(base, Image.effect_noise((w, h), 40).convert("RGB"), 0.18)


def jpeg_body(job):
    w, h, q, seed = job
    b = io.BytesIO()
    picture(w, h, seed).save(b, "JPEG", quality=q)
    return b.getvalue()


def heic_body(seed):
    b = io.BytesIO()
    ex = Image.Exif()
    ex[0x010F], ex[0x0110] = "Apple", "iPhone 13"
    ex[0x0132] = "2022:01:01 12:00:00"
    ex.get_ifd(0x8769)[0x9003] = "2022:01:01 12:00:00"
    picture(4032, 3024, seed).save(b, "HEIF", quality=45, exif=ex.tobytes())
    return b.getvalue()


def rand_date():
    return f"{rng.randint(2015, 2024)}:{rng.randint(1, 12):02d}:{rng.randint(1, 28):02d} {rng.randint(7, 21):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}"


def pad_bytes(seed, n):
    return bytes(b % 95 + 0x20 for b in random.Random(seed).randbytes(n))


def with_meta(body, date=None, camera=None, pad=0, seed=0):
    """SOI + Exif (date, camera) + comment of `pad` bytes + the rest of the encoded picture."""
    seg = b""
    if date or camera:
        ex = Image.Exif()
        if camera:
            ex[0x010F], ex[0x0110] = camera
        if date:
            ex[0x0132] = date
            ex.get_ifd(0x8769)[0x9003] = date
        data = ex.tobytes()
        seg += b"\xff\xe1" + struct.pack(">H", len(data) + 2) + data
    if pad:
        com = pad_bytes(seed, min(pad, 65000))
        seg += b"\xff\xfe" + struct.pack(">H", len(com) + 2) + com
    return body[:2] + seg + body[2:]


def heic_variant(body, date, pad):
    """Same picture, its own date (same-length text swap) and a trailing 'free' box of `pad` bytes."""
    d = body.replace(b"2022:01:01 12:00:00", date.encode())
    return d + struct.pack(">I", pad + 8) + b"free" + bytes(pad)


def box(kind, body):
    return (len(body) + 8).to_bytes(4, "big") + kind + body


def video_bytes(size, seed):
    """A whole video: ftyp, mdat (random frames) and a moov with an mvhd (no date, 42 s long).
    Without a moov (or with a box running past the end) a video is set aside as cut off."""
    head = (24).to_bytes(4, "big") + b"ftypisom\x00\x00\x02\x00isomiso2"
    mvhd = box(b"mvhd", bytes(12) + (600).to_bytes(4, "big") + (600 * 42).to_bytes(4, "big") + bytes(80))
    return head + box(b"mdat", random.Random(seed).randbytes(size)) + box(b"moov", mvhd)


# Pools of encoded pictures (the slow part) are cached next to the output folder.
cache = os.path.join(os.path.dirname(os.path.abspath(out)), f".perf-pools-v2-{HEIC > 0 and pillow_heif is not None}.pkl")
if os.path.exists(cache):
    big_pool, mid_pool, thumb_pool, heic_pool, icons = pickle.load(open(cache, "rb"))
else:
    with Pool(os.cpu_count()) as pool:
        print("encoding picture pools (a few minutes, cached afterwards)...", flush=True)
        big_pool = pool.map(jpeg_body, [(rng.choice([4032, 4000]), 3024 if i % 3 else 3000, rng.choice([88, 90, 92]), i) for i in range(40)])
        mid_pool = pool.map(jpeg_body, [(1600, 1200, 80, 100 + i) for i in range(60)])
        thumb_pool = pool.map(jpeg_body, [(rng.choice([160, 256, 320]), rng.choice([120, 192, 240]), 70, 1000 + i) for i in range(400)])
        heic_pool = pool.map(heic_body, range(20)) if pillow_heif and HEIC else []
    icons = []
    for i in range(200):
        b = io.BytesIO()
        picture(rng.choice([48, 64, 96]), rng.choice([48, 64, 96]), 5000 + i).save(b, "PNG")
        icons.append(b.getvalue())
    pickle.dump((big_pool, mid_pool, thumb_pool, heic_pool, icons), open(cache, "wb"))

# A recipe per file (bytes are made only when written, so memory stays small).
make = {
    "big": lambda p, date, cam, pad, seed: with_meta(big_pool[p], date, cam, pad, seed),
    "mid": lambda p, date, pad, seed: with_meta(mid_pool[p], date, None, pad, seed),
    "heic": lambda p, date, pad: heic_variant(heic_pool[p], date, pad),
    "video": lambda size, seed: video_bytes(size, seed),
    "cut": lambda p, frac: (lambda d: d[: int(len(d) * frac)])((mid_pool + big_pool[:5])[p]),
    "empty": lambda: b"",
    "text": lambda seed, n: (("log line %d\n" % seed) * n).encode(),
    "sqlite": lambda seed, n: b"SQLite format 3\x00" + random.Random(seed).randbytes(n),
    "xml": lambda seed: b'<?xml version="1.0"?><cfg>' + random.Random(seed).randbytes(100).hex().encode() + b"</cfg>",
    "gz": lambda seed, n: b"\x1f\x8b\x08\x00" + random.Random(seed).randbytes(n),
    "thumb": lambda p, pad, seed: with_meta(thumb_pool[p], None, None, pad, seed),
    "icon": lambda p: icons[p],
}
items = []  # (ext, recipe, label)
keepers = []
seed = iter(range(10**9))
for _ in range(BIG):
    r = ("big", rng.randrange(len(big_pool)), rand_date(), rng.choice(CAMERAS), rng.randint(0, 60000), next(seed))
    keepers.append(("jpg", r)); items.append(("jpg", r, "keep"))
for _ in range(1500):
    r = ("mid", rng.randrange(len(mid_pool)), rand_date() if rng.random() < 0.6 else None, rng.randint(0, 20000), next(seed))
    keepers.append(("jpg", r)); items.append(("jpg", r, "keep"))
for _ in range(HEIC if heic_pool else 0):
    r = ("heic", rng.randrange(len(heic_pool)), rand_date(), rng.randint(0, 50000))
    keepers.append(("heic", r)); items.append(("heic", r, "keep"))
for _ in range(150):
    items.append(("mp4", ("video", rng.randint(1_000_000, 6_000_000), next(seed)), "keep"))
for _ in range(int(len(keepers) * 0.05)):
    ext, r = rng.choice(keepers)
    items.append((ext, r, "duplicate"))
for _ in range(300):
    items.append(("jpg", ("cut", rng.randrange(len(mid_pool) + 5), rng.uniform(0.2, 0.8)), "damaged"))
for _ in range(30):
    items.append(("jpg", ("empty",), "damaged"))
for _ in range(5500):
    k = rng.random()
    if k < 0.5: items.append(("txt", ("text", next(seed), rng.randint(5, 300)), "system"))
    elif k < 0.7: items.append(("sqlite", ("sqlite", next(seed), rng.randint(4_000, 40_000)), "system"))
    elif k < 0.85: items.append(("xml", ("xml", next(seed)), "system"))
    else: items.append(("gz", ("gz", next(seed), rng.randint(1_000, 20_000)), "system"))
while len(items) < FILES:
    if rng.random() < 0.8:
        items.append(("jpg", ("thumb", rng.randrange(len(thumb_pool)), rng.randint(0, 3000), next(seed)), "small"))
    else:
        items.append(("png", ("icon", rng.randrange(len(icons))), "small"))
rng.shuffle(items)

# The first of identical recipes is the one kept; the rest are copies.
seen, fixed = set(), []
for ext, r, label in items:
    if label in ("keep", "duplicate"):
        label = "duplicate" if r in seen else "keep"
        seen.add(r)
    fixed.append((ext, r, label))

if os.path.exists(out):
    shutil.rmtree(out)
labels, no, total = {}, 1_000_000, 0
for i, (ext, r, label) in enumerate(fixed):
    d = make[r[0]](*r[1:])
    folder = f"recup_dir.{i // 500 + 1}"
    os.makedirs(os.path.join(out, folder), exist_ok=True)
    no += rng.randint(8, 4000)
    rel = f"{folder}/f{no:07d}.{ext}"
    with open(os.path.join(out, rel), "wb") as f:
        f.write(d)
    labels[rel] = label
    total += len(d)
json.dump(labels, open(os.path.join(os.path.dirname(os.path.abspath(out)), "perf-labels.json"), "w"))
counts = {}
for v in labels.values():
    counts[v] = counts.get(v, 0) + 1
print(f"wrote {len(labels)} files, {total / 1e9:.2f} GB to {out}: {counts}")
