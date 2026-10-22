"""Build the usability pilot's recovery folder, "Recovered from old phone" (T65), with an answer key.

Usage:
  python3 scripts/make_pilot_folder.py [work_dir] [--photorec PATH] [--zip OUT.zip] [--mimic]

What it does (deterministic: same Pillow, pillow-heif and ffmpeg give the same files):
  1. Makes the contents of an imaginary old phone's memory card: procedural photos (skies,
     mountains, sea, city lights, fields, flowers; no people, no text) from 2019 to 2024 with
     camera details, Messenger-saved photos with no details at all, a few screenshots, short
     H.264 videos (ffmpeg), gallery thumbnails, Messenger previews, app icons, app files,
     photos saved twice, and a few files cut off by later writes.
  2. Lays them out on a raw card image (work_dir/card.img) the way a quick-formatted card
     keeps them: one after another, on 32 KB cluster boundaries, file table gone.
  3. Runs real PhotoRec on the image (photorec on PATH, or --photorec), so the folder has
     PhotoRec's own recup_dir.N folders, f<sector> names, dates and report.xml. With
     --mimic, or when PhotoRec isn't found, it writes the same layout itself instead.
  4. Writes the answer key, work_dir/pilot-key.json: the expected group of every recovered
     file and the totals the app should show.
  5. With --zip, zips the folder as OUT.zip (one folder inside: "Recovered from old phone").

Needs: Pillow, numpy, pillow-heif (iPhone photos), ffmpeg with libx264.
Check the app's engine against the key:
  PILOT_DIR="work_dir/Recovered from old phone" PILOT_KEY=work_dir/pilot-key.json \
    npx vitest run eval/pilot.eval.test.ts --silent=false
"""
import calendar
import gzip
import hashlib
import io
import json
import os
import pickle
import random
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

SEED = 2026_10_26
FOLDER = "Recovered from old phone"
CLUSTER = 32 * 1024  # SD cards are formatted FAT32/exFAT with 32 KB clusters
RECOVERED_AT = "2026-10-20 14:32:00"  # mimic mode: PhotoRec dates files it can't date with the run time

args = sys.argv[1:]
opt = lambda name: args[args.index(name) + 1] if name in args else None
pos = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--photorec", "--zip", "--cache"))]
work = os.path.abspath(pos[0] if pos else "fixtures/pilot")
zip_out = opt("--zip")
photorec = None if "--mimic" in args else (opt("--photorec") or shutil.which("photorec"))
if photorec and os.sep in photorec:
    photorec = os.path.abspath(photorec)  # PhotoRec runs from inside work_dir

rng = random.Random(SEED)
nrng = np.random.default_rng(SEED)

# --------------------------------------------------------------------------------------------
# Pictures


def lerp(a, b, t):
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


PALETTES = {  # sky top, sky at the horizon, sun colour
    "day": ((60, 120, 200), (175, 210, 240), (255, 250, 230)),
    "clear": ((30, 90, 180), (150, 195, 235), (255, 255, 240)),
    "sunset": ((70, 60, 130), (250, 150, 80), (255, 210, 120)),
    "golden": ((110, 140, 190), (250, 205, 140), (255, 230, 170)),
    "overcast": ((150, 160, 170), (205, 210, 212), (235, 235, 230)),
    "dusk": ((15, 25, 70), (120, 80, 120), (255, 190, 140)),
}


