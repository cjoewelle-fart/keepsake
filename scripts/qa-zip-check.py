"""Zip save check (T89): verifies the zip downloads Keepsake made against the recovery folder.

Run by scripts/qa-zip-check.mjs (with python3 -I); can also be run on its own:
  python3 -I scripts/qa-zip-check.py snapshot <recovery_dir> <snap.json>
  python3 -I scripts/qa-zip-check.py check <recovery_dir> <snap.json> <zip_dir> <app.json> [labels.json]

app.json is what the app showed: {"saved": n, "failed": n, "sorted": "...", "months": {"2024-06": n, "none": n}}.
Prints a JSON report; exits 1 if any check fails.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
import zipfile
from collections import Counter

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
ILLEGAL = re.compile(r'[<>:"\\|?*\x00-\x1f\x7f]')
RESERVED = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)", re.I)
DATED = re.compile(r"^Keepsake photos/(\d{4})/(\d{2}) ([A-Za-z]+)/(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})( \((\d+)\))?(\.[a-z0-9]{1,5})?$")
NODATE = re.compile(r"^Keepsake photos/No date/[^/]+$")
# Windows MAX_PATH is 260 including the folder the zip is extracted into: leave ~100 for that.
MAX_INNER_PATH = 160


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def snapshot(root):
    out = {"files": {}, "dirs": []}
    for d, dirs, files in os.walk(root):
        for x in dirs:
            out["dirs"].append(os.path.relpath(os.path.join(d, x), root))
        for x in files:
            p = os.path.join(d, x)
            st = os.stat(p)
            out["files"][os.path.relpath(p, root)] = [st.st_size, st.st_mtime_ns, sha(p)]
    out["dirs"].sort()
    out["root_mtime_ns"] = os.stat(root).st_mtime_ns
    return out


def exif_date(path):
    """DateTimeOriginal (or DateTime) of a JPEG, as 'YYYY-MM-DD HH.MM', or None."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            ex = im.getexif()
            v = ex.get_ifd(0x8769).get(0x9003) or ex.get(0x0132)
        if not v:
            return None
        m = re.match(r"(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})", v)
        return f"{m[1]}-{m[2]}-{m[3]} {m[4]}.{m[5]}" if m else None
    except Exception:
        return None


