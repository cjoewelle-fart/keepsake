# Upsort

Sort photos recovered by PhotoRec into a clean, dated library — entirely on your own computer.

The name comes from upcycling. Upsort turns the jumble of files a recovery program gives back into a photo library you can use.

PhotoRec recovers files well but loses their names and folders, leaving thousands of files like `f12345678.jpg` mixed with thumbnails, copies, broken files and app junk. Upsort finds the photos and videos worth keeping and sets the rest aside, without deleting or changing any of your files.

## Privacy by design

**Your photos never leave this computer, and Upsort never changes or deletes your files.**

- No server: the app is static files. Your photos are read in your browser and never uploaded.
- The production build carries a Content Security Policy (`connect-src 'self'`, see `vite.config.ts`), so the page can't send data to other sites.
- Fonts are bundled; no analytics or third-party scripts.
- Photo tiles show small copies (shorter side 160–480 px, sized to the tile and the screen), made on your computer by the browser's own decoder in two or three background workers (`src/worker/thumb.worker.ts`), only for tiles near the screen, and drawn into a canvas that is emptied when the tile scrolls away. JPEGs are decoded straight to 1/2–1/8 size where the browser supports it (WebCodecs `ImageDecoder`), and turned upright by their Exif orientation. At most 300 copies (a few MB) are kept for scrolling back. Browsers without `OffscreenCanvas` show the photo file itself, as before.
- iPhone (HEIC) previews in Chrome, Edge and Firefox are decoded on your computer by libheif compiled to WebAssembly and bundled with the app (nothing is downloaded at runtime). Safari shows HEIC itself. Phones store a small copy (about 320 px) inside each HEIC; when it's there and shaped like the photo, that copy is decoded instead of the full 12 MP picture (about 15 ms instead of 1–1.5 s). Photos without one (often edited or exported ones) are decoded in full and scaled down. One decoding worker, or two on computers with 4+ cores and 4+ GB of memory. A decode that takes over 15 seconds is abandoned (its worker is replaced) and the tile shows the file type instead; at most 200 decoded previews are kept in memory.
- Videos this browser can't play (old phone 3GP, HEVC in a browser without it, AVI, Motion JPEG) say "Can't play in this browser. It can still be saved." on their tile. The scan reads each video's codec from its 'stsd' box and the page asks the browser's `canPlayType`; the video itself isn't loaded or decoded. They stay selected and are saved like any other.
- The recovery folder is opened read-only.
- Saving makes new copies only inside "<chosen folder>/Upsort photos", and never into the recovery folder or a folder Upsort can't check. Each copy is written under a hidden temporary name and then renamed to a free name. Browsers that can't rename files (no `FileSystemFileHandle.move()`) don't save into folders at all; they get zip downloads instead, like Safari and Firefox.
- Known limit: the rename (`move()`) replaces a file already at the new name, and browsers offer no "only if the name is free" option. Upsort checks the name immediately before renaming, with nothing in between, so another program would have to create a file with that exact name (for example "2024-06-28 14.32 (2).jpg") in that same instant inside "Upsort photos" for it to be replaced.
- Works offline: after the first visit a service worker keeps a copy of the app's own files (never your photos), so the app opens and scans a folder with the network off (`npm run offline-check` tests this in Chromium). It only stores files that are part of the app and never contacts any other site. The launch video isn't stored and needs a connection.

## What it does today

