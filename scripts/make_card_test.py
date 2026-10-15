"""Build the contents of a fake phone SD card for a real PhotoRec run.

Usage: python3 scripts/make_card_test.py <fixture_dir> <out_dir>
Copies files from the synthetic fixture into a phone-like folder layout, adds
phone-specific photos (Samsung trailer, Motion Photo), and writes truth.json
mapping each file's SHA-256 to its expected group.
"""
import hashlib
import io
import json
import os
import random
import shutil
import sys

from PIL import Image

fixture, out = sys.argv[1], sys.argv[2]
rng = random.Random(7)
labels = json.load(open(os.path.join(fixture, "..", "labels.json")))

by_note = {}
for rel, v in labels.items():
    by_note.setdefault(v["note"], []).append(rel)

if os.path.exists(out):
    shutil.rmtree(out)
truth = {}


def put(rel_out, data, label, note):
    p = os.path.join(out, rel_out)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(data)
    truth[hashlib.sha256(data).hexdigest()] = {"label": label, "note": note}


def take(note, k):
    return [open(os.path.join(fixture, r), "rb").read() for r in rng.sample(by_note[note], min(k, len(by_note[note])))]


cam = take("dated photo", 60) + take("original of a copied photo", 20)
for i, d in enumerate(cam):
    put(f"DCIM/Camera/IMG_{20230000 + i}.jpg", d, "keep", "camera photo")
for i, d in enumerate(take("undated photo, no camera info", 10)):
    put(f"Pictures/Edited/edit_{i}.jpg", d, "keep", "undated photo")
for i, d in enumerate(take("old 640x480 phone photo", 6) + take("very old 320x240 phone photo with camera info", 4)):
    put(f"DCIM/Old/DSC{i:04d}.jpg", d, "keep", "old phone photo")
for i, d in enumerate(take("phone screenshot", 8)):
    put(f"Pictures/Screenshots/Screenshot_{i}.png", d, "keep", "screenshot")
for i, d in enumerate(take("video", 6)):
    put(f"DCIM/Camera/VID_{i}.mp4", d, "keep", "video")

# Samsung photos: a trailer after the picture's end marker
for i, d in enumerate(take("dated photo", 8)):
    trailer = b"SEFH" + rng.randbytes(600) + b"SEFT"
    put(f"DCIM/Camera/SAMSUNG_{i}.jpg", d + trailer, "keep", "samsung trailer")

# Motion Photos: XMP marker near the start, an MP4 appended after the picture
xmp = b"http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta><rdf:Description Camera:MotionPhoto=\"1\" GCamera:MicroVideo=\"1\"/></x:xmpmeta>"
app1 = b"\xff\xe1" + (len(xmp) + 2).to_bytes(2, "big") + xmp
for i, d in enumerate(take("dated photo", 6)):
    mp4 = (24).to_bytes(4, "big") + b"ftypmp42" + b"\x00" * 12 + rng.randbytes(150_000)
    put(f"DCIM/Camera/PXL_MP_{i}.jpg", d[:2] + app1 + d[2:] + mp4, "keep", "motion photo")

# App caches: thumbnails and icons, plus copies of photos shared in chat apps
for i, d in enumerate(take("thumbnail", 120)):
    put(f"Android/data/com.gallery/cache/thumb_{i}.jpg", d, "small", "thumbnail")
for i, d in enumerate(take("icon", 30)):
    put(f"Android/data/com.launcher/icons/ic_{i}.png", d, "small", "icon")
for i, d in enumerate(cam[:15]):
    p = os.path.join(out, f"WhatsApp/Media/IMG-WA{i:04d}.jpg")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(d)  # exact copy: one of the two should be set aside as a copy

# iPhone photos (only when the fixture was made with pillow-heif)
if "dated iPhone HEIC" in by_note:
    for i, d in enumerate(take("dated iPhone HEIC", 12) + take("undated HEIC, no camera info", 3)):
        put(f"DCIM/100APPLE/IMG_{4000 + i}.HEIC", d, "keep", "iPhone HEIC")
    for i, d in enumerate(take("HEIC thumbnail", 10)):
        put(f"Android/data/com.gallery/cache/heic_thumb_{i}.heic", d, "small", "HEIC thumbnail")

for i, d in enumerate(take("text", 15) + take("database", 8) + take("xml", 8)):
    put(f"Android/data/com.app/files/data_{i}.bin", d, "system", "app data")

json.dump(truth, open(os.path.join(out, "..", "card-truth.json"), "w"), indent=1)
print(f"card contents: {sum(len(f) for _, _, f in os.walk(out))} files")