def check(rec, snap_path, zip_dir, app_path, labels_path=None):
    before = json.load(open(snap_path))
    app = json.load(open(app_path))
    labels = json.load(open(labels_path)) if labels_path else None
    if labels:  # fixtures/labels.json has {"label": ...} values, perf-labels.json plain strings
        labels = {k: (v["label"] if isinstance(v, dict) else v) for k, v in labels.items()}
    fails, notes = [], []
    by_hash = {}
    for rel, (size, _, h) in before["files"].items():
        by_hash.setdefault(h, []).append(rel)

    zips = sorted(z for z in os.listdir(zip_dir) if z.endswith(".zip"))
    if not zips:
        fails.append("no zip files downloaded")
    for z in zips:
        if ILLEGAL.search(z) or z != z.strip():
            fails.append(f"zip file name not safe: {z!r}")
    entries = []  # (zip, info)
    zip_bytes = 0
    for z in zips:
        zp = os.path.join(zip_dir, z)
        zip_bytes += os.path.getsize(zp)
        t = subprocess.run(["unzip", "-t", "-qq", zp], capture_output=True, text=True)
        if t.returncode != 0:
            fails.append(f"unzip -t {z}: exit {t.returncode}: {(t.stdout + t.stderr)[-500:]}")
        try:
            with zipfile.ZipFile(zp) as zf:
                bad = zf.testzip()
                if bad:
                    fails.append(f"zipfile CRC check failed in {z}: {bad}")
                for info in zf.infolist():
                    entries.append((z, info))
        except Exception as e:
            fails.append(f"zipfile can't open {z}: {e!r}")

    # Bytes: every entry is byte-for-byte some file in the recovery folder.
    matched = Counter()
    entry_src = {}
    dir_entries = 0
    for z, info in entries:
        if info.is_dir():
            dir_entries += 1
            continue
        with zipfile.ZipFile(os.path.join(zip_dir, z)) as zf, zf.open(info) as f:
            h = hashlib.sha256()
            for b in iter(lambda: f.read(1 << 20), b""):
                h.update(b)
        src = by_hash.get(h.hexdigest())
        if not src:
            fails.append(f"{z}: {info.filename}: bytes match no file in the recovery folder")
            continue
        if info.flag_bits & 0x800 == 0 and any(ord(c) > 127 for c in info.filename):
            fails.append(f"{info.filename}: non-ASCII name without the UTF-8 flag")
        entry_src[info.filename] = src
        matched[src[0]] += 1
    files = [i for _, i in entries if not i.is_dir()]
    dupes = {k: v for k, v in matched.items() if v > 1}
    if dupes:
        fails.append(f"{len(dupes)} source files are in the zip more than once, e.g. {list(dupes)[:3]}")

    # Counts against the receipt.
    if len(files) != app["saved"]:
        fails.append(f"zips hold {len(files)} files, receipt says {app['saved']} saved")
    if app.get("failed"):
        fails.append(f"receipt says {app['failed']} couldn't be saved")

    # Names: safe on Windows and macOS, no traversal, not too long, no case-only clashes.
    seen = Counter()
    longest = max((len(i.filename) for i in files), default=0)
    for i in files:
        n = i.filename
        seen[unicodedata.normalize("NFC", n).casefold()] += 1
        parts = n.split("/")
        if n.startswith("/") or "\\" in n or any(p in ("", ".", "..") for p in parts):
            fails.append(f"unsafe path (traversal/absolute/empty part): {n!r}")
        if parts[0] != "Keepsake photos":
            fails.append(f"outside Keepsake photos/: {n!r}")
        for p in parts:
            if ILLEGAL.search(p) or RESERVED.match(p) or p != p.rstrip(" .") or p != p.strip():
                fails.append(f"name not safe on Windows: {n!r} (part {p!r})")
            if len(p.encode()) > 255:
                fails.append(f"name part over 255 bytes: {n!r}")
        if n != unicodedata.normalize("NFC", n):
            fails.append(f"name not NFC: {n!r}")
        if len(n) > MAX_INNER_PATH:
            fails.append(f"path {len(n)} chars (> {MAX_INNER_PATH}, risky under Windows MAX_PATH): {n!r}")
    clashes = [k for k, v in seen.items() if v > 1]
    if clashes:
        fails.append(f"{len(clashes)} paths clash case-insensitively, e.g. {clashes[:3]}")

    # Layout: Keepsake photos/YYYY/MM Month/YYYY-MM-DD HH.MM[ (n)].ext, or No date/<name>.
    months, years, nodate = Counter(), set(), 0
    exif_ok = exif_bad = exif_none_in_dated = nodate_with_exif = 0
    exif_bad_eg = []
    for i in files:
        n = i.filename
        m = DATED.match(n)
        src = entry_src.get(n, [None])[0]
        src_path = os.path.join(rec, src) if src else None
        if m:
            y, mo, mname, y2, mo2 = m[1], m[2], m[3], m[4], m[5]
            if y != y2 or mo != mo2 or not (1 <= int(mo) <= 12) or MONTHS[int(mo) - 1] != mname:
                fails.append(f"folder doesn't match the name's date: {n!r}")
            months[f"{y}-{mo}"] += 1
            years.add(y)
            if src_path and src.lower().endswith((".jpg", ".jpeg")):
                d = exif_date(src_path)
                if d is None:
                    exif_none_in_dated += 1
                elif d == f"{m[4]}-{m[5]}-{m[6]} {m[7]}.{m[8]}":
                    exif_ok += 1
                else:
                    exif_bad += 1
                    if len(exif_bad_eg) < 5:
                        exif_bad_eg.append(f"{n} <- {src} (Exif {d})")
        elif NODATE.match(n):
            nodate += 1
            months["none"] += 1
            if src_path and src.lower().endswith((".jpg", ".jpeg")) and exif_date(src_path):
                nodate_with_exif += 1
        else:
            fails.append(f"path not in the year/month or No date layout: {n!r}")
    if exif_bad:
        fails.append(f"{exif_bad} dated JPEGs filed under a date that isn't their Exif date, e.g. {exif_bad_eg}")
    if nodate_with_exif:
        notes.append(f"{nodate_with_exif} JPEGs with an Exif date went to No date")

    # Against what the app showed: the receipt's "Sorted into" and the timeline's months.
    def sorted_text(ys, ms, nd):
        pl = lambda k, a, b: a if k == 1 else b
        dated = f"{ys:,} {pl(ys, 'year', 'years')}, {ms:,} {pl(ms, 'month', 'months')}" if ys else ""
        return f"{dated}, plus No date ({nd:,})" if dated and nd else dated or f"No date ({nd:,})"
    want = sorted_text(len(years), len([k for k in months if k != "none"]), nodate)
    if app.get("sorted") is not None and app["sorted"] != want:
        fails.append(f"receipt says sorted into \"{app['sorted']}\", zips have \"{want}\"")
    if app.get("months") is not None:
        diff = {k: (app["months"].get(k, 0), months.get(k, 0)) for k in set(app["months"]) | set(months) if app["months"].get(k, 0) != months.get(k, 0)}
        if diff:
            fails.append(f"timeline months vs zip months differ (timeline, zip): {dict(list(diff.items())[:10])}")

    # Labels (answer key): what the kept files are.
    # Identical files share a hash: the entry counts as "keep" if any of them is labelled keep.
    def label_of(srcs):
        ls = [labels.get(x, "?") for x in srcs]
        return "keep" if "keep" in ls else ls[0]
    by_label = Counter(label_of(entry_src[i.filename]) for i in files if i.filename in entry_src) if labels else None

    # The recovery folder afterwards.
    after = snapshot(rec)
    changed = [k for k in before["files"] if after["files"].get(k) != before["files"][k]]
    added = [k for k in after["files"] if k not in before["files"]]
    if changed or added or after["dirs"] != before["dirs"] or after["root_mtime_ns"] != before["root_mtime_ns"]:
        fails.append(f"recovery folder changed: {len(changed)} changed/removed, {len(added)} added, dirs same: {after['dirs'] == before['dirs']}, e.g. {(changed + added)[:5]}")

    report = {
        "zips": zips, "zip_bytes": zip_bytes, "entries": len(files), "dir_entries": dir_entries,
        "receipt_saved": app["saved"], "receipt_failed": app.get("failed"),
        "bytes_match": len(entry_src), "longest_path": longest,
        "years": len(years), "months": len([k for k in months if k != "none"]), "no_date": nodate,
        "sorted_app": app.get("sorted"), "sorted_zip": want,
        "exif_date_match": exif_ok, "exif_date_mismatch": exif_bad, "dated_jpeg_without_exif": exif_none_in_dated,
        "kept_by_label": dict(by_label) if by_label is not None else None,
        "recovery_files": len(before["files"]), "recovery_unchanged": not (changed or added),
        "notes": notes, "fails": fails[:40], "fail_count": len(fails),
    }
    print(json.dumps(report, indent=1))
    return 1 if fails else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "snapshot":
        json.dump(snapshot(a[1]), open(a[2], "w"))
        print(f"snapshot: {len(json.load(open(a[2]))['files'])} files")
    elif a[0] == "check":
        sys.exit(check(*a[1:]))
