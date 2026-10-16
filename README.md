# Keepsake

Sort photos recovered by PhotoRec into a clean, dated library — entirely on your own computer.

PhotoRec recovers files well but loses their names and folders, leaving thousands of files like `f12345678.jpg` mixed with thumbnails, copies, broken files and app junk. Keepsake finds the photos and videos worth keeping and sets the rest aside, without deleting or changing anything.

## Privacy by design

- No server: the app is static files. Your photos are read in your browser and never uploaded.
- The production build carries a Content Security Policy (`connect-src 'self'`, see `vite.config.ts`), so the page can't send data to other sites.
- Fonts are bundled; no analytics or third-party scripts.
- iPhone (HEIC) previews in Chrome, Edge and Firefox are decoded on your computer by libheif compiled to WebAssembly and bundled with the app (nothing is downloaded at runtime). Safari shows HEIC itself. A decode that takes over 15 seconds is abandoned (its worker is replaced) and the tile shows the file type instead; at most 200 decoded previews are kept in memory.
- The recovery folder is opened read-only.

## Status: phase 1 (prototype the engine)

Done: folder picking, scanning in a background worker, cleanup rules, the cleanup results screen, a basic by-year view.
Next (phase 2): full review timeline with selection, export, PhotoRec guide, offline install, privacy page.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (with the privacy lock-down)
```

Use Chrome or Edge for the best experience. Other browsers fall back to a folder upload dialog (still local).

## Test it

```bash
npm test           # unit and regression tests
npm run fixture    # make a synthetic PhotoRec-style folder in fixtures/ (needs Python 3 + Pillow; HEIC files are included when pillow-heif is installed)
npm run eval       # score the engine against the fixture's answer key
python3 scripts/make_heic_samples.py tests/heic   # remake the HEIC test files (needs pillow-heif)
npm run build && node scripts/e2e.mjs <path-to-chromium>   # full flow in a real browser
```

The fixture is synthetic, so a perfect eval score proves the rules behave as designed, not that they work on real recoveries. **The phase 1 gate (under 1% of real photos wrongly set aside) still needs real recovered SD cards and phones.**

## How files are sorted

Checks run cheapest first; the first match decides. Every decision records a reason, and the user can keep any group.

| Group | Rule |
|---|---|
| App and system files | Contents aren't a supported photo or video format (identified by bytes, not extension) |
| Damaged or incomplete | Empty, broken structure, or the picture data never reaches its end marker. HEIC/AVIF: the file ends before its table of contents ('meta' box) is complete, or before data that table points to (picture tiles, Exif). HEIF image sequences without a 'meta' box are kept |
| Small preview copies | No camera details and no date taken, and shorter side under 400 px (or under 20 KB when the size is unknown). HEIC/AVIF pixel size comes from the main picture's 'ispe' property, not its thumbnail |
| Exact copies | Same SHA-256 as another kept file (only same-size files are compared); the copy with the most details is kept |
| Keep | Everything else, including files that couldn't be read at all, and HEIC/AVIF files we can't fully check (a 'meta' box over 4 MB, or picture data stored in another file) |

Photos with extra data after the picture (Samsung trailers, Motion Photos, zero padding) are recognised as whole. So are HEIC files with leftover bytes after their last box.

HEIC and AVIF are recognised by the 'ftyp' box: its main brand, or, when that brand is unknown, a HEIF still-image brand in its compatible list (unless the list also names a video brand such as isom, iso2, avc1 or mp41).

HEIC camera details and dates are read from the Exif item wherever the file's 'iloc' table says it is, so they're found even when the Exif block sits after megabytes of picture data.

## Known gaps

- HEIC is tested on files encoded by libheif in an iPhone-like layout (tiles, thumbnail, Exif item) and on real PhotoRec 7.1 output of those files, but not yet on photos taken by an iPhone.
- AVIF previews rely on the browser (all current browsers show AVIF). CR3 and other RAW formats are recognised but untested on real files, and have no preview.
- Video dates aren't read yet, so videos aren't placed on the timeline.
- Files over 64 MB are compared for copies by sampling the start and end, which could rarely mark two different videos as copies.
- Stopping a scan waits for the file currently being read.

## The team

Role definitions for AI assistants working on this project are in `.claude/agents/`: product owner, UX designer, UX writer, front-end developer and QA tester.

## License

GPL-3.0 (planned; add the LICENSE file before publishing).

Third-party code shipped in the app: libheif-js 1.23.2 (libheif and libde265, LGPL-3.0), used unmodified for HEIC previews, plus React, Comlink, exifr, browser-fs-access and the two bundled fonts. Their full licence texts (including zlib's) are in [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt), which the build copies to `dist/THIRD_PARTY_NOTICES.txt`. Regenerate it with `npm run notices` after changing runtime dependencies (a test fails if it's out of date). libde265 and zlib texts come from upstream and are kept in `licenses/`.
