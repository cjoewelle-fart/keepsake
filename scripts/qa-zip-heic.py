"""HEIC in a zip (T89): builds a recovery-style folder with real iPhone/Samsung HEIC files and
checks that every HEIC the app keeps is in the zip downloads, byte for byte, under the expected name.

Run by scripts/qa-zip-heic.mjs (with python3 -I); can also be run on its own:
  python3 -I scripts/qa-zip-heic.py build <fixture_recovery> <fixture_labels.json> <out_dir>
      -> <out_dir>/recovery, <out_dir>/labels.json (fixture labels + the HEIC cases), <out_dir>/heic-expect.json
  python3 -I scripts/qa-zip-heic.py verify <recovery_dir> <zip_dir> <heic-expect.json>
      -> JSON report; exit 1 if any check fails

<fixture_recovery> comes from scripts/make_fixture.py (JPEGs and junk, with an answer key).
The HEIC cases (and four real phone JPEGs) are added in recup_dir.90 and recup_dir.91 with
PhotoRec-style names. Real files come from tests/real-phones (see its README), synthetic ones
from tests/heic (scripts/make_heic_samples.py).
"""
import hashlib
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

# The product name comes from the one name setting, src/brand.ts.
APP_NAME = re.search(r"APP_NAME = '([^']+)'", (Path(__file__).resolve().parent.parent / "src" / "brand.ts").read_text()).group(1)
ROOT = f"{APP_NAME} photos"

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
REAL = os.path.join(REPO, "tests", "real-phones")
SYN = os.path.join(REPO, "tests", "heic")
HEIC_BRANDS = {b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx", b"mif1", b"msf1", b"MiHE", b"MiHB", b"miaf"}
D = ROOT


def sha(b):
    return hashlib.sha256(b).hexdigest()


def read(p):
    with open(p, "rb") as f:
        return f.read()


# (relative path, bytes source, label, expected zip paths (any one of) or None, note)
def cases():
    i8 = read(os.path.join(REAL, "iphone-8_IMG_1034.heic"))
    i11 = read(os.path.join(REAL, "iphone-11-pro_IMG_2927.HEIC"))
    s10 = read(os.path.join(REAL, "samsung-galaxy-s10plus_SM-G975F.heic"))
    syn = read(os.path.join(SYN, "iphone.heic"))
    plain = read(os.path.join(SYN, "plain.heic"))
    thumb = read(os.path.join(SYN, "thumb.heic"))
    i8_name = [f"{D}/2018/02 February/2018-02-05 15.11.heic", f"{D}/2018/02 February/2018-02-05 15.11 (2).heic"]
    return [
        # Real camera HEICs.
        ("recup_dir.90/f90000001.heic", i8, "keep", i8_name, "iPhone 8 HEIC (real)"),
        ("recup_dir.90/f90000002.heic", s10, "keep", [f"{D}/2020/06 June/2020-06-30 11.27.heic"], "Samsung S10+ HEIC, mdat before meta (real)"),
        # Real iPhone 11 Pro HEIC under the wrong extension (as older PhotoRec builds named ftyp files .mov):
        # the format in the bytes should win, saved as .heic.
        ("recup_dir.90/f90000003.mov", i11, "keep", [f"{D}/2020/05 May/2020-05-04 18.39.heic"], "iPhone 11 Pro HEIC (real) named .mov"),
        # Synthetic iPhone-like HEIC, upper-case extension: saved as lower-case .heic.
        ("recup_dir.90/f90000004.HEIC", syn, "keep", [f"{D}/2023/07 July/2023-07-14 18.22.heic"], "synthetic iPhone-like HEIC, .HEIC"),
        # No Exif, full size: kept, goes to No date under its own name (.heif kept as an alias).
        ("recup_dir.90/f90000005.heif", plain, "keep", [f"{D}/No date/f90000005.heif"], "full-size HEIC with no date, .heif"),
        # Same minute as f90000001, different bytes (leftover bytes after the end, as PhotoRec often leaves):
        # kept, and one of the two gets " (2)".
        ("recup_dir.91/f91000006.heic", i8 + bytes(4096) + b"garbage!", "keep", i8_name, "iPhone 8 HEIC + trailing junk (same minute)"),
        # Should be set aside.
        ("recup_dir.90/f90000007.heic", thumb, "small", None, "320x240 HEIC preview"),
        ("recup_dir.90/f90000008.heic", i8[: int(len(i8) * 0.6)], "damaged", None, "iPhone 8 HEIC cut to 60%"),
        ("recup_dir.90/f90000009.heic", b"", "damaged", None, "0-byte .heic"),
        ("recup_dir.91/f91000010.heic", i8, "duplicate", None, "exact copy of f90000001.heic"),
        ("recup_dir.91/f91000011.heic", s10[: int(len(s10) * 0.5)], "damaged", None, "Samsung S10+ HEIC cut to 50% (meta is after mdat, so it's gone)"),
    ]


JPEGS = [  # real phone JPEGs mixed in (checked for Exif date by qa-zip-check.py)
    ("recup_dir.90/f90000020.jpg", "iphone-4.jpg"),
    ("recup_dir.90/f90000021.jpg", "samsung-galaxy-s_GT-I9000.jpg"),
    ("recup_dir.91/f91000022.jpg", "samsung-galaxy-s4_GT-I9505.jpg"),
    ("recup_dir.91/f91000023.jpg", "samsung-galaxy-j3_SM-J327T1.jpg"),
]


def build(fx_rec, fx_labels, out):
    rec = os.path.join(out, "recovery")
    if os.path.exists(rec):
        shutil.rmtree(rec)
    shutil.copytree(fx_rec, rec)
    labels = json.load(open(fx_labels))
    labels = {k: (v["label"] if isinstance(v, dict) else v) for k, v in labels.items()}
    expect = []
    for rel, data, label, paths, note in cases():
        p = os.path.join(rec, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(data)
        labels[rel] = label
        expect.append({"path": rel, "sha256": sha(data), "size": len(data), "label": label, "zip_paths": paths, "note": note})
    for rel, name in JPEGS:
        p = os.path.join(rec, rel)
        shutil.copyfile(os.path.join(REAL, name), p)
        labels[rel] = "keep"
    json.dump(labels, open(os.path.join(out, "labels.json"), "w"), indent=1)
    json.dump(expect, open(os.path.join(out, "heic-expect.json"), "w"), indent=1)
    n = sum(len(fs) for _, _, fs in os.walk(rec))
    print(f"built {rec}: {n} files ({len(expect)} HEIC cases, {sum(e['label'] == 'keep' for e in expect)} should be kept)")


def is_heic(p):
    with open(p, "rb") as f:
        h = f.read(64)
    if len(h) < 12 or h[4:8] != b"ftyp":
        return False
    n = int.from_bytes(h[0:4], "big")
    brands = [h[8:12]] + [h[i : i + 4] for i in range(16, min(n, len(h)) - 3, 4)]
    return h[8:12] in HEIC_BRANDS or (b"mif1" in brands and h[8:12] not in (b"avif", b"avis"))


def verify(rec, zip_dir, expect_path):
    expect = json.load(open(expect_path))
    fails = []
    # HEIC files in the folder by their bytes (ftyp brand), whatever the extension.
    heic_on_disk = []
    for d, _, fs in os.walk(rec):
        for x in fs:
            p = os.path.join(d, x)
            if is_heic(p):
                heic_on_disk.append(os.path.relpath(p, rec))
    # Zip entries by hash.
    entries = {}  # sha -> [zip path]
    for z in sorted(x for x in os.listdir(zip_dir) if x.endswith(".zip")):
        with zipfile.ZipFile(os.path.join(zip_dir, z)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                entries.setdefault(sha(zf.read(info)), []).append(info.filename)
    rows, used = [], set()
    heic_keep = heic_in_zip = identical = right_place = 0
    false_setaside, junk_in_keep = [], []
    for e in expect:
        disk = read(os.path.join(rec, e["path"]))
        if sha(disk) != e["sha256"]:
            fails.append(f"{e['path']}: source changed since build")
        zp = entries.get(e["sha256"], [])
        row = {"path": e["path"], "label": e["label"], "note": e["note"], "in_zip": zp}
        if e["label"] == "keep":
            heic_keep += 1
            if not zp:
                false_setaside.append(e["path"])
                fails.append(f"{e['path']} ({e['note']}) should be kept but is not in the zip")
            else:
                heic_in_zip += 1
                identical += 1  # matched by SHA-256 of the entry's bytes
                if len(zp) > 1:
                    fails.append(f"{e['path']} is in the zip {len(zp)} times: {zp}")
                ok = [p for p in zp if p in e["zip_paths"] and p not in used]
                if ok:
                    right_place += 1
                    used.add(ok[0])
                else:
                    fails.append(f"{e['path']} saved as {zp}, expected one of {e['zip_paths']}")
        elif e["label"] == "duplicate":
            # Its bytes are those of a kept file: exactly one copy of them should be in the zip.
            if len(zp) != 1:
                fails.append(f"{e['path']} (exact copy): its bytes are in the zip {len(zp)} times, expected once")
        else:
            if zp:
                junk_in_keep.append(e["path"])
                fails.append(f"{e['path']} ({e['note']}, should be set aside as {e['label']}) is in the zip as {zp}")
        rows.append(row)
    report = {
        "heic_in_folder": len(heic_on_disk),
        "heic_cases": len(expect),
        "heic_should_keep": heic_keep,
        "heic_kept_in_zip": heic_in_zip,
        "heic_byte_identical": identical,
        "heic_expected_name_and_folder": right_place,
        "heic_false_set_aside": false_setaside,
        "heic_junk_in_zip": junk_in_keep,
        "heic_on_disk_not_in_cases": sorted(set(heic_on_disk) - {e["path"] for e in expect}),
        "rows": rows,
        "fails": fails,
    }
    print(json.dumps(report, indent=1))
    return 1 if fails else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "build":
        build(*a[1:4])
    elif a and a[0] == "verify":
        sys.exit(verify(*a[1:4]))
    else:
        print(__doc__)
        sys.exit(2)
