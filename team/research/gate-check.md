# Phase 3 gate: QA's scripted run (T72)

By QA, Oct 27, 2026. For the owner and the Team Lead. Defines the "QA's scripted end-to-end and accessibility run" part of the phase 3 gate (D19, Oct 26). This doc gives evidence only. **Passing or failing the gate is the owner's call.**

The gate also needs the owner's own walkthrough (all six pilot tasks on the pilot folder and one real recovery) and watching the first private-beta users. This script covers neither of those.

## What you need

- Repo with `npm ci` done. Chromium for Playwright. **In the team's cloud sandbox, set `export CHROMIUM_PATH=/opt/pw-browsers/chromium`.** Playwright 1.64.1 looks for its own browser build 1248, but the sandbox has build 1243, so every browser script fails at launch without this variable. Don't run `playwright install`.
- To build the pilot folder (step 0 only): Python 3 with Pillow, numpy and **pillow-heif**, ffmpeg with libx264, and **PhotoRec 7.1** (`testdisk` package). Without PhotoRec, the script falls back to "mimic" mode, which gives 539 files instead of 523, so the answer key below doesn't apply. Don't use mimic mode for the gate.

## The run, in order

Run every command from the repo root. Steps 1–9 and P are chained as `npm run gate`, which stops at the first failure. Step 0 runs once per machine. Step 10 runs separately, last.

| # | Command | Pass when |
|---|---|---|
| 0 | `python3 scripts/make_pilot_folder.py fixtures/pilot --zip fixtures/Recovered-from-old-phone.zip` (about 5 min) | It prints `"made_by": "PhotoRec 7.1"` and `"files": 523`, and `fixtures/pilot/Recovered from old phone` holds 523 files. |
| 1 | `npm test` | All test files pass. The 4 `it.fails` "expected fail" tests are known save-safety gaps (see below). If one of them starts passing, vitest reports a failure: update the test, then this doc. |
| 2 | `npm run build` and `npm run build:test` | Both exit 0. The test build is in `dist-test/`. |
| 3 | `npm run fixture` | `wrote 1510 files to fixtures/recovery`. |
| 4 | `npm run eval -- --silent=false` (fixture eval and pilot eval; the card eval skips without `CARD_DIR`) | **Fixture:** real photos wrongly set aside under 1% (gate) and junk in Keep under 5%. **Pilot, answer key:** 523 checked, **214 kept** (208 photos, 6 videos), **309 set aside** (small 204, duplicate 22, damaged 2, system 81), 0/214 wrongly set aside, 0/214 junk in Keep. After keeping Small preview copies: 418 kept / 105 set aside. Timeline: **2022 has 44** (12 months), **No date has 20** (224 with previews kept). |
| 5 | `npm run e2e` | Synthetic folder, full flow at desktop, phone and 200% zoom: every ledger adds up, receipt count = selected count, the folder save writes exactly that many correctly named, non-empty copies and leaves an existing file alone, zips pass `unzip -t`, **`No console errors.`** and **`No requests left this computer.`**, exit 0. |
| 6 | `npm run offline-check` | `OFFLINE CHECK PASSED`: the app, its info pages and the HEIC decoder work with the network off, and there are **zero requests to any other origin**. |
| 7 | `npm run a11y` | `0 serious, 0 minor, 0 info`. Every axe violation counts as serious or minor, so this means **zero axe violations** (WCAG 2.1 A/AA plus best practice) on every screen and state. It also means no failures in the keyboard, focus, live-region, reflow, reduced-motion and forced-colours checks. |
| 8 | `node scripts/a11y-check.mjs --fixture "fixtures/pilot/Recovered from old phone" --shots e2e-shots/a11y-pilot` | The same check on the pilot folder: `0 serious, 0 minor, 0 info`. |
| 9 | `node scripts/qa-save-opfs/run.mjs` | `OPFS probes: all refusal and safety expectations met`. In the built app, a save into the recovery folder, a subfolder, a folder 5 levels down or an empty subfolder is refused with "That's your recovery folder.". Saving into a folder that only *contains* the recovery folder works, and no file appears in the recovery folder. |
| P | `npm run pilot-e2e` (`scripts/pilot-e2e.mjs`; needs step 0 and `npm run build:test`) | `PILOT E2E: 77/77 checks passed.` (77 since the T83 start-over checks; was 31) The six pilot tasks on the test build, in Chromium, with every on-screen number matching the answer key (table below), **zero outside requests**, and the recovery folder's file names and sizes unchanged. |
| 10 | Pilot folder integrity, against the SHA-256 values in the answer key (one-liner below) | `523 files, 0 differ from the key`. Run it last. |

Step 10 command:

```
python3 -I -c "
import json,hashlib,os,sys
d='fixtures/pilot/Recovered from old phone'; k=json.load(open('fixtures/pilot/pilot-key.json'))['files']
on=sorted(os.path.relpath(os.path.join(r,f),d) for r,_,fs in os.walk(d) for f in fs)
bad=[p for p in on if p not in k]+[p for p in k if p not in on]+[p for p,e in k.items() if p in on and hashlib.sha256(open(os.path.join(d,p),'rb').read()).hexdigest()!=e['sha256']]
print(f'{len(on)} files, {len(bad)} differ from the key'); sys.exit(1 if bad or len(on)!=523 else 0)"
```

## Mapped to the six pilot tasks

The answer-key numbers come from `pilot-folder.md`.

| Task | What the script checks | Where |
|---|---|---|
| **G1** Find the photos | Scanning shows "of 523 files". Title "We found 214 photos and videos worth keeping.". Ledger 523 / 214 / 309, Deleted · Uploaded 0 · 0. Year chips 2024 … 2019 and "No date · 20". Per year in the review timeline: 2024 28, 2023 38, 2022 44, 2021 33, 2020 29, 2019 22. | P; engine numbers in 4 |
| T2 What was set aside | "We set aside 309 files that look like leftovers from the recovery." Groups: Small preview copies 204, Exact copies 22, Damaged or incomplete files 2, App and system files 81. | P, 4 |
| T3 Keep the small copies | "Keep these files" in Small preview copies: title shows 418, ledger 418 / 105, and the change is announced ("Now keeping 418 files. 105 set aside."). Undo goes back to 214. | P, 4; announce + undo also in 5, 7 |
| T4 No-date photos | Results: "No date 20 photos, kept together so none get lost". Timeline: No date 20 (224 if previews are kept). | P, 4 |
| **G2** 2022 into a folder | Unselect all, select the 12 months of 2022: 44 selected. Saving into the recovery folder or its `recup_dir.2` is refused. Saving into Pictures gives a receipt of 44 saved and 0 failed. Pictures then holds exactly 44 non-empty files under `Keepsake photos/2022/`, in 12 month folders. The done screen says "Pictures › Keepsake photos". | P; save safety in 1, 5, 9 |
| T6 Uploads? | Ledger "0 · 0". The receipt file says "Recovery folder Untouched". Zero requests to any other origin, online (5, P) and offline (6). The privacy page opens offline (6). | 5, 6, P |
| Data safety (every task) | The recovery folder is never written: refusals (9, P), unchanged names and sizes in the browser (P), unchanged SHA-256 on disk (10). | 1, 9, P, 10 |

