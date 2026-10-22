# Pilot recovery folder: "Recovered from old phone" (T65)

By QA, Oct 22, 2026. For the owner and whoever facilitates the Oct 26–27 pilot. Goes with the [usability test plan](usability-test-plan.md), sections 3–4.

The plan's "faster" option (section 3) said the team's synthetic folder has colour blurs that testers can't recognise. This folder replaces that for the pilot: the pictures are simple drawn landscapes (skies, mountains, lakes, beaches, city lights, fields, flowers; no people, no text), and the folder is real PhotoRec output, so the pilot doesn't wait on the owner's own photos. Use the real recovery of your own photos for rounds 1 and 2, as the plan says.

## The zip

- **File:** `Recovered-from-old-phone.zip`, 91.7 MB (about 92 MB unzipped). Share it by Google Drive. Unzipped, it's one folder, **Recovered from old phone**, holding `recup_dir.1` (501 files: 500 recovered plus PhotoRec's `report.xml`) and `recup_dir.2` (22 files): **523 files** in all. Write that number on the notes sheet: it's the file count to check before and after each session (plan, section 3 checklist).
- **How it was made:** the script draws the photos and makes the other files, lays them on a raw image of a quick-formatted 112 MB memory card (files on 32 KB clusters, file table gone), then runs **real PhotoRec 7.1** on it with its default options (`partition_none,wholespace,search`), as the team's PhotoRec guide tells people to. So the names (`f0016384.jpg`…), the 500-files-per-folder split, the file dates (PhotoRec dates a photo from its camera details; everything else gets the day it was recovered) and PhotoRec's own `report.xml` are PhotoRec's, not imitations.
- The zip and the generated files are not in git (they go in `fixtures/`, which is ignored).

## Answer key

What a perfect sorter does with the 523 files. The app matches all of it (see "Checked against the app" below).

| Group on the results screen | Files | What they are |
|---|---|---|
| **Kept** | **214** | 208 photos + 6 videos |
| Small preview copies | 204 | 150 gallery thumbnails (256 px), 30 Messenger previews (240–360 px, no details), 24 app icons |
| Exact copies | 22 | 18 camera photos and 4 Messenger photos that were on the card twice (one of each pair is kept) |
| Damaged or incomplete files | 2 | videos cut off part-way (later files were written over the rest) |
| App and system files | 81 | 40 app settings (.xml), 16 app databases (.sqlite), 11 app logs (.txt), 8 web cache pages (.html), 5 compressed logs (.gz), PhotoRec's `report.xml` |
| **Set aside in total** | **309** | |

**The 214 kept, by year** (photos have a camera date; videos carry a date in their own details):

| Year | Photos | Videos | In the review timeline |
|---|---|---|---|
| 2019 | 22 | 0 | 22 |
| 2020 | 28 | 1 | 29 |
| 2021 | 32 | 1 | 33 |
| **2022** | **42** | **2** | **44** |
| 2023 | 37 | 1 | 38 |
| 2024 | 27 | 1 | 28 |
| No date | 20 | 0 | 20 |

- **From 2022:** 38 Android camera photos (Samsung SM-A525F, Xiaomi Redmi Note 9), 4 iPhone 13 photos in HEIC format, and 2 videos (Apr 17 and Dec 25). By month: Jan 6, Feb 4, Mar 4, Apr 3, May 5, Jun 1, Jul 5, Aug 6, Sep 2, Oct 4, Nov 3, Dec 1.
- **No date (20):** 16 photos saved from Messenger (resized, every detail stripped: no date, no camera) and 4 phone screenshots. These are the photos for T4.
- **Cameras:** Samsung and OPPO (2019–20), Samsung and Xiaomi (2021–22), Samsung and iPhone 13 (2022–24). 10 photos are iPhone HEIC files (4 from 2022, 3 from 2023, 3 from 2024).
- **Videos:** 6 short (4–6 second) H.264 MP4s, 1280x720, a slow pan across a landscape with quiet background noise. They play in Chrome.
- **Not in the folder:** 4 photos on the card were also cut off, but PhotoRec 7.1 with default options checks photos and throws away ones that stop early, so they never reach the folder (the "Damaged" group only has the 2 cut-off videos). 15 of the card's 26 app logs also didn't come through as separate files. Both are what PhotoRec really does; worth knowing if a tester asks "where's the rest?".

The per-file key (expected group, note and year of every file, with its SHA-256) is `pilot-key.json`, written next to the folder.

## What the facilitator should see, task by task

Numbers below are for the build at commit time; if the app's rules change, rerun the check (below) before the pilot.