- Choose your recovery folder, and Upsort checks every file on your computer. Nothing is uploaded.
- It sets aside app and system files, damaged files, small preview copies and exact copies, and says why. You can keep any of them.
- "Choose what to save" shows your photos and videos by year, month and day, all selected to start.
- Saving makes new copies in a folder you choose (Chrome and Edge) or as zip downloads (other browsers), with a receipt you can save or print.
- It can be installed as an app. The start screen has a short video, a privacy page and a step-by-step PhotoRec guide.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (with the privacy lock-down and offline support)
npm run preview    # serve the production build at http://localhost:4173
npm run build:test # test build for usability sessions in dist-test/
```

The test build (`npm run build:test`) is the production build (same privacy lock-down and offline install) with two differences: the "Try with example files" button is always off, even if `VITE_SAMPLES=1` is set (the build fails if the example-files code gets in), and the page title reads "Upsort (test)" so session recordings can be told apart. Serve it with `npx vite preview --outDir dist-test`.

### Builds for usability sessions

Two ways to give testers the app, both without the "Try with example files" button and titled "Upsort (test)":

- **Remote sessions: a shareable page.** `npm run build:artifact-test` makes one self-contained page, `dist-artifact-test/page/keepsake-test.html` (no sample pack), to publish as a claude.ai artifact. The steps by hand: `npx vite build --mode artifact-test`, then `node scripts/make-artifact.mjs --test <out-dir>`; both refuse to finish if the example-files code gets in. The artifact viewer runs the page in a sandboxed frame, so there:
  - the folder is chosen with the browser's folder-upload dialog (`<input webkitdirectory>`), never the folder picker, which Chromium refuses in sandboxed frames. Chrome then asks "Upload N files to this site?"; the start screen says that's the browser's wording and nothing is sent. Scanning works as usual.
  - saving isn't possible (no folder picker, and downloads from a sandboxed frame are blocked unless the frame allows them, which a page can't check). The save step says "Saving isn't available in this preview. In the real app, your photos are saved to a folder you choose." instead of offering a button that would fail. So saving can't be tested on this page.
  - `node scripts/sandbox-check.mjs <path-to-chromium> <out-dir>/keepsake-test.html` checks this in headless Chromium: the page in an iframe with `sandbox="allow-scripts allow-same-origin"` (no `allow-downloads`), with the folder picker removed and with Chromium's own, plus a control run outside a frame.
- **In-person sessions: on your laptop, where saving fully works.** `npm run build:test && npx vite preview --outDir dist-test --port 4173`, then open http://localhost:4173 in Chrome. This is the real app (folder picker, saving into a folder, offline install). Stop the server with Ctrl+C when the session ends. (`--outDir dist-test` matters: plain `npx vite preview` serves the normal build in `dist/`.)

Offline use: open the production build once (it must be served over https or from localhost), then it can be installed ("Install app" in Chrome or Edge's address bar, or "Add to Home Screen") and works with the network off. A new version is picked up in the background and takes over on the visit after it was downloaded. The development server (`npm run dev`) doesn't work offline. The install name lives in `APP_NAME` in `vite.config.ts`; install icons are made from `public/favicon.svg` by `node scripts/make-icons.mjs <path-to-chromium>`.

Use Chrome or Edge for the best experience. Other browsers fall back to a folder upload dialog (still local).

## Test it

```bash
npm test           # unit and regression tests
npm run fixture    # make a synthetic PhotoRec-style folder in fixtures/ (needs Python 3 + Pillow; HEIC files are included when pillow-heif is installed)
npm run eval       # score the engine against the fixture's answer key
npm run build && node scripts/e2e.mjs <path-to-chromium> [--port 4173]   # full flow in a real browser
npm run build && npm run offline-check -- <path-to-chromium>   # installs the app, cuts the network, then scans the fixture offline
```

The fixture is synthetic, so a perfect eval score proves the rules behave as designed, not that they work on real recoveries. **The target (under 1% of real photos wrongly set aside) still needs checking on real recovered SD cards and phones.**

More on testing and performance: [docs/testing.md](docs/testing.md)

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

## How saving works

Saving makes new copies; the recovery folder is only ever read.

```
Upsort photos/2024/06 June/2024-06-28 14.32.jpg
Upsort photos/2024/06 June/2024-06-28 14.32 (2).jpg   (same minute; numbered oldest first)
Upsort photos/No date/f12345678.jpg                   (original name)
```

- **Chrome and Edge** (`showDirectoryPicker`): you choose a folder and Upsort writes into `<folder>/Upsort photos/`. If that folder already exists it's added to: names already there are skipped (" (2)", " (3)"), and every name is checked on disk again just before it's created, so nothing is ever overwritten. Files are copied in 8 MB slices. A folder that is the recovery folder or inside it is refused (checked with `FileSystemDirectoryHandle.resolve`).
- **Safari and Firefox**: zip downloads with the same layout inside, each under 2 GB (and under 65,000 files), named `Upsort photos.zip`, or `Upsort photos part 1.zip`, `part 2` and so on when one zip isn't enough. The zip writer (`src/ui/zip.ts`) is our own, store-only (photos don't compress), and builds each zip as a Blob of small headers around the original File objects, so photos are never copied into memory; only the CRC-32 reads them, in a worker. ZIP64 fields are written only for a file of 4 GiB or more.
- A file that can't be read is skipped and counted under "Couldn't save"; saving goes on. A full drive (`QuotaExceededError`), lost permission (`NotAllowedError`) or any other write error stops saving and says how many were saved; "Save the rest" carries on with the files not yet saved. Stop takes effect within one 8 MB slice and leaves no partial file.
- The one thing the app ever removes: an empty file it created a moment earlier for a copy that then failed or was stopped (the File System Access API creates the file before any bytes arrive).
- The receipt can be saved as a small `.txt` (made on this computer) or printed.

## Known gaps

- HEIC is tested on files encoded by libheif in an iPhone-like layout (tiles, thumbnail, Exif item), on real PhotoRec 7.1 output of those files, and on real phone photos from a public sample collection (iPhone 8, iPhone 11 Pro and Samsung Galaxy S10+ HEIC, plus iPhone and Samsung JPEGs and videos; see `tests/real-phones/`). It's not yet tested on PhotoRec output of real phone photos.
- AVIF previews rely on the browser (all current browsers show AVIF). CR3 and other RAW formats are recognised but untested on real files, and have no preview.
- Video recording dates are read and videos are placed by date on the review timeline; the results screen's month groups still show photos only. Video length isn't read yet, so video tiles show a play mark without a duration, and videos have no preview picture.
- The review timeline only draws the days near the screen (placeholders hold the rest), so it stays light on 40,000 files; this is tested with unit tests and the 363-file fixture, not yet in a browser with 40,000 real files.
- Files over 64 MB are compared for copies by sampling the start and end, which could rarely mark two different videos as copies.
- Stopping a scan waits for the file currently being read.
- Saving: a browser can't tell how much free space a chosen folder (or Downloads) has, so the app says how much is needed and handles a full drive when it happens. It also can't open the saved folder in File Explorer or Finder (no API; picked folders don't expose their path, and `file://` links are blocked), so the done screen names the folder instead. A zip is "saved" once it's handed to the browser's downloads; the app can't see whether the download finished, so the done screen offers each zip again. A single file over 2 GB makes its zip bigger than 2 GB.
- Saving to a real folder is tested in Chromium against the origin-private file system (the e2e replaces the folder picker) and in unit tests against an in-memory folder, not yet by hand on Windows or macOS folders or USB drives.