## What this script can't cover

- **The owner's walkthrough and one real recovery.** These are the gate's own items. The script uses synthetic and generated folders, never a real recovery.
- **A manual screen-reader pass** (NVDA, VoiceOver, TalkBack). axe and the scripted checks prove the names, roles, live regions and focus are there. They don't prove the experience makes sense when you listen to it.
- **Real browsers other than Chromium.** Every run here is Playwright Chromium (Chrome for Testing 153). Safari, Firefox and Edge are untested, and so is real Chrome on Windows or macOS. The zip path that Safari and Firefox would use only runs in Chromium with the folder picker removed (e2e phone and 200% zoom runs).
- **Real folder pickers and real disks.** Folders are picked through a stub. Saves go to the browser's private file system (OPFS) or a downloaded zip, not to a real Pictures folder in File Explorer or Finder. Step 10 shows the on-disk pilot folder is unchanged, but the browser only ever read it through a file input or a copy. So it doesn't show that the real Chrome picker plus a real disk behave the same way.
- **Whether people understand it** (T2 "in their own words", T6 "what makes you think that"). The script checks the words are on screen, not that they work. That's what the usability sessions are for.
- **Huge real folders, slow USB drives, real out-of-space or unplugged drives.** Some of this is simulated (a11y step 7 has a full drive, a broken drive and lost permission). It isn't checked on real hardware.
- **Real PhotoRec output of a real card** (`eval/card.eval.test.ts`). This needs `CARD_DIR` and `CARD_TRUTH`, from a physical card written with `scripts/make_card_test.py` and recovered with PhotoRec. It isn't in this run.

## Gaps and open findings (as of Oct 29)

