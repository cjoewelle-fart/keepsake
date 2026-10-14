# Keepsake

Sort photos recovered by PhotoRec into a clean, dated library — entirely on your own computer.

PhotoRec recovers files well but loses their names and folders, leaving thousands of files like `f12345678.jpg` mixed with thumbnails, copies, broken files and app junk. Keepsake finds the photos and videos worth keeping and sets the rest aside, without deleting or changing anything.

## Privacy by design

- No server: the app is static files. Your photos are read in your browser and never uploaded.
- The production build carries a Content Security Policy (`connect-src 'self'`, see `vite.config.ts`), so the page can't send data to other sites.
- Fonts are bundled; no analytics or third-party scripts.
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
npm run fixture    # make a synthetic PhotoRec-style folder in fixtures/ (needs Python 3 + Pillow)
npm run eval       # score the engine against the fixture's answer key
npm run build && node scripts/e2e.mjs <path-to-chromium>   # full flow in a real browser
```

The fixture is synthetic, so a perfect eval score proves the rules behave as designed, not that they work on real recoveries. **The phase 1 gate (under 1% of real photos wrongly set aside) still needs real recovered SD cards and phones.**

## How files are sorted

Checks run cheapest first; the first match decides. Every decision records a reason, and the user can keep any group.

| Group | Rule |
|---|---|
| App and system files | Contents aren't a supported photo or video format (identified by bytes, not extension) |
| Damaged or incomplete | Empty, broken structure, or the picture data never reaches its end marker |
| Small preview copies | No camera details and no date taken, and shorter side under 400 px (or under 20 KB when the size is unknown) |
| Exact copies | Same SHA-256 as another kept file (only same-size files are compared); the copy with the most details is kept |
| Keep | Everything else, including files that couldn't be read at all |

Photos with extra data after the picture (Samsung trailers, Motion Photos, zero padding) are recognised as whole.

## Known gaps

- HEIC, CR3 and other RAW formats are recognised but untested on real files, and have no preview yet.
- Video dates aren't read yet, so videos aren't placed on the timeline.
- Files over 64 MB are compared for copies by sampling the start and end, which could rarely mark two different videos as copies.
- Stopping a scan waits for the file currently being read.

## The team

Role definitions for AI assistants working on this project are in `.claude/agents/`: product owner, UX designer, UX writer, front-end developer and QA tester.

## License

GPL-3.0 (planned; add the LICENSE file before publishing).
