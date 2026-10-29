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
| P | `npm run pilot-e2e` (`scripts/pilot-e2e.mjs`; needs step 0 and `npm run build:test`) | `PILOT E2E: 31/31 checks passed.` The six pilot tasks on the test build, in Chromium, with every on-screen number matching the answer key (table below), **zero outside requests**, and the recovery folder's file names and sizes unchanged. |
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

**Oct 29, 2026, QA, commit `a369d34`** (health check after the Oct 28 PhotoRec guide change, f4a3f12; not T74). Linux sandbox, Node 22.23.4, Chrome for Testing 153.0.8010.12, PhotoRec 7.1 and pillow-heif 1.8.1. Step 0 built the pilot folder with real PhotoRec in about 4.3 min: 523 files. `npm run gate` passed end to end on the first try in about 6 min 39 s. Tests: 261 passed, 4 expected fail. Fixture: 0/363 wrongly set aside, 0/363 junk in Keep. Pilot: 214 kept, 309 set aside, 0 wrongly set aside. Both accessibility runs: 0 serious, 0 minor, 0 info. Zero outside requests. Ended with `PILOT E2E: 31/31 checks passed.` Step 10: 523 files, 0 differ from the key. No new findings.

**Oct 27, 2026, after T73** (developer): `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run gate` passed end to end, 1 of 1 run, about 6 min 41 s, ending `PILOT E2E: 31/31 checks passed.` `npm run e2e` then passed 5 of 5 in a row and `npm run pilot-e2e` 3 of 3. Step 10 afterwards: 523 files, 0 differ from the key. QA's earlier run of the same day is below.

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