1. ~~**Step P isn't in the repo.**~~ Fixed (T73): QA's probe is now `scripts/pilot-e2e.mjs` (`npm run pilot-e2e`), last in `npm run gate`. Same 31 checks. It stops with a clear message if the pilot folder or `dist-test/` is missing.
2. **Known save-safety gaps**, written as `it.fails` in `tests/saveSafety.qa.test.ts`:
   - Without the recovery folder's handle (file-input fallback), the app can't refuse an empty subfolder of the recovery folder (line 85).
   - In the same fallback, the app can't refuse a recovery folder that sits inside `<chosen>/Keepsake photos` (line 88).
   - In the same fallback, when the files have no `directoryHandle`, the answer is "not inside" (line 92).
   - A file created between the last name check and `move()` could be replaced (line 249).

   With the folder picker (Chrome's normal path), step 9 shows the first two are refused.
3. ~~**e2e is flaky on one check**~~ Fixed (T73): the check now waits up to 2 s for "Now keeping …". Was (minor, test only). `scripts/e2e.mjs:410` reads the results screen's live region once, straight after "Keep these files", and doesn't wait. The app fills that region in a `useEffect` after the render (`src/ui/Results.tsx:50-55`), so the read can come too early. Today it failed in 1 of 5 runs (`[phone] ledger change not announced (got "")`). The text did arrive: step P waits up to 2 s and found it in all 3 runs. Fix: wait for the text, for example `await expect.poll(...)` or `page.locator('main [role=status]').filter({ hasText: /^Now keeping/ }).waitFor()`.
4. ~~**Browser scripts can leave a preview server running**~~ Fixed (T73): the three scripts (and `pilot-e2e.mjs`) start the server and the browser inside `try/finally`, and stop the server on Ctrl-C too. Was (minor, test only). `scripts/e2e.mjs:18`, `offline-check.mjs:23` and `a11y-check.mjs:617` start `vite preview` *before* `chromium.launch` (lines 368, 26 and 619), outside `try/finally`. If the launch fails (for example, `CHROMIUM_PATH` isn't set), the server keeps its port and the next run fails with "port in use". Fix: start the server inside the `try`, or launch the browser first.
5. **Steps 5–9 run the production build (`dist/`). The owner's sessions use the test build (`dist-test/`).** The two differ only in the page title and the example-files button. Step P is the only step that runs the test build.
6. ~~**A doc fix for `pilot-folder.md`.**~~ Fixed (Oct 29): the G1 lines now say the year chips show only the year, and the results screen shows up to 3 months of the chosen year. They also say no screen shows a year total: the facilitator adds up the months in the review timeline's "Jump to a month" list (photos + videos: 28, 38, 44, 33, 29, 22). The G2 line says the same for 2022's 44. The engine's photo-only numbers (27, 37, 42, 32, 28, 22) stay, marked as engine numbers from step 4. Was: the G1 line "The chips count photos only: 2024 27, 2023 37 …" read as if the year chips show counts.

## Latest run

**Nov 9, 2026, QA, commit `dc08416`** (T74: gate rerun on main after the T83 redo; evidence only, the owner passes the gate). Linux sandbox, Node 22.23.4, Playwright 1.64.1, Chrome for Testing 153.0.8010.12 (`CHROMIUM_PATH=/opt/pw-browsers/chromium`). PhotoRec 7.1 and pillow-heif 1.8.1 installed for step 0.

`git diff 79f98c9..HEAD --stat -- src/`: 23 files, all in `src/App.tsx`, `src/ui/` and `src/assets/`. **Nothing in `src/engine/` or `src/worker/` changed.** The save screen (`src/ui/Save.tsx`) changed only in UI wiring: "Sort another folder" (`onStartOver`), focus on the problem heading, the month in the progress line, the span line. The same refusal checks run as before. `src/ui/timeline.ts` adds counts of the files left out. `src/App.tsx` `startOver` now stops the scan worker and drops cached previews.

| # | Result |
|---|---|
| 0 | Built with real PhotoRec 7.1 in about 3.9 min: **523 files**, key groups keep 214 (208 photos, 6 videos), small 204, duplicate 22, damaged 2, system 81. Zip 92.0 MB. |
| 1–P | `npm run gate`: **exit 0, first try, about 9 min 16 s.** |
| 1 | 24 test files passed. **325 passed, 4 expected fail, 1 skipped** (330). |
| 2 | `build` and `build:test` exit 0, 30 files precached in each. |
| 3 | 1510 files (keep 363, small 660, duplicate 168, damaged 119, system 200). |
| 4 | **Fixture:** wrongly set aside **0/363 (0.00%)**, junk in Keep **0/363 (0.00%)**, all on the diagonal. **Pilot:** 523 checked, kept 214 (208 photos, 6 videos), set aside 309 { small 204, duplicate 22, damaged 2, system 81 }, wrongly set aside **0/214**, junk in Keep **0/214**. After keeping previews 418 / 105. Timeline 2022 has 44 in 12 months, No date 20 (224 with previews). Card eval skipped (no `CARD_DIR`). |
| 5 | Passed. Ledgers add up at desktop, phone and 200% zoom (1510 = 363 + 1147; 1023 + 487). Receipt 362 saved / 0 failed each time. Desktop folder: 362 copies. Phone and 200%: 362-file zip, `unzip -t` OK. "No console errors." "No requests left this computer." |
| 6 | `OFFLINE CHECK PASSED`, 17 PASS lines. All 30 precached files load offline. Every offline request was answered by the service worker. **Zero requests to other origins.** |
| 7 | `0 serious, 0 minor, 0 info`, 435 checks passed. |
| 8 | Pilot folder: `0 serious, 0 minor, 0 info`, 430 checks passed. |
| 9 | `OPFS probes: all refusal and safety expectations met`. The recovery folder, `recup_dir.2`, `a/b/c/d/e` and an empty subfolder were all refused with "That folder is part of your recovery folder.". A folder whose check throws was refused with "We couldn't check that folder.". The parent folder was allowed (3 saved). |
| P | **`PILOT E2E: 77/77 checks passed.`** (The script now has 77 checks, up from 31, including the T83 start-over checks.) Test build. G1 523 / 214 / 309. T3 418 / 105, announced. G2: 44 selected, 44 saved / 0 failed, 12 month folders under `Keepsake photos/2022/`. Saves into the recovery folder and `recup_dir.2` were refused. Recovery folder after: 523 files, names and sizes unchanged, and still unchanged after "Sort another folder". No console errors. **Zero requests to other origins.** |
| T100 | `node scripts/small-scan-check.mjs --runs 10`: 1, 2 and 3 files each 10/10 finished, **0 stuck**. `SMALL-SCAN CHECK PASSED`. |
| 10 | **523 files, 0 differ from the key** (SHA-256), run last. Also byte-identical to a SHA-256 snapshot taken before the gate. `fixtures/recovery` (1510 files) is byte-identical to a fresh seeded regeneration in a separate folder. |

No new findings. The step table above still says "31/31" for P. It's now 77/77.

**Oct 29, 2026, QA, commit `a369d34`** (health check after the Oct 28 PhotoRec guide change, f4a3f12; not T74). Linux sandbox, Node 22.23.4, Chrome for Testing 153.0.8010.12, PhotoRec 7.1 and pillow-heif 1.8.1. Step 0 built the pilot folder with real PhotoRec in about 4.3 min: 523 files. `npm run gate` passed end to end on the first try in about 6 min 39 s. Tests: 261 passed, 4 expected fail. Fixture: 0/363 wrongly set aside, 0/363 junk in Keep. Pilot: 214 kept, 309 set aside, 0 wrongly set aside. Both accessibility runs: 0 serious, 0 minor, 0 info. Zero outside requests. Ended with `PILOT E2E: 77/77 checks passed.` (77 since the T83 start-over checks; was 31) Step 10: 523 files, 0 differ from the key. No new findings.

**Oct 27, 2026, after T73** (developer): `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run gate` passed end to end, 1 of 1 run, about 6 min 41 s, ending `PILOT E2E: 77/77 checks passed.` (77 since the T83 start-over checks; was 31) `npm run e2e` then passed 5 of 5 in a row and `npm run pilot-e2e` 3 of 3. Step 10 afterwards: 523 files, 0 differ from the key. QA's earlier run of the same day is below.

**Oct 27, 2026**, QA, commit `ec739fc` with `package.json` changed (the `gate` script added, not yet committed). Linux sandbox, Node 22.23.4, Chrome for Testing 153.0.8010.12 (`CHROMIUM_PATH=/opt/pw-browsers/chromium`), PhotoRec 7.1 and pillow-heif 1.8.1 installed for step 0. Each step ran on its own first. `npm run gate` then ran once and stopped at step 5 (the flake in finding 3), so steps 5–9 were rerun separately.

| # | Result |
|---|---|
| 0 | Built with real PhotoRec 7.1 in about 4.5 min: **523 files** (`recup_dir.1` and `recup_dir.2`), key groups keep 214, small 204, duplicate 22, damaged 2, system 81. Zip 92.0 MB (the doc says 91.7 MB, probably a different zlib; contents match the key). |
| 1 | 17 test files passed. **261 passed, 4 expected fail** (the known gaps), 265 in all. Same result in the `gate` run. |
| 2 | `build` and `build:test` exit 0. 25 files precached in each. |
| 3 | 1510 files (keep 363, small 660, duplicate 168, damaged 119, system 200). |
| 4 | **Fixture:** 1510 checked. Wrongly set aside **0/363 (0.00%)**, junk in Keep **0/363 (0.00%)**, and the confusion matrix is entirely on its diagonal. **Pilot:** 523 checked. **Kept 214** (208 photos, 6 videos), **set aside 309** { small 204, duplicate 22, damaged 2, system 81 }. Wrongly set aside **0/214**, junk in Keep **0/214**. Results years 2024:27 2023:37 2022:42 2021:32 2020:28 2019:22, No date chip 20. After keeping previews: 418 / 105. Timeline **2022 has 44** (01:6 02:4 03:4 04:3 05:5 06:1 07:5 08:6 09:2 10:4 11:3 12:1), **No date 20** (224 with previews). Card eval skipped (no `CARD_DIR`). |
| 5 | **4 of 5 runs passed**. Each passing run had all ledgers adding up at desktop, phone and 200% zoom (1510 = 363 + 1147; 1023 + 487 with previews kept), receipt 362 saved / 0 failed, 362 copies in the folder at desktop, and a 362-file zip that passed `unzip -t` on phone and 200% zoom. Each printed "No console errors." and "No requests left this computer.". Run 2 (inside `npm run gate`) failed on one line only: `[phone] ledger change not announced (got "")`, finding 3. That run also had zero outside requests. |
| 6 | **Passed, 2 of 2 runs.** 16/16 checks. Offline scan of 1511 files (fixture plus a HEIC) in 1.6 s and 2.0 s. HEIC decoded offline. All 25 precached files load offline. **Zero requests to other origins.** |
| 7 | **Passed, 2 of 2 runs.** `0 serious, 0 minor, 0 info`, with 400 and then 405 checks passed (the count varies with how many tiles are drawn). **Zero axe violations.** |
| 8 | **Passed, 2 of 2 runs.** `0 serious, 0 minor, 0 info`, 400 checks passed, including **51 screen states with "axe: no violations"**. |
| 9 | **Passed, 2 of 2 runs.** Recovery folder, `recup_dir.2`, `a/b/c/d/e` and an empty subfolder were all refused with "That's your recovery folder.". A folder whose check throws was refused with "We couldn't check that folder.". The parent folder was allowed (3 saved), and no file appeared in the recovery folder. |
| P | **Passed, 3 of 3 runs, 31/31 checks.** Test build (title "Scan · Keepsake (test)", no example-files button), 523 files copied into OPFS, scan about 1 s. Every G1, T2, T3, T4, G2 and T6 number in the mapping table matched. G2 saved **44, 0 failed**: 44 files under `Keepsake photos/2022/` in 12 month folders (e.g. `2022/12 December/2022-12-25 10.10.mp4`, `2022/11 November/2022-11-27 08.12.heic`). The recovery folder and `recup_dir.2` were refused. Recovery folder after: **523 files, names and sizes unchanged**. No console errors. **Zero requests to other origins.** (The first two drafts of the probe had wrong selectors of my own. Those were fixed before these 3 runs.) |
| 10 | **523 files, 0 differ from the key** (SHA-256), after all of the above. |

## Zip save check (T89, Nov 3)

**Nov 3, 2026, QA, commit `99359ea`** (risk R5: Safari and Firefox can't save to a folder, so they get zip downloads). Linux sandbox, Node 22.23.4, Chrome for Testing 153.0.8010.12, Playwright 1.64.1.

**Browsers: Chromium only.** `npx playwright install firefox webkit` failed: the network proxy refused both download hosts (403 from `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`). Playwright stayed at 1.64.1. Instead, an init script deleted `showDirectoryPicker`, `showOpenFilePicker` and `showSaveFilePicker` (`'showDirectoryPicker' in window` was false), so the app took the same branch Firefox and Safari take: `canSaveToFolder()` false, then the zip card, then `saveAsZip`. **Real Firefox and Safari were not tested.**

**Rerun:** `npm run build && LANG=C.UTF-8 node scripts/qa-zip-check.mjs <recoveryDir> --exe <chrome> [--labels <labels.json>] [--stop-after <ms>] [--keep]`. The script scans the folder through the file input and saves all kept files as zips. It then runs `scripts/qa-zip-check.py`, which checks:
- `unzip -t` and Python `zipfile.testzip()` on every zip.
- The entry count against the receipt's Saved number.
- Each entry's SHA-256 against the recovery folder (and no source file zipped twice).
- The layout: `Keepsake photos/YYYY/MM Month/YYYY-MM-DD HH.MM[ (n)].ext` with the folder matching the name, plus the Exif date of each dated JPEG. Also the receipt's "Sorted into" line and the review timeline's per-month counts.
- That names are safe: no characters illegal on Windows, no reserved names, no trailing dot or space, no `..` or absolute paths, NFC, no case-only clashes, each part at most 255 bytes, and the full path at most 160 characters (it flags longer paths).
- That the recovery folder is unchanged: every file's size, mtime and SHA-256, the folder list and the root mtime.

**Use a UTF-8 locale.** Under `LANG` unset (POSIX), Chromium on Linux gets `NotReadableError` (size 0) for every file with a non-ASCII name, and the app sets those aside as "Damaged or incomplete". That comes from this environment, not the app. With `LANG=C.UTF-8` the same files are kept and zipped correctly.

| Folder | Checked / kept / receipt saved | Zips (bytes) | Entries = receipt | Bytes match source | Layout vs app | Names | Recovery folder after | Scan / zip build / on disk | Peak PSS (scan / save) |
|---|---|---|---|---|---|---|---|---|---|
| Synthetic fixture (`npm run fixture`, 1,407 files, no HEIC) | 1,407 / 323 / 323, 0 failed | 1: `Keepsake photos.zip` (53,097,209) | 323 = 323; unzip -t OK; zipfile OK | 323/323 | "13 years, 89 months, plus No date (80)" on the receipt and in the zip; timeline months equal; 243/243 dated JPEGs match Exif | all safe; longest 54 chars | 1,407 files unchanged | 2.9 s / 1.4 s / 1.4 s | 440 / 462 MB |
| 5,000 files (`make_perf_folder.py --files 0 --big 600 --heic 200`, first 10 `recup_dir`s, 2.2 GB, no HEIC) | 5,000 / 1,387 / 1,387, 0 failed | 2: `1 of 2` (1,995,327,738), `2 of 2` (162,033,486); 2,157,361,224 in all | 1,387 = 1,387; unzip -t OK; zipfile OK | 1,387/1,387 | "10 years, 120 months, plus No date (460)" on both; timeline equal; 927/927 Exif match | all safe; longest 54 | 5,000 unchanged | 13.1 s / 15.8 s / 25.0 s | 486 / 698 MB |
| Awkward names (37 files: reserved names, `:*?|<>"\`, tab, newline, NFD and NFC "Café Noël", CJK, emoji, a 240-character name, 120×"é", case clashes, nested folders, no extension, 0-byte, cut-off, bad dates) | 35 (2 dotfiles skipped on purpose, `src/App.tsx:39`) / 33 / 33 | 1 (7,632,869) | 33 = 33; OK | 33/33 | "1 year, 1 month, plus No date (30)" on both; timeline equal | 1 flagged: a 204-character path (finding 2) | 37 unchanged | 1.0 s / 0.4 s / 0.4 s | n/a |
| 5,000 files, **Stop after 4 s, then Save the rest** | 1,387 / 1,387 | 2: `1 of 2` (614,218,901) and **`Keepsake photos.zip`** (1,543,142,323) | 1,387 = 1,387; OK | 1,387/1,387, none twice | equal | safe | unchanged | stopped at 351 of 1,387 | 609 / 833 MB |
| Fixture, **Stop after 0.5 s, then Save the rest** | 323 / 323 | 2, **both named `Keepsake photos.zip`** | 323 = 323; OK | 323/323 | equal | safe | unchanged | stopped at 190 of 323 | n/a |

How each field was measured:
- **Times:** wall clock in a headless browser. "On disk" includes Playwright copying each download out of its temporary folder.
- **PSS:** the whole process tree, sampled every 500 ms. That tree includes the `vite preview` server and the Playwright driver, so the browser alone used less.
- **Memory on the 5,000-file run:** no memory problem. The zips are Blobs that point at the original Files, so the 2.16 GB of zips raised the peak by only about 210 MB over the scan.
- **Labels:** every zipped file was a `keep` in the answer key (323/323 and 1,387/1,387).
- **Network:** zero requests from the page to other origins in every run.
- **Part size:** part 1 of 2 is 1,995,327,738 bytes, under the 2,000,000,000 limit.

### Findings

1. **Major (wording and file names, no data loss): after Stop then "Save the rest", the zip names don't match what the Done screen says.**
   - **Cause:** `src/ui/Save.tsx:186` names each part `s.zipName(i, parts.length)`, where `parts` holds only the remaining files.
   - **Single-part save:** both downloads are called `Keepsake photos.zip`. Chrome saves the second as `Keepsake photos (1).zip`.
   - **Two-part save:** you get `Keepsake photos 1 of 2.zip`, then `Keepsake photos.zip`.
   - **Done screen:** `findZip(zips.length)` (`src/ui/copy.ts:770-773`) says "look for Keepsake photos 1 of 2.zip to Keepsake photos 2 of 2.zip". In both cases no file has that name. The "Download zip file 2 of 2 again" button then downloads one named `Keepsake photos.zip`.
   - **Repro:** `LANG=C.UTF-8 node scripts/qa-zip-check.mjs fixtures/recovery --exe <chrome> --stop-after 500`. It exits 1 with "the app gave two downloads the same name".
   - **Fix:** name parts per save session, not per run. For example, number them on from `sess.zips.length` (`Keepsake photos 2.zip`), or name them from the saved and total counts. Build the Done text from the names in `sess.zips`, not from a count.
2. **Minor: names are capped at 180 UTF-16 code units, not bytes, and the path isn't capped.** This is `safeName` in `src/ui/savePlan.ts:56-59`.
   - **Seen:** a 240-character name became a 204-character path inside the zip, `Keepsake photos/No date/xxx…(180).jpg`. Windows Explorer extracts into a folder named after the zip, so the full path becomes `C:\Users\<name>\Downloads\Keepsake photos\Keepsake photos\No date\…`. That is about 250 characters, close to the 260 limit (MAX_PATH).
   - **From the code, not reproduced:** 180 CJK or emoji characters are 540+ UTF-8 bytes, over the 255-byte name limit on macOS (APFS) and Linux. Such a source can only come from NTFS. The Linux test folder can't hold that name, so I didn't test it.
   - **Who it affects:** only "No date" files with long original names. PhotoRec names files `f<number>.ext`.
   - **Fix:** cap names by UTF-8 bytes (for example 150) and keep the whole path inside the zip under about 160 characters.
3. **Minor (test setup): `npm test` fails 1 test**, in another agent's leftover worktree. Vitest's `tests` filter also matches `.claude/worktrees/agent-a23d9d648a17a5266/tests/previewQueue.test.ts`, which can't find `node_modules` there.
   - **Repo's own tests:** `npx vitest run tests --exclude '.claude/**'` gives 19 files, **271 passed, 4 expected fail**.
   - **Fix:** add `.claude/**` to vitest's `exclude`, or remove the stale worktree.
4. Notes, not bugs:
   - Files whose names start with `.` are skipped as OS clutter (by design).
   - On Linux, Chromium itself turns `\` in a name into `/` in `webkitRelativePath`, so `back\slash.jpg` was saved as `slash.jpg`. The bytes were right.
   - Exif dates before 1990 or after 2100, and invalid dates, go to No date (by design, `src/engine/scan.ts:80`).
   - A file the browser can't read is reported as "Damaged or incomplete" ("Part of each file is missing"). That wording is wrong for a read error such as a lost permission or an unplugged drive. Seen only through the POSIX-locale problem above.

### Still to do
- Real Firefox and real Safari, especially Safari on a Mac. Check that the downloads aren't blocked or renamed, that a 2 GB Blob downloads, that a ~2 GB part opens in Archive Utility and in Windows Explorer, and how each browser renames a second `Keepsake photos.zip`.
- HEIC in the zip. pillow-heif isn't installed here, so neither folder had HEIC files.
- A real PhotoRec card (`CARD_DIR`), and folders over 2,000 kept files or with a single file over 2 GB (a part of its own, ZIP64). ZIP64 is covered only by unit tests.

### Acceptance re-check of the fix (Nov 3, QA, `d4e1755` + uncommitted T89 fix)

**Verdict: REJECT, one major.** "Save the rest" naming and the byte cap are fixed and nothing regressed. But Stop, then "Back to review", then Save again still gives two downloads the same name, and the Done screen then points at the old partial zip (finding 5).

Same environment as above (Chrome for Testing 153.0.8010.12, `LANG=C.UTF-8`, file-input branch with the folder pickers deleted).

| Run | Zips (names as downloaded) | Entries = receipt | Bytes match | Done text and "again" buttons | Recovery folder |
|---|---|---|---|---|---|
| Fixture, no stop | `Keepsake photos.zip` | 323 = 323 | 323/323 | match | 1,407 unchanged |
| Fixture, Stop after 0.5 s (181 of 323), Save the rest | `Keepsake photos.zip`, `Keepsake photos 2.zip` | 323 = 323 | 323/323 | match ("these 2 zip files: …") | unchanged |
| 5,000 files, no stop | `1 of 2`, `2 of 2` (2,157,361,224 bytes) | 1,387 = 1,387 | 1,387/1,387 | match | 5,000 unchanged |
| 5,000 files, Stop after 4 s (467), Save the rest | `1 of 2`, `Keepsake photos 2.zip` | 1,387 | 1,387/1,387 | match | unchanged |
| 5,000 files, Stop after 0.2 s (24) / 0.6 s (56), Save the rest (2 parts) | `1 of 2`, `Keepsake photos 2.zip`, `Keepsake photos 3.zip` (both runs) | 1,387 | 1,387/1,387, none twice | match | unchanged |
| Long names (20 files, scratchpad `longnames`) | `Keepsake photos.zip` | 20 = 20 | 20/20 | match | unchanged |

- **Long names in a zip:** the longest name is 123 characters or 152 bytes (with ` (n)`), and the longest path is 147. Names equal after the cut, and names differing only by case, got `(2)`…`(5)`. `con.` + 200×`y` became `_con.…` (120 characters).
- **Long names in a folder** (`scripts/qa-save-longnames-opfs.mjs`, real OPFS): the folder was seeded with the cut names and with case variants (`É`×72). The run ended "done", with 22/22 saved and 0 failed. All 4 existing files were byte-for-byte unchanged, and the new copies started at `(3)`. There were no case-insensitive clashes and no temporary files. The longest name was 123 characters or 152 bytes.
- **Largest first** (`scripts/qa-largest-first.mjs`):
  - Fixture, 4 rows unticked: 319/4 in both views, and 319 in the month counts. The bar said "49.8 MB to save", and so did the ledger and the Save screen's Size to save. 319 saved. The 4 files missing from the zip were exactly the unticked ones (by size rank, SHA-256).
  - 5,000 files, 5 rows unticked: 1,382/5. The bar showed "2.1 GB", and so did the ledger and the Save screen. 1,382 saved, and the missing 5 were exactly the unticked ones.
- **safeName, 200,000 random names against the old code:** 0 differences for names of at most 119 characters and 149 bytes. None was over 150 bytes or 120 characters, and none was unsafe on Windows. Note: the cut starts above 149 bytes, not 150.

5. **Major: Stop, then "Back to review", then Save again gives duplicate zip names, and the Done text names the old partial zip.**
   - **Cause:** `sess` (and so `zipNamesFor(sess.zips.length, …)`, `src/ui/Save.tsx:74-79,178`) is per mount of `<Save>`. `src/App.tsx:200` unmounts it on Back.
   - **Fixture:** the downloads were `Keepsake photos.zip` (246 files, partial) and `Keepsake photos.zip` (all 323).
   - **5,000 files:** `Keepsake photos 1 of 2.zip` (464, partial), then `1 of 2` again, then `2 of 2`. Done says "look for Keepsake photos 1 of 2.zip to Keepsake photos 2 of 2.zip". Chrome saves the new part 1 as `… (1).zip`, so the Done text leads to the partial one, which is missing several hundred photos. No file is lost: they're in the `(1)` zip and in the recovery folder.
   - **Repro:** the scratchpad script `backvisit.mjs` (fixture, stop at 500 ms; perf5k, stop at 4000 ms).
   - **Fix:** keep the count of zips downloaded in this page session above `<Save>`, in `App` or a module, and number on from it.
6. **Minor (copy):** after a resume, `Keepsake photos 1 of 2.zip` sits next to `2.zip` and `3.zip`, but there are 3 zips. The UX writer check is already flagged.
7. **Minor (T60 copy):** a Largest first row's name keeps the date view's position, for example "6 MB. Save video with no date (207 of 460)". Here that number means nothing.
8. **Minor, existing before this change, not regressions:**
   - `RESERVED` (`src/ui/savePlan.ts:51`) misses `CON .jpg` (space before the dot), `COM¹`/`COM²`/`COM³` and `CONIN$`/`CONOUT$`.
   - Lone surrogates pass through `safeName`, so 2 such names could become the same U+FFFD name in a zip.

### Second acceptance re-check (Nov 3, QA, after the ZipLog rework)

**Verdict: REJECT, one major (finding 9).** Naming is now unique across the page session in every sequence I tried, Done text and buttons match the real downloads, and uninterrupted saves are unchanged apart from "part N". But the earlier-zip note can claim "Everything in it is also in the zip file above" when none of it is, after Start over and a scan of a different folder.

New rerunnable check: `LANG=C.UTF-8 node scripts/qa-zip-sequence.mjs --exe <chrome> <steps…>` (steps: `scan=<dir> review save stop=<ms> rest back results startover untick=<k> done`). It fails on any duplicate download name in the session, on a Done text, list or "again" button that doesn't name exactly that visit's zips, on an earlier note that names the wrong zips, on an earlier note whose claim is false by content (SHA-256 of the entries), and on any change to a recovery folder.

| Sequence | Downloads (in order) | Done text / earlier note | Result |
|---|---|---|---|
| Fixture: save, Stop 0.5 s, Back, Save | `Keepsake photos.zip`, `… part 2.zip` | "look for … part 2.zip"; note: earlier zip, "Everything in it is also in the zip file above" (true) | OK |
| Fixture: save, Stop 0.6 s (264), Back, untick 40, Save | `Keepsake photos.zip`, `… part 2.zip` | note: "It has some photos and videos that aren't in this save" (true); 283 saved | OK |
| 5,000: save, Stop 4 s (434), Back, Save | `part 1`, `part 2`, `part 3` | "these 2 zip files: part 2 and part 3"; note on part 1, "Everything … also in" (true) | OK |
| 5,000: save, Stop 0.3 s, Back, save, Stop, Save the rest, Stop, Back, Save | `part 1` … `part 5`, all different | "part 4 and part 5"; note names parts 1-3, "Everything … also in" (true) | OK |
| 5,000: save, Stop 0.2 s (11), Save the rest | `part 1`, `part 2`, `part 3` | "part 1.zip to part 3.zip"; no note | OK |
| 5,000 / fixture, no stop | `part 1`, `part 2` / `Keepsake photos.zip` | match | OK |
| **Fixture: save, Stop 0.5 s (231), Back, Back to Clean up, Scan a different folder, scan a 1,500-photo folder, Save** | `Keepsake photos.zip`, `… part 2.zip` | note: "Keepsake photos.zip is from an earlier save that didn't finish. **Everything in it is also in the zip file above.**" Content: **231 of 231** earlier files are not in this save. | **FAIL** |

The zip check (`qa-zip-check.mjs`), with the Done and "again" check, gave the same verdict for every run:
- Exit 0, 0 fails, 0 outside requests, recovery folder unchanged.
- Fixture: 323/323 bytes match.
- Fixture with Stop at 0.5 s (151 saved): `Keepsake photos.zip` and `part 2`.
- 5,000 files: `part 1` and `part 2`, 1,387/1,387.
- 5,000 files with Stop at 4 s (439 saved): `part 1` and `part 2`.
- 5,000 files with Stop at 0.2 s (18 saved): `part 1` to `part 3`.
- Long names: 20/20, longest path 147.

The other checks:
- `backvisit.mjs` gave no duplicates: fixture `Keepsake photos.zip` and `part 2`, and 5,000 files `part 1` to `part 3`.
- Largest first: OK on the fixture (49.8 MB in the bar, the ledger and the Save screen; 319 saved) and on 5,000 files (2.1 GB; 1,382 saved; the unticked files were missing by SHA-256). Row names no longer have "(n of m)".
- Long names in a folder (OPFS): OK, 22/22 saved, 4 existing files unchanged.
- `safeName`, 200,000 random names against the old code: 0 unexpected differences. The only differences were long names, the new reserved forms and lone surrogates. None was over 150 bytes or 120 characters, and none was unsafe on Windows. `con .jpg` → `_con .jpg`, `COM¹.jpg` → `_COM¹.jpg`, `conin$.jpg` → `_conin$.jpg`, and lone surrogates → `_`.

Commands:
- `npm test`: 19 files, 295 passed, 4 expected fail.
- `npm run lint`: exit 0, 1 warning (`src/ui/Preview.tsx:68`, file not in this change).
- `npm run build` and `tsc -b`: OK.
- `scripts/e2e.mjs`: exit 0, `Keepsake photos.zip` 322 files, `unzip -t` OK.
- `qa-save-opfs`: all expectations met.
- `offline-check`: PASSED.
- `a11y`: 0 serious, 0 minor, 0 info; 422 checks passed.

9. **Major: the earlier-zip note says a zip from a different scan is fully covered by this save.**
   - **Cause:** `ZipLog` is module-wide (`src/ui/Save.tsx:38`). `leftovers()` (`src/ui/savePlan.ts`, `covered`) compares `FileRecord.index` values, but indexes restart at 0 with every scan.
   - **What happens:** after "Scan a different folder" (`src/App.tsx:185`), the old scan's zip ids (all under 1,407) are all "saved" in a new folder with 1,500 kept files. The note then tells the person the earlier zip's photos are all in the new zip. They aren't (231/231 missing), so the person may delete the only zip copy of those photos.
   - **Repro:** `LANG=C.UTF-8 node scripts/qa-zip-sequence.mjs --exe <chrome> scan=fixtures/recovery review save stop=500 back results startover scan=<1,500-JPEG folder> review save done`. The folder was made by the scratchpad `longnames-gen/many.py <dir> 1500`.
   - **Fix:** keep the name counter page-wide, but tag each zip with its scan and only count or compare zips from the current scan. Zips from another scan should either get no note, or a note that says they're from another folder, never "covered".
10. **Minor (a11y, copy):** without "(n of m)", Largest first rows of the same size and kind now have the same checkbox name (e.g. 3 × "5.9 MB. Save video with no date, 42 seconds long"). A screen reader user can't tell them apart. Something like the file's own name or its folder could be added.
11. **Note:** names restart at `Keepsake photos.zip` after a page reload. The browser then renames it `… (1).zip`, and the Done text can't know that. This is a known limit and not a blocker.

### Third acceptance re-check (Nov 3, QA, after the scan-aware ZipLog)

**Verdict: ACCEPT for the save fix (findings 1, 9 and 10 resolved), with one required fix before commit.** `npm run a11y` is red: 2 serious. That's a test-script mismatch, not an app problem (finding 12).

`scripts/qa-zip-sequence.mjs` now expects earlier notes only for zips of the same scan (agreed behaviour, Lead's call). It still checks every note's claim against the zip contents (SHA-256). Every sequence exited 0 with no duplicate names, Done text and buttons matching the real zips, and recovery folders unchanged:

| Sequence | Downloads | Earlier note |
|---|---|---|
| Fixture: Stop at 0.5 s (237), Back, Save | `Keepsake photos.zip`, `part 2` | "Everything in it is also in" (true) |
| Fixture: Stop at 0.6 s (279), Back, untick 40, Save (283) | `Keepsake photos.zip`, `part 2` | "some … aren't in this save" (true) |
| Fixture: Stop at 0.5 s, Back, Scan a different folder (1,500 photos), Save | `Keepsake photos.zip`, `part 2` | none (other scan) |
| Fixture: Stop, Back, Scan a different folder: **the same fixture again**, Save | `Keepsake photos.zip`, `part 2` | none (other scan) |
| Fixture: Stop, Back, new scan of the 1,500-photo folder, Stop (216), Back, Save | `Keepsake photos.zip`, `part 2`, `part 3` | names only `part 2`, "Everything … also in" (true) |
| Fixture, Stop, then 1,500-photo folder, Stop, then fixture again, Stop (254), Back, untick 40, Save | `Keepsake photos.zip`, `part 2` … `part 4` | names only `part 3`, "some … aren't" (true) |
| 5,000: Stop at 4 s (467), Back, Save | `part 1` … `part 3` | `part 1`, "Everything … also in" (true) |
| 5,000: Stop, Back, Save, Stop, Save the rest, Stop, Back, Save | `part 1` … `part 5` | parts 1-3, "Everything … also in" (true) |
| 5,000: Stop at 0.2 s (21), Save the rest | `part 1` … `part 3` | none |
| 5,000 / fixture, no stop | `part 1`, `part 2` / `Keepsake photos.zip` | none |

From the code:
- "Covered" can only be claimed for zips of the same scan, keyed `scan:index`. The scan id is `run.id`, which goes up on every scan and is never reused (`src/App.tsx`). Within one scan, an index is the same `File`.
- A file that failed in the current save isn't in `saved`, so the note then says "some … aren't".

I found no sequence that gives a false "covered".

Other runs:
- **Zip check:** exit 0 for every run, 0 fails, 0 outside requests, recovery folder unchanged.
  - Fixture: 323/323.
  - Fixture, Stop at 0.5 s (229 saved): `Keepsake photos.zip` and `part 2`.
  - 5,000 files: `part 1` and `part 2`, 1,387/1,387.
  - 5,000 files, Stop at 4 s (465 saved): 2 zips.
  - 5,000 files, Stop at 0.2 s (21 saved): 3 zips.
  - Long names: 20/20.
- **Largest first:** OK. Fixture: 49.8 MB in the bar and on the Save screen, 319 saved. 5,000 files: 2.1 GB, 1,382 saved. Rows are now named e.g. "6 MB, f4448889.mp4. Save video with no date, 42 seconds long".
- **Long names in a folder (OPFS):** OK.

Commands:
- `npm test`: 19 files, 297 passed, 4 expected fail.
- `npm run lint`: exit 0, 1 warning (`src/ui/Preview.tsx:68`).
- `npm run build` and `tsc -b`: OK.
- `e2e`: exit 0, `Keepsake photos.zip` 322 files, `unzip -t` OK.
- `qa-save-opfs`: all expectations met.
- `offline-check`: PASSED.
- `a11y`: **exit 1, 2 serious, 420 checks passed.**

12. **Required before commit (test script, not the app):** `scripts/a11y-check.mjs:525` and `:538` match row names with `/^… (KB|MB…)\. Save /`. The new name has the file name after the size ("6 MB, f4448889.mp4. Save …"), so these two serious checks now fail:
    - "rows named size first and listed biggest first"
    - "Tab reaches every row (0 of 323)"

    A temporary copy with both patterns changed to also accept `, <file>` passed: **0 serious, 0 minor, 0 info, 422 checks**. The copy was then deleted, and the real script is unchanged. The owner of the a11y check should update the 2 patterns.

## Sign-off

**Phase 3 gate passed — Nov 10, 2026, by the owner (in chat).** Signed off on the Nov 9 evidence above (QA rerun on `dc08416`). The review filters merged afterwards (T50/T59, `ba0689e`, fixed in `f0b2b16`) only change what is shown, never what is kept or saved (QA review, Nov 10); no full rerun was done on the later build.

## Phase 4 pre-check (Nov 11, QA, `6fca722`)

Early warning only, not the formal gate run (T96 runs on the release build). Chromium, 2 CPUs, 7 GB RAM.

- **Build:** `npm run build` OK, 30 precached files.
- **Scan speed (target: 40,000 files under 5 minutes): pass.** `scripts/make_perf_folder.py` → 40,000 files, 5.33 GB (900 full-size 12 MP JPEGs). `node scripts/perf-browser.mjs <chromium> <dir>/recovery --runs 3`: 36.0 s, 35.5 s, 36.5 s (median 36 s; Oct 19 was 51 s). Peak memory 1.24–1.26 GB. No outside requests; folder unchanged (name, size, mtime).
  - **Gap:** no HEIC in this folder (`pillow_heif` not installed). Install it before T96 so the 250 HEICs are in the mix.
- **Freeze after picking (T52): pass.** `--handoff --runs 3`: Chromium's own folder listing takes 4.0–4.9 s before the app gets the files (the app can't change that); after that, longest freeze 170–191 ms (pass line 250 ms), first progress 0.26–0.28 s, Stop answers in 0.49–0.71 s. Worst case is close to ~200 ms on a busy 2-CPU machine; watch it.
- **Privacy and offline: pass.** `npm run offline-check`: zero outside requests, no CSP violations, every offline request answered by the service worker, a HEIC decoded offline. `npm run e2e` twice: no console errors, no requests left the computer. `fixtures/recovery` hashed before and after (2,818 entries: content, size, mtime, permissions): identical.

## Nov 12, 2026, QA, commit `b9380d1` (T96 prep: HEIC in the perf folder)

Early evidence only, not the formal T96 run. Closes the Nov 11 gap (no HEIC in the 40,000-file folder). Chromium 153 (Chrome for Testing, /opt/pw-browsers), 2 CPUs, 7 GB RAM; load average 3–7 during runs (busy machine).

- **Setup:** `pip install pillow-heif --break-system-packages` (1.8.1, libheif 1.23.6); `import pillow_heif` OK. `python3 scripts/make_perf_folder.py <scratch>/recovery` (defaults: `--files 40000 --big 900 --heic 250`) → 40,000 files, 5.92 GB, 262 `.heic` (250 kept + 12 exact copies), all 4032×3024. With HEIC on, the generator's random sequence shifts, so this is not the Nov 11 folder plus 250 files; it is a new folder.
- **Builds:** the main checkout had uncommitted work in `src/` (leave guard: `App.tsx`, `Save.tsx`, `app.css`, `timeline.ts`, `leaveGuard.ts`). Measured twice: "working tree" = `npm run build` in the checkout; "clean" = `git archive b9380d1` into a scratch folder, `npm run build` there. Both 30 precached files. `npm test`: 388 passed, 3 expected fail.
- **Commands:** `node scripts/perf-browser.mjs <chromium> <dir>/recovery --runs 3` (working tree), `--runs 1` (clean); `--handoff --runs 3` (both).

| Check | Working tree | Clean `b9380d1` | Pass line |
|---|---|---|---|
| Scan time, 40,000 files | 50.4 s, 50.3 s, 46.3 s (median 50.3 s) | 46.3 s (1 run) | under 5 min: **pass** |
| Results ledger | 40,000 / 2,800 / 37,200 (all runs) | same | |
| Peak memory (all processes) | 1,352–1,396 MB | 1,395 MB | |
| Freeze after picking, longest | 207, 185, 261 ms (**FAIL**, one run over) | 200, 161, 203 ms (pass) | 250 ms |
| Browser's own listing before the app gets files | 4.9–5.3 s | 3.9–5.0 s | (app can't change) |
| First progress / Stop answered | 0.29–0.37 s / 0.91–0.97 s | 0.29–0.33 s / 0.81–0.95 s | |
| Screens with HEIC, of 15 jumps | 7 in every run; settle 1.3–6.5 s on those screens, 0.3–1.2 s without | 7; 1.7–4.9 s with, 0.5–2.2 s without | |
| Tiles left without a preview | only 12 MP4 (no HEIC) | same | |
| Preview load errors, console errors, outside requests | 0, none, 0 | 0, none, 0 | 0 |

- **HEIC outcome (engine in Node on the same folder, scored against `perf-labels.json`):** all 262 read as HEIC with a date and size. 250 kept, 12 set aside as exact copies. 2 of the "copy" ones are the other file of an identical pair (the label marks the first in the folder as the keeper; the engine kept the other one, same bytes). Whole folder: 2,800 in Keep = the 2,800 real photos/videos; 14 swapped pairs of that kind (12 JPEG, 2 HEIC), no real photo set aside, no junk in Keep. Scan in Node 4.9 s.
- **HEIC decoded in the browser:** yes. Every HEIC tile on the 7 jump screens painted a preview (no HEIC label left after settling); a HEIC screen takes 2–5 s longer to settle than a JPEG one.
- **Offline:** `npm run offline-check` (working-tree build): passed, zero outside requests, no CSP violations, HEIC decoded offline, every request answered by the service worker.
- **Folder unchanged:** the folder's listing (path, size, mtime, mode) had the same hash before and after all runs.
- **Watch:** freeze after picking is at the line (200–207 ms medians; one 261 ms on the working-tree build). n=3 on a loaded 2-CPU machine can't tell whether the leave-guard change is the cause or it's noise. T96 should run it on an idle machine, 5+ runs. Scan is ~10–14 s slower than Nov 11 (36 s); the folder is bigger (5.92 GB vs 5.33 GB, plus HEIC) and the load was higher.