**G1 (scan).** Scanning shows "Checked … of 523 files", then "Looking for exact copies…". The results screen says:
- Title: **"We found 214 photos and videos worth keeping."** with "They're sorted by the date each one was taken."
- Ledger: Files checked **523** · Kept, sorted by date **214** · Set aside, kept safe below **309** · Deleted · Uploaded **0 · 0**.
- Year chips: **2024, 2023, 2022, 2021, 2020, 2019** and **No date · 20**. The chips count photos only: 2024 27, 2023 37, 2022 42, 2021 32, 2020 28, 2019 22.
- Set aside: "We set aside 309 files that look like leftovers from the recovery." Groups: **Small preview copies 204**, **Exact copies 22**, **Damaged or incomplete files 2**, **App and system files 81**.

**T2 (what was set aside).** Correct answer, in their words: the 309 are leftovers (small previews, copies, damaged files, app files), nothing was deleted, they're still in the recovery folder, and any group can be kept.

**T3 (keep the Messenger previews).** They open **Small preview copies (204)** and choose **Keep these files**. The title becomes **"We found 418 photos and videos worth keeping."**; the ledger shows Kept **418**, Set aside **105**. Watch for: the group also holds gallery thumbnails and app icons, not only Messenger previews, so testers who look inside may hesitate ("these are icons, not my tita's photos").

**T4 (find the Messenger photo with no date).** They reach the **No date** group (chip "No date · 20", heading "No date: 20 photos, kept together so none get lost"). After Sprint 2, in the review timeline: "No date" has **20**. **If they kept the small previews in T3, "No date" in the timeline has 224** (the 204 previews have no dates either), and the 20 real photos are mixed in among them.

**G2 (2022 into a folder).** In the review timeline, 2022 holds **44** (42 photos + 2 videos), whether or not they kept the previews in T3. Saved, they land in `Keepsake photos/2022/<month>/` (12 month folders, Jan–Dec). Then the tester should be able to reopen that folder in File Explorer or Finder.

**T6 (uploads).** Nothing folder-specific. The results ledger shows "Deleted · Uploaded 0 · 0".

**After each session:** **Recovered from old phone** must still have **523 files**. If not, stop and tell the Team Lead (data-safety finding).

## Checked against the app

`eval/pilot.eval.test.ts` runs the app's scanning engine (the same code the browser uses) over the folder and compares every file with the key, then checks the numbers above with the app's own summary, results-screen and timeline code. Result on Oct 22, 2026:

```
Files checked: 523; kept 214 (208 photos, 6 videos); set aside 309 { small: 204, duplicate: 22, damaged: 2, system: 81 }
Real photos/videos wrongly set aside: 0/214
Known junk left in Keep: 0/214
Results screen: years 2024:27 2023:37 2022:42 2021:32 2020:28 2019:22; No date chip 20
After keeping Small preview copies: 418 kept, 105 set aside
Review timeline: 2022 has 44 files (2022-01:6 2022-02:4 2022-03:4 2022-04:3 2022-05:5 2022-06:1 2022-07:5 2022-08:6 2022-09:2 2022-10:4 2022-11:3 2022-12:1); No date has 20
Review timeline after keeping Small preview copies: 2022 has 44; No date has 224
```

Every file landed in its expected group; no real photo or video was set aside. This is the engine in Node, not a browser session: before the pilot, scan the zip's folder once in the test build in Chrome and check the G1 numbers on screen.

## Rebuild it

Needs Python 3 with Pillow, numpy and pillow-heif, ffmpeg with libx264, and PhotoRec (TestDisk package; 7.1 was used). About 6 minutes.

```
python3 scripts/make_pilot_folder.py fixtures/pilot --zip fixtures/Recovered-from-old-phone.zip
PILOT_DIR="fixtures/pilot/Recovered from old phone" PILOT_KEY=fixtures/pilot/pilot-key.json \
  npx vitest run eval/pilot.eval.test.ts --silent=false
```

- `--photorec PATH` if PhotoRec isn't on the PATH. Without PhotoRec (or with `--mimic`), the script writes the same layout itself, but the counts differ from the key above: it can't know which app files PhotoRec misses, so it has 539 files (96 app and system files, 3 cut-off videos). Every file also gets the same date (PhotoRec dates photos from their details), and its `report.xml` is a stub. Its own `pilot-key.json` is right for what it writes, and the check below passes on it too, but rebuild with PhotoRec before using the numbers in this doc.
- `--cache FILE` saves the generated files, so a rerun skips the 5 minutes of drawing.
- Deterministic: two clean builds gave a byte-identical card image and the same answer key; only PhotoRec's `report.xml` (run time) and the files' recovery-day dates differ between runs.
- The script stops with an error if any photo, video or preview doesn't come through PhotoRec whole, so the key always matches the folder.