## The team

Role definitions for AI assistants working on this project are in `.claude/agents/`: product owner, UX designer, UX writer, front-end developer and QA tester.

## License

Upsort is free software under the GNU General Public License, version 3 or (at your option) any later version (GPL-3.0-or-later). See [`LICENSE`](LICENSE).

Third-party code shipped in the app: libheif-js 1.23.2 (libheif and libde265, LGPL-3.0), used unmodified for HEIC previews, plus React, Comlink, exifr, browser-fs-access and the two bundled fonts. Their full licence texts (including zlib's) are in [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt), which the build copies to `dist/THIRD_PARTY_NOTICES.txt`. Regenerate it with `npm run notices` after changing runtime dependencies (a test fails if it's out of date). libde265 and zlib texts come from upstream and are kept in `licenses/`. The offline service worker also bundles Workbox 7.4 (MIT), added at build time by vite-plugin-pwa 2.0.0 (MIT).

### Photo credits

The photos on the start screen and the scanning and done screens are by Chris Flexen, averie woodard and Derek Thomson on [Unsplash](https://unsplash.com) and are used under the [Unsplash License](https://unsplash.com/license). They are not covered by the code licence. Photographers and sources are listed in [`src/assets/hero/CREDITS.md`](src/assets/hero/CREDITS.md).
