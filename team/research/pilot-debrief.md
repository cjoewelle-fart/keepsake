# Pilot debrief (T68)

For the owner, Oct 28. Fill in from your notes from the Oct 26–27 pilot. You ran it yourself on your laptop, in the test build, on **Recovered from old phone**. Under D19 your own walkthroughs are the evidence for the phase 3 gate. You decided (D20, Oct 27) that this run counts as the pilot-folder walkthrough if all six tasks went without help; only tasks whose screens change after the debrief fixes get redone (see "D19 gate check" at the end).

Date run: **Mon Nov 2, 2026** (the Oct 26–27 run didn't happen; this is the pilot-folder walkthrough), guided task by task in chat by the Team Lead, who gave no hints · Mac, Chrome · Build: **Keepsake (test), cd63b57**, served from a copy of `dist-test` with `npx serve` · Folder: freshly built **Recovered from old phone** (real PhotoRec 7.1, 523 files; `npm run pilot-e2e` passed 31/31 on that folder and build before the run) · G1 + G2 total time: G1 about 1 min, G2 not timed; well under 25 min

## How to fill it in

- Write only what happened. If something didn't happen, leave it blank.
- **Without help:** *yes* = you did it from the screen alone. *With a hint* = you checked the kit or the answer key, or asked someone. *No* = you couldn't finish.
- **Exact words:** copy the on-screen text that confused you, word for word, in quotes.
- **Severity:** *blocks* = you couldn't finish, or anything looked as if files were deleted, uploaded or lost. *Slows* = a pause, a wrong turn or a worry you got past. *Cosmetic* = you noticed it, but it didn't change anything.
- **Fresh eyes:** you know the app. If you think a first-time user would stall where you didn't, say so.
- **Becomes task:** one line per problem. Role + priority + what to change.
  - Priority: blocks → **P1 this sprint** · slows → **P2** · cosmetic → **P3 backlog**.
  - Roles: UX writer (words) · UX designer (layout, flow) · Frontend dev (bugs, behaviour) · QA tester (wrong numbers, data safety) · Product owner (kit, cards, script).

---

## G1 Find the photos (limit 8 min)
Expected: "Checked … of 523 files", then "We found 214 photos and videos worth keeping."
- Without help: **yes** · Time: **about 1:00**
- Where it stalled: didn't stall. The ledger line under the numbers made the owner pause: why is "Uploaded" there when they're only sorting, and had already chosen a folder? The two reassurance lines left them unsure whether they had to do something.
- Exact words that confused: "Deleted · Uploaded", "Take your time. Nothing changes until you choose.", "Your recovery folder is exactly as it was."
- Severity: **blocks** (it made uploading sound like part of the process; see T6) · Fresh user would stall here: likely
- Becomes task: UX writer + UX designer · **P1** · say the privacy promise in plain words instead of a "Deleted · Uploaded 0 · 0" counter (or explain the counter beside it), and make clear the reassurance lines need no action (T76)
- Also heard: the owner said they expected the app to be "sorting and deleting some images". It never deletes. Same again in G2. See T6.

## T2 What was set aside (limit 4 min)
Expected answer: they're leftovers (small previews, copies, damaged and app files), nothing was deleted, they're still in the recovery folder, and any group can be kept.
- Without help: **yes** · Time: not timed · Screen made the answer clear: **partly**
- Answer: "Setting aside means that they are not deleted, which is a bit reassuring." Didn't say the files stay in the recovery folder, or what they are.
- Where it stalled: wanted to see the set-aside images and videos larger to decide what to do with them; unsure what **Keep these files** does ("Will they be moved to a separate folder?")
- Exact words that confused: "Keep these files" (what happens to the files)
- Severity: **slows** · Fresh user would stall here: likely
- Becomes task: UX writer · **P2** · one line under "Keep these files" saying what it does: adds them to your timeline to save, nothing is moved (T78). Seeing every file at a larger size: owner decision D23 (below)

## T3 Keep the small copies (limit 4 min)
Expected: open **Small preview copies (204)** › **Keep these files** → title says 418, ledger shows Kept 418 · Set aside 105.
- Without help: **yes** · Time: not timed · Noticed the numbers change: **no** (noticed a "No date" section appear, not the heading or ledger)
- "Keeping these" reassured "somewhat".
- Where it stalled: "No date" sits right under the month sections and stays visible whichever year tab is chosen. The kept area has no heading or card, while "Set aside, kept safe" has a white card, so the set-aside part reads as the important one and the kept part as less important.
- Exact words that confused: none; it's layout
- Severity: **slows** · Fresh user would stall here: likely
- Becomes task: UX designer · **P2** · give "Kept, sorted by date" its own heading and container at least as strong as Set aside; separate "No date" from the months (T77)

## T4 Find photos with no date (limit 4 min)
Expected: chip "No date · 20". Timeline "No date" has 20, or 224 if you kept the previews in T3.
- Without help: **yes, but slow** ("took a couple of steps; I didn't assume it would be there") · Time: not timed · Got there by: other: in Review, found it once the line "Photos sent through chat apps often lose their date" showed · Count: **224** (= 20 + 204 kept in T3, matches the key)
- Where it stalled: didn't expect chat photos under "No date". In Review there's no quick way back to the top, and the owner wasn't sure how to leave Review without undoing their choices.
- Idea: a separate place for Messenger media (already in the beta backlog: T59)
- Severity: **slows** · Fresh user would stall here: likely
- Becomes task: UX designer + Frontend dev · **P2** · "Back to top" in Review, and say that going back keeps your choices (T79)

## G2 2022 into a folder, then find it (limit 17 min)
Expected: 2022 has 44 files. They save to *Pictures › Keepsake photos › 2022* (12 month folders), and you reopen that folder in File Explorer or Finder after closing the app.
- Without help: **yes** · Time: not timed
- What you saved: **2022 only** (Keepsake photos holds only a 2022 folder)
- Folder picker: picked Pictures; nothing worrying
- Zip fallback appeared: no
- Reopened the 2022 folder after closing the app: **yes** (Finder Get Info: 57 items = 44 files + 12 month folders + 1 hidden Finder file; `find` counts **44** files)
- Receipt numbers: not checked ("looks alright")
- Where it stalled: nowhere in saving. About Review: the selection summary on the left scrolls away, so you lose track of how many are selected. The owner called this **critical** and suggests a sticky panel or a small floating counter.
- Ideas: encouraging messages while sorting; click a photo or video to see it larger (second time, see T2); save progress and continue later for big folders
- Severity: **slows** · Fresh user would stall here: likely
- Becomes task: UX designer + Frontend dev · **P2** · keep the selected count visible while scrolling Review (T80). The ideas are below under owner decisions

## T6 Uploads? (limit 4 min)
Expected: the ledger shows "Deleted · Uploaded 0 · 0".
- Without help: **yes** (answered alone) · Time: not timed
- Answer: "**It might**, since this opened in the browser, and choosing a folder from the local computer essentially does that for me. Especially now with data privacy issues and AI, we have to reassure users."
- What on screen would convince a doubter: "Explain that we do not upload anything to servers and we're just helping them sort. Something technical but still quite human in messaging." · What's missing: that explanation, where the choice is made
- Severity: **blocks**: the tester believes files might be uploaded. By the kit's rule this is a **Critical** finding.
- Becomes task: UX writer + UX designer · **P1** · a short, human explanation at "Choose recovery folder" and on results: the app runs on this computer, opening a folder lets it read, not send, and nothing goes to any server (T76). The promise itself is unchanged; only how it's told

---

## Check: your numbers against the answer key

| What | Answer key | You saw | Match? |
|---|---|---|---|
| Files checked | 523 | "looked alright", exact number not noted | not recorded |
| Kept, sorted by date | 214 | not noted | not recorded |
| Set aside | 309 | not noted | not recorded |
| Small preview copies / Exact copies / Damaged / App and system | 204 / 22 / 2 / 81 | | |
| Year chips 2024 / 23 / 22 / 21 / 20 / 19 | 27 / 37 / 42 / 32 / 28 / 22 | | |
| No date chip | 20 | | |
| After keeping small previews: kept / set aside | 418 / 105 | | |
| Timeline 2022 | 44 (42 photos + 2 videos) | | |
| Timeline No date | 20 (224 if previews kept) | 224 (previews kept in T3) | yes |
| Saved 2022 month folders / files | 12 (Jan–Dec) / 44 | 12 (from Get Info: 57 items) / 44 (`find`) | yes |

Rows left blank weren't noted during the run. The same build and folder passed all 31 of `npm run pilot-e2e`'s checks just before the run, covering every row above. No mismatch was seen.

Any mismatch → **QA tester, P1**: rerun `eval/pilot.eval.test.ts` and find out why. A real photo set aside by mistake counts against the phase 2 gate (under 1%).

## Safety and privacy (observations only)

- [x] Recovery folder file count before: **523** after: **523** (`find … ! -name .DS_Store | wc -l` on the Mac)
- [ ] No file in the recovery folder renamed, moved or changed
- [x] Saved copies are in *Pictures › Keepsake photos* (only a 2022 folder), nothing new in the recovery folder (count unchanged)
- [ ] Nothing left the computer. How you checked (or "not checked"): **not checked in this run** (Wi-Fi on, as the kit says). QA's pilot-e2e on the same build saw zero requests to other sites.
- [ ] Receipt shows "Deleted · Uploaded 0 · 0"; "Your files: 0 deleted" showed while scanning and saving
- [x] Anything that *looked* like a delete or upload, even if it wasn't one: **yes**. The "Deleted · Uploaded" ledger line raised the idea of uploading (G1), and in T6 the owner said the app "might" upload because it opens a local folder in a browser. The owner also twice described the app as deleting images. Raised as P1 (T76).

If any box isn't ticked: write down what you saw, change nothing, and tell the Team Lead the same day (data-safety finding, QA tester, P1).

## Kit and timings

- Tasks over their time limit: none known (G1 about 1 min; others not timed)
- Kit fixes (cards, setup, checklist): the owner can't clone the private repo on their laptop. Today's run used a zipped copy of `dist-test` served with `npx --yes serve@14.2.4 -l 4173 keepsake-test`. The pilot folder wasn't on Drive and was rebuilt with real PhotoRec. Note both in section 2 → Product owner, P2. Timing each task needs a reminder on each card.
- What this suggests for the new phase 3 gate (D19) or a walkthrough on a real folder (T45): all six tasks were done without help, but T6 is a Critical finding and the G1/T6 screens will change with T76. So under D20, G1 and T6 (and T2/T3 if their screens change) get redone after the fixes. For T45, note the receipt numbers and the results-screen numbers as you go.

## Owner decisions, not tasks

**Raised from the Nov 2 run** (ideas the owner gave that go beyond the phase 3 MVP, so they wait for the owner's call, not tasks):
- Click a photo or video to see it larger, in Review and in set-aside groups (asked twice). Close to D23 ("see every file" in a group).
- Save progress and continue later, for big folders.
- Encouraging messages while sorting ("almost half of 2022 done").
- A separate group or folder for Messenger and chat-app photos (beta backlog T59 already covers a filter).

Some problems can't be fixed by changing words or layout. Don't make these into tasks. Raise them on the dashboard as **"Decision for owner: problem · options · what the pilot showed"**:
- Anything that would change the **privacy promise**: no server, files never leave the computer.
- Anything that would change the **no-delete promise**: the recovery folder stays read-only, and every cleanup choice can be undone.
- **Scope:** anything outside the phase 3 MVP, for example similar-photo grouping, repair or more file types. Those come after launch.
- **The gate:** the pass rule, what counts as done (for example, saving everything in G2), or whether other testers come back in.

---

## D19 gate check (phase 3)

The gate (D19, Oct 26): you finish the full flow without help, doing all six tasks on the pilot folder and on one real recovery, and QA's scripted end-to-end and accessibility run passes. Watching the first few private-beta users comes later, before public launch.

**You pass or fail this gate, not the team.** The team gathers the evidence and fixes what it shows, but it doesn't tick the gate. Tick a row only once its evidence is written down.

| | Gate condition | Evidence that shows it | Where it's written | Build | Status |
|---|---|---|---|---|---|
| [ ] | 1. Pilot folder: all six tasks, without help (Nov 2: all six done without help, but T6 Critical; G1 and T6 to redo after T76) | G1, T2, T3, T4, G2 and T6 above are all "Without help: yes"; your numbers match the answer key; every Safety and privacy box is ticked. Per D20 the Oct 26–27 run counts; redo only the tasks whose screens change after the debrief fixes | This debrief (plus any redone tasks) | | met / not met / not yet |
| — | 2. ~~One real recovery: all six tasks, without help~~ **Dropped Nov 2 by the owner (in chat): the pilot-folder run is enough. QA's real PhotoRec card run (Oct 30, M8) stays as the real-recovery evidence; real recoveries are tested in the beta.** | All six are "yes" on the `OWNER-REAL` notes sheet, and every check in `pilot-kit.md` section 6 is OK: file count unchanged, known photos found, counts add up, Wi-Fi off the whole way | `pilot-kit.md` section 6 sheet (paste it here) | | met / not met / not yet · planned: ____ |
| [ ] | 3. QA's scripted end-to-end and accessibility run passes | Every scripted step and accessibility check is marked pass, with date and build; no open P1 | `team/research/gate-check.md` (QA; run with `npm run gate`) | | met / not met / not yet |
| — | 4. First few private-beta users watched for feedback | Not checked at this gate. It's a phase 4 item, done before public launch | Phase 4 plan | — | phase 4 |

- **No open safety or trust finding.** If any walkthrough left a P1 open (a file changed, or anything that looked like a delete or upload), the gate stays open until it's fixed.
- **Same app.** Note the build (commit or tab title) on each row. If the flow changes after a row is met, whether to redo that row is your call. QA reruns its script on the build you sign off.

**Calls only you make** (the Team Lead raises them on the dashboard as "Decision for owner"):
- ~~Does the Oct 26–27 run count for row 1?~~ Decided Oct 27 (D20): yes, if all six tasks went without help; redo only tasks whose screens change.
- A task done "with a hint": redo it after the fix, or accept it?
- G2: does saving everything (which includes the year) count as done?

**Result:** Phase 3 gate: passed / not passed / not yet · Decided by: owner · Date: ____. The Team Lead copies your decision onto the dashboard in your words.