def soft_noise(h, w, cell):
    small = nrng.random((max(2, h // cell), max(2, w // cell))).astype(np.float32)
    return np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255


def ridge(w, base, amp, rough):
    x = np.arange(w)
    y = np.full(w, float(base))
    for k in range(1, 6):
        y += amp / k * np.sin(x / w * np.pi * (k * rng.uniform(0.8, 2.2) * rough) + rng.uniform(0, 6.28))
    return y


def scene(w, h, kind=None):
    """A photo-like landscape as an RGB image (no people, no text)."""
    kind = kind or rng.choice(["mountains", "lake", "beach", "city", "field", "flowers", "hills"])
    pal_name = rng.choice(["dusk", "sunset"] if kind == "city" else list(PALETTES))
    top, bottom, sun_c = PALETTES[pal_name]
    horizon = int(h * rng.uniform(0.45, 0.68))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip(yy / max(1, horizon), 0, 1)[..., None]
    img = lerp(top, bottom, t ** 1.3)
    # sun or moon with a glow
    sx, sy, sr = rng.uniform(0.15, 0.85) * w, rng.uniform(0.15, 0.7) * horizon, rng.uniform(0.025, 0.05) * w
    d2 = ((xx - sx) ** 2 + (yy - sy) ** 2) / (sr * sr)
    glow = (np.exp(-d2 / 30) * 0.45 + (d2 < 1) * 0.9)[..., None]
    if pal_name != "overcast":
        img = lerp(img, sun_c, np.clip(glow, 0, 1))
    # clouds
    c = soft_noise(h, w, rng.choice([60, 90, 140])) * 0.6 + soft_noise(h, w, 25) * 0.4
    cover = rng.uniform(0.45, 0.7) if pal_name != "clear" else 0.8
    cl = np.clip((c - cover) * 3, 0, 1) * (yy < horizon)
    cloud_c = (255, 250, 245) if pal_name in ("day", "clear", "overcast") else (250, 180, 150)
    img = lerp(img, cloud_c, cl[..., None] * 0.8)

    def fill_below(line, color, tex=0.0, fade=0.0):
        nonlocal img
        mask = (yy >= line[None, :])[..., None]
        col = lerp(color, bottom, fade)
        layer = np.broadcast_to(col, img.shape).copy()
        if tex:
            n = soft_noise(h, w, 6)[..., None]
            layer = layer * (1 - tex / 2 + tex * n)
        img = np.where(mask, layer, img)

    green = rng.choice([(70, 110, 50), (90, 130, 60), (60, 95, 55), (120, 140, 70)])
    if kind in ("mountains", "lake", "hills"):
        for i, f in enumerate([0.55, 0.35, 0.0]):
            base = horizon - (h * (0.25 - i * 0.07) if kind != "hills" else h * (0.1 - i * 0.03))
            col = lerp((70, 80, 100), green, i / 2)
            fill_below(ridge(w, base, h * (0.08 if kind != "hills" else 0.04), 1.5 + i), col, tex=0.15, fade=f)
        if kind == "lake":
            water = (yy >= horizon)[..., None]
            ripple = soft_noise(h, w, 4) * 0.25
            refl = lerp(bottom, top, np.clip((yy - horizon) / (h - horizon + 1), 0, 1)[..., None]) * (0.75 + ripple[..., None])
            img = np.where(water, refl, img)
        else:
            fill_below(np.full(w, horizon + h * 0.08) + ridge(w, 0, h * 0.02, 3), green, tex=0.35)
    elif kind == "beach":
        sea = (yy >= horizon)[..., None]
        sea_c = lerp((20, 80, 130), (60, 150, 170), np.clip((yy - horizon) / (h * 0.25), 0, 1)[..., None])
        img = np.where(sea, sea_c * (0.85 + soft_noise(h, w, 5)[..., None] * 0.3), img)
        shore = horizon + h * rng.uniform(0.15, 0.25) + ridge(w, 0, h * 0.03, 1)
        fill_below(shore, (225, 205, 165), tex=0.25)
        foam = (np.abs(yy - shore[None, :]) < h * 0.006)[..., None]
        img = np.where(foam, (240, 245, 245), img)
    elif kind == "city":
        img = img * 0.8
        x = 0
        sky_line = np.full(w, float(h))
        while x < w:
            bw = int(rng.uniform(0.04, 0.11) * w)
            sky_line[x:x + bw] = horizon - rng.uniform(0.05, 0.4) * h
            x += bw + int(rng.uniform(0, 0.01) * w)
        fill_below(sky_line, (25, 25, 40), tex=0.1)
        win = (nrng.random((h // 14 + 1, w // 10 + 1)) < 0.35)
        win = np.kron(win, np.ones((14, 10)))[:h, :w] * ((yy % 14) > 5) * ((xx % 10) > 3)
        lit = (win > 0) & (yy > sky_line[None, :] + 8) & (yy < h * 0.9)
        img = np.where(lit[..., None], (250, 210, 120), img)
        fill_below(np.full(w, h * 0.9), (35, 35, 45), tex=0.2)
    elif kind in ("field", "flowers"):
        fill_below(ridge(w, horizon - h * 0.05, h * 0.03, 1), lerp(green, bottom, 0.4), tex=0.2)
        fill_below(np.full(w, float(horizon)) + ridge(w, 0, h * 0.01, 2), green, tex=0.5)
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    if kind in ("field", "hills", "lake", "mountains"):  # trees
        for _ in range(rng.randint(2, 9)):
            tx, base = rng.uniform(0, w), horizon + rng.uniform(0, 0.25) * h
            th = rng.uniform(0.08, 0.3) * h
            dark = tuple(int(v * rng.uniform(0.35, 0.6)) for v in green)
            d.rectangle([tx - th * 0.03, base - th * 0.4, tx + th * 0.03, base], fill=(60, 45, 35))
            if rng.random() < 0.5:
                d.polygon([(tx, base - th), (tx - th * 0.25, base - th * 0.25), (tx + th * 0.25, base - th * 0.25)], fill=dark)
            else:
                d.ellipse([tx - th * 0.3, base - th, tx + th * 0.3, base - th * 0.35], fill=dark)
    if kind in ("flowers", "field"):
        n = 900 if kind == "flowers" else 250
        petal = rng.choice([(230, 60, 90), (250, 200, 60), (240, 240, 250), (180, 90, 200), (250, 130, 50)])
        for _ in range(n):
            fy = rng.uniform(horizon, h)
            r = (fy - horizon) / (h - horizon) * (0.02 if kind == "flowers" else 0.008) * w + 1
            fx = rng.uniform(0, w)
            col = tuple(min(255, int(v * rng.uniform(0.8, 1.1))) for v in petal)
            d.ellipse([fx - r, fy - r * 0.8, fx + r, fy + r * 0.8], fill=col)
    pil = pil.filter(ImageFilter.GaussianBlur(w / 1400))
    # lens vignette and sensor noise
    arr = np.asarray(pil, np.float32)
    vig = 1 - 0.28 * (((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2) * 2
    arr = arr * vig[..., None] + nrng.normal(0, 3.2, arr.shape)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def screenshot(w=1080, h=2400):
    """A phone screen: status bar, cards and buttons in flat colours (no text)."""
    bg = rng.choice([(245, 245, 247), (18, 18, 20), (250, 248, 240)])
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    fg = (40, 40, 45) if sum(bg) > 300 else (220, 220, 225)
    accent = rng.choice([(0, 132, 255), (37, 211, 102), (255, 90, 95), (130, 80, 220)])
    d.rectangle([0, 0, w, 90], fill=tuple(max(0, v - 12) for v in bg))
    d.rectangle([0, 90, w, 260], fill=accent)
    y = 300
    while y < h - 300:
        ch = rng.randint(160, 520)
        d.rounded_rectangle([40, y, w - 40, y + ch], 32, fill=tuple(min(255, v + 10) if sum(bg) < 300 else max(0, v - 8) for v in bg))
        if ch > 300:
            img.paste(scene(w - 120, ch - 120).resize((w - 120, ch - 120)), (60, y + 60))
        else:
            for k in range(rng.randint(1, 3)):
                d.rounded_rectangle([80, y + 40 + k * 50, 80 + rng.randint(300, w - 200), y + 70 + k * 50], 12, fill=fg)
        y += ch + 40
    d.rounded_rectangle([w // 2 - 160, h - 200, w // 2 + 160, h - 100], 50, fill=accent)
    return img


def icon(s):
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c1 = tuple(rng.randint(30, 230) for _ in range(3))
    d.rounded_rectangle([0, 0, s - 1, s - 1], s // 5, fill=c1 + (255,))
    c2 = tuple(255 - v for v in c1)
    m = s // 4
    if rng.random() < 0.5:
        d.ellipse([m, m, s - m, s - m], fill=c2 + (255,))
    else:
        d.polygon([(s // 2, m), (s - m, s - m), (m, s - m)], fill=c2 + (255,))
    b = io.BytesIO()
    img.save(b, "PNG")
    return b.getvalue()


CAMERAS = {  # what the family's phones were, by year
    2019: [("samsung", "SM-J730G"), ("OPPO", "CPH1823")],
    2020: [("samsung", "SM-A505F"), ("OPPO", "CPH1823")],
    2021: [("samsung", "SM-A515F"), ("Xiaomi", "Redmi Note 9")],
    2022: [("samsung", "SM-A525F"), ("Xiaomi", "Redmi Note 9")],
    2023: [("samsung", "SM-A525F"), ("Apple", "iPhone 13")],
    2024: [("samsung", "SM-A546E"), ("Apple", "iPhone 13")],
}


def jpeg(img, date=None, camera=None, quality=88):
    b = io.BytesIO()
    extra = {}
    if date or camera:
        ex = Image.Exif()
        if camera:
            ex[0x010F], ex[0x0110] = camera
            ex[0x0131] = rng.choice(["A525FXXU4CWB1", "V13.0.4", "MIUI 12"]) if camera[0] != "Apple" else "16.6"
        ex[0x0112] = 1
        if date:
            ex[0x0132] = date
            sub = ex.get_ifd(0x8769)
            sub[0x9003] = date
            sub[0x9004] = date
            sub[0xA002], sub[0xA003] = img.size
        extra["exif"] = ex.tobytes()
    img.save(b, "JPEG", quality=quality, **extra)
    return b.getvalue()


def heic(img, date, camera):
    ex = Image.Exif()
    ex[0x010F], ex[0x0110] = camera
    ex.get_ifd(0x8769)[0x9003] = date
    b = io.BytesIO()
    img.save(b, "HEIF", quality=45, exif=ex.tobytes())
    return b.getvalue()


def rand_date(year):
    m = rng.randint(1, 12)
    return f"{year}:{m:02d}:{rng.randint(1, 28):02d} {rng.randint(7, 20):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}"


TMP = tempfile.mkdtemp(prefix="pilot-")


def video(date_iso, seconds, w=1280, h=720):
    """A short phone video: a slow pan across a landscape, H.264 + AAC in MP4, moov at the end."""
    pano = os.path.join(TMP, "pano.png")
    scene(int(w * 1.6), h).save(pano)
    out = os.path.join(TMP, "v.mp4")
    cmd = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", pano,
           "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.02:seed=7:r=44100",
           "-filter_complex", f"[0:v]crop={w}:{h}:x='(iw-{w})*t/{seconds}':y=0,noise=alls=6:allf=t+u:all_seed=5,format=yuv420p[v]",
           "-map", "[v]", "-map", "1:a", "-t", str(seconds), "-c:v", "libx264", "-preset", "medium", "-crf", "27",
           "-threads", "1", "-c:a", "aac", "-b:a", "64k", "-metadata", f"creation_time={date_iso}",
           "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", out]
    subprocess.run(cmd, check=True)
    return open(out, "rb").read()


# --------------------------------------------------------------------------------------------
# What was on the card. Each item: bytes, extension, expected group, note, year (None = no date).

items = []
cache = opt("--cache")
if cache and os.path.exists(cache):
    items = pickle.load(open(cache, "rb"))
else:

    def add(data, ext, label, note, year=None, when=0.0, kind="photo"):
        items.append({"data": data, "ext": ext, "label": label, "note": note, "year": year, "when": when, "kind": kind})
        return items[-1]


    def when_of(date):  # position on the card follows the date the file was written
        y, mo, d = int(date[:4]), int(date[5:7]), int(date[8:10])
        return y + (mo - 1) / 12 + d / 365


    PER_YEAR = {2019: 22, 2020: 28, 2021: 32, 2022: 38, 2023: 34, 2024: 24}
    camera_photos = []
    for year, n in PER_YEAR.items():
        for _ in range(n):
            date = rand_date(year)
            cam = rng.choice(CAMERAS[year])
            w, h = (2016, 1512) if year >= 2021 else (1600, 1200)
            if rng.random() < 0.25:
                w, h = h, w
            img = scene(w, h)
            it = add(jpeg(img, date, cam), "jpg", "keep", "camera photo", year, when_of(date))
            it["img"] = img
            camera_photos.append(it)
    # An iPhone in the family from 2022: HEIC photos
    iphone = []
    if pillow_heif:
        for year, n in ((2022, 4), (2023, 3), (2024, 3)):
            for _ in range(n):
                date = rand_date(year)
                w, h = rng.choice([(2016, 1512), (1512, 2016)])
                img = scene(w, h)
                it = add(heic(img, date, ("Apple", "iPhone 13")), "heic", "keep", "iPhone photo (HEIC)", year, when_of(date))
                it["img"] = img
                iphone.append(it)
    else:
        print("pillow-heif not installed: no iPhone (HEIC) photos")

    # Photos saved from Messenger: resized, every detail stripped (no date, no camera)
    messenger = []
    for i in range(16):
        w, h = rng.choice([(960, 720), (720, 960), (1440, 1080), (1080, 1440), (2048, 1536)])
        img = scene(w, h)
        it = add(jpeg(img, quality=rng.choice([70, 78, 85])), "jpg", "keep", "saved from Messenger, no date", None, 2021 + i / 6)
        it["img"] = img
        messenger.append(it)
    for i in range(4):
        b = io.BytesIO()
        screenshot().save(b, "PNG")
        add(b.getvalue(), "png", "keep", "screenshot, no date", None, 2022 + i / 2)

    # Short videos (dated in their own details)
    for date_iso, secs in (("2020-12-24T19:40:00Z", 4), ("2021-06-12T10:05:00Z", 5), ("2022-04-17T08:30:00Z", 6),
                           ("2022-12-25T10:10:00Z", 4), ("2023-08-05T16:20:00Z", 5), ("2024-02-10T11:45:00Z", 4)):
        year = int(date_iso[:4])
        add(video(date_iso, secs), "mp4", "keep", "phone video", year, year + 0.6, kind="video")

    # Small preview copies: Messenger previews of photos people sent, and gallery thumbnails
    for it in messenger + rng.sample(camera_photos, 14):
        img = it["img"].copy()
        img.thumbnail((rng.choice([240, 320, 360]),) * 2)
        add(jpeg(img, quality=70), "jpg", "small", "Messenger preview", None, it["when"] + 0.01)
    for it in rng.sample(camera_photos + iphone, 150):
        img = it["img"].copy()
        img.thumbnail((256, 256))
        add(jpeg(img, quality=75), "jpg", "small", "gallery thumbnail", None, it["when"] + 0.02)
    for _ in range(24):
        add(icon(rng.choice([96, 144, 192])), "png", "small", "app icon", None, rng.uniform(2019, 2025))

    # Exact copies: photos saved twice (sent back and forth, or saved again)
    for it in rng.sample(camera_photos, 18) + rng.sample(messenger, 4):
        dup = add(it["data"], it["ext"], "duplicate", "exact copy of a kept photo", it["year"], it["when"] + rng.uniform(0.05, 0.5))
        dup["original_note"] = it["note"]
        it["original_note"] = it["note"]

    # Cut off: later writes landed on top of the rest of the file. PhotoRec 7.1 with its default
    # options throws away photos that stop early (it checks them), so these cut-off photos are on
    # the card but not in the folder; cut-off videos come through and land in "Damaged".
    for _ in range(4):
        year = rng.choice(list(PER_YEAR))
        date = rand_date(year)
        d = jpeg(scene(2016, 1512), date, rng.choice(CAMERAS[year]))
        add(d[: int(len(d) * rng.uniform(0.3, 0.7))], "jpg", "damaged", "cut-off photo (PhotoRec drops it)", None, when_of(date))
    for date_iso, secs, keep in (("2021-09-18T15:00:00Z", 5, 0.5), ("2023-03-03T09:00:00Z", 6, 0.4), ("2024-05-25T18:30:00Z", 5, 0.7)):
        v = video(date_iso, secs)
        add(v[: int(len(v) * keep)], "mp4", "damaged", "cut-off video", None, int(date_iso[:4]) + 0.7, kind="video")

    # App and system files
    for i in range(26):
        log = "".join(f"2023-0{rng.randint(1, 9)}-1{rng.randint(0, 9)} 0{rng.randint(0, 9)}:{rng.randint(10, 59)}:{rng.randint(10, 59)} I/{rng.choice(['ActivityManager', 'GCM', 'WifiService', 'SyncManager'])}: event {rng.randint(0, 99999)} ok\n" for _ in range(rng.randint(30, 600)))
        add(log.encode(), "txt", "system", "app log", None, rng.uniform(2019, 2025))
    for i in range(40):
        xml = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n' + "".join(f'    <string name="pref_{k}">{rng.getrandbits(64):x}</string>\n' for k in range(rng.randint(5, 80))) + "</map>\n"
        add(xml.encode(), "xml", "system", "app settings", None, rng.uniform(2019, 2025))
    for i in range(8):
        html = "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>cache</title></head><body>" + "<div class=\"c\">&nbsp;</div>" * rng.randint(20, 400) + "</body></html>\n"
        add(html.encode(), "html", "system", "web cache", None, rng.uniform(2019, 2025))
    for i in range(16):
        p = os.path.join(TMP, f"db{i}.sqlite")
        con = sqlite3.connect(p)
        con.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
        con.executemany("INSERT INTO t (v) VALUES (?)", [(f"{rng.getrandbits(128):x}",) for _ in range(rng.randint(50, 3000))])
        con.commit()
        con.close()
        add(open(p, "rb").read(), "sqlite", "system", "app database", None, rng.uniform(2019, 2025))
    for i in range(5):
        body = "".join(f"crash {rng.randint(0, 9999)} at 0x{rng.getrandbits(32):08x}\n" for _ in range(rng.randint(200, 2000))).encode()
        add(gzip.compress(body, mtime=0), "gz", "system", "compressed log", None, rng.uniform(2019, 2025))

    shutil.rmtree(TMP)
    for it in items:
        it.pop("img", None)
    # Card order: roughly the order things were written, which is how a card fills up
    rng.shuffle(items)
    items.sort(key=lambda it: it["when"])
    if cache:
        pickle.dump(items, open(cache, "wb"))

# --------------------------------------------------------------------------------------------
# The card image: files on cluster boundaries after a zeroed file-table area (quick format)

if os.path.exists(work):
    shutil.rmtree(work)
os.makedirs(work)
card = os.path.join(work, "card.img")
START = 8 * 1024 * 1024
with open(card, "wb") as f:
    at = START
    for it in items:
        it["offset"] = at
        f.seek(at)
        f.write(it["data"])
        at += -(-max(1, len(it["data"])) // CLUSTER) * CLUSTER
    f.truncate(at + 4 * 1024 * 1024)
by_offset = {it["offset"]: it for it in items}
by_hash = {}
for it in items:
    by_hash.setdefault(hashlib.sha256(it["data"]).hexdigest(), it)

out = os.path.join(work, FOLDER)
os.makedirs(out)
if photorec:
    # relative paths, so PhotoRec's report.xml names "card.img", not this computer's folders
    subprocess.run([photorec, "/log", "/d", os.path.join(FOLDER, "recup_dir"), "/cmd", "card.img",
                    "partition_none,wholespace,search"],  # default options, as the team's PhotoRec guide says
                   check=True, stdout=subprocess.DEVNULL, cwd=work)
    if not os.listdir(out):
        sys.exit(f"PhotoRec recovered nothing; see {work}/photorec.log")
    made_by = "PhotoRec " + subprocess.run([photorec, "/version"], capture_output=True, text=True).stdout.split("\n")[0].split(",")[0].split()[-1]
else:
    made_by = "mimic (PhotoRec not found)"
    kept = [it for it in items if "PhotoRec drops it" not in it["note"]]
    for i, it in enumerate(kept):
        d = os.path.join(out, f"recup_dir.{i // 500 + 1}")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f"f{it['offset'] // 512:07d}.{it['ext']}")
        open(p, "wb").write(it["data"])
        ts = calendar.timegm(time.strptime(RECOVERED_AT, "%Y-%m-%d %H:%M:%S"))
        os.utime(p, (ts, ts))
    rep = '<?xml version="1.0" encoding="UTF-8"?>\n<dfxml xmloutputversion="1.0">\n  <metadata/>\n  <creator><program>PhotoRec</program><version>7.1</version></creator>\n  <source><image_filename>card.img</image_filename></source>\n</dfxml>\n'
    open(os.path.join(out, "recup_dir.1", "report.xml"), "w").write(rep)

# --------------------------------------------------------------------------------------------
# Answer key: every recovered file's expected group

key = {}
seen = set()
problems = []
for root, _, files in sorted(os.walk(out)):
    for name in sorted(files):
        p = os.path.join(root, name)
        rel = os.path.relpath(p, out).replace(os.sep, "/")
        data = open(p, "rb").read()
        h = hashlib.sha256(data).hexdigest()
        src = by_hash.get(h)
        sector = name[1:].split(".")[0].split("_")[0] if name.startswith("f") else None
        at_src = by_offset.get(int(sector) * 512) if sector and sector.isdigit() else None
        if name == "report.xml":
            e = {"label": "system", "note": "PhotoRec's own report"}
        elif src is not None and src["label"] != "damaged":
            label = src["label"]
            if label in ("keep", "duplicate"):
                label = "duplicate" if h in seen else "keep"
                seen.add(h)
            if "original_note" in src:  # a photo that was on the card twice: the first one found is kept
                e = {"label": label, "note": "exact copy of a kept photo" if label == "duplicate" else src["original_note"] + " (on the card twice)"}
            else:
                e = {"label": label, "note": src["note"]}
            if label == "keep":
                e["kind"] = src["kind"]
                e["year"] = src["year"]
        elif at_src is not None and at_src["label"] in ("damaged", "system"):
            # cut-off files, and app files PhotoRec rounds up or renames (web pages get their title)
            e = {"label": at_src["label"], "note": at_src["note"]}
        else:
            problems.append(f"{rel}: {len(data)} bytes, matches nothing on the card (from {at_src['note'] if at_src else '?'})")
            continue
        e["sha256"] = h
        key[rel] = e
# Every photo, video and preview must come through whole (PhotoRec misses some plain-text app files)
found = {v["sha256"] for v in key.values()}
missing = [it["note"] for it in items if it["label"] in ("keep", "duplicate", "small") and hashlib.sha256(it["data"]).hexdigest() not in found]
if missing:
    problems.append(f"not recovered: {missing}")
if problems:
    print("\n".join(problems))
    sys.exit("the recovered folder doesn't match the card; fix the layout before using it")

counts = {}
for v in key.values():
    counts[v["label"]] = counts.get(v["label"], 0) + 1
kept = [v for v in key.values() if v["label"] == "keep"]
photos = [v for v in kept if v["kind"] == "photo"]
videos = [v for v in kept if v["kind"] == "video"]
by_year = {}
for v in kept:
    k = str(v["year"]) if v["year"] else "no date"
    by_year.setdefault(k, {"photos": 0, "videos": 0})[v["kind"] + "s"] += 1
summary = {
    "made_by": made_by,
    "files": len(key),
    "folders": sorted({k.split("/")[0] for k in key}),
    "bytes": sum(os.path.getsize(os.path.join(out, k)) for k in key),
    "groups": counts,
    "keep_photos": len(photos),
    "keep_videos": len(videos),
    "undated_photos": sum(1 for v in photos if not v["year"]),
    "by_year": dict(sorted(by_year.items())),
    "notes": {n: sum(1 for v in key.values() if v["note"] == n) for n in sorted({v["note"] for v in key.values()})},
}
json.dump({"summary": summary, "files": key}, open(os.path.join(work, "pilot-key.json"), "w"), indent=1)
print(json.dumps(summary, indent=1))

if zip_out:
    zip_out = os.path.abspath(zip_out)
    os.makedirs(os.path.dirname(zip_out), exist_ok=True)
    with zipfile.ZipFile(zip_out, "w", zipfile.ZIP_STORED) as z:  # photos and videos don't compress
        for rel in sorted(key):
            p = os.path.join(out, rel)
            zi = zipfile.ZipInfo.from_file(p, f"{FOLDER}/{rel}")
            zi.compress_type = zipfile.ZIP_DEFLATED if rel.rsplit(".", 1)[-1] in ("txt", "xml", "html", "sqlite") else zipfile.ZIP_STORED
            with open(p, "rb") as fh:
                z.writestr(zi, fh.read())
    print(f"zip: {zip_out} ({os.path.getsize(zip_out) / 1e6:.1f} MB)")
