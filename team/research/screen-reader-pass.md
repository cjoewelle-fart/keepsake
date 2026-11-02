# Screen-reader pass (T30, last step)

For the owner. About 45 minutes. One run with one screen reader is enough: VoiceOver on a Mac or NVDA on Windows. Use **Chrome** with either one, because that's what the pilots use. Safari and Firefox work too, but you'll hear extra notes (see check 1) and Save offers zip files instead of a folder.

You need the test build at http://localhost:4173 (`pilot-kit.md` section 2), **Recovered from old phone** (523 files), an empty folder with nothing in it, an empty **Pictures** folder on the Desktop, and for checks 4 and 5 a big folder of a few thousand files (your real recovery is fine). Nothing in this pass changes your recovery folder.

Wording can differ a little between readers. A role word like "button", "collapsed" or "heading level 2" may come before or after the text. That's fine. A **Fail** is when the words are missing, wrong, read many times over, or you can't reach something. Dates, times and month names in checks 9 and 10 are examples of the pattern; yours will match your files.

## Setup

| | VoiceOver (macOS) | NVDA (Windows) |
|---|---|---|
| Start / stop the reader | Command + F5 | Control + Alt + N / Insert + Q |
| Next heading | Control + Option + Command + H | H |
| Next button / form control | Control + Option + Command + J | B (buttons), F (form fields) |
| Read everything from here | Control + Option + A | Insert + Down Arrow |
| Move to the next thing you can press | Tab (Shift + Tab goes back) | Tab (Shift + Tab goes back) |

Press Control to stop the speech at any time. NVDA beeps while a progress bar moves. That's its normal sound.

## Checks

**1. Start screen.** Open the app. Listen, then use read-all.
Hear: tab title "Scan · Keepsake (test)". Focus is on the heading "Let's find the photos in your recovered files." Then the body text, the button "Choose recovery folder", and the links "How Keepsake keeps your photos private" and "New to PhotoRec? Here's how to recover your files". (In Safari or Firefox you'll also hear "Keepsake works best in Chrome or Edge on a computer. You can still scan your folder in this browser.") The step line "Step 2 of 5 · Scan" sits above the heading, so read-all from the heading doesn't reach it: move up one line from the heading (or read from the top of the page) to hear it.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**2. Empty folder.** Press "Choose recovery folder" and pick the empty folder.
Hear, without moving: "This folder is empty. Choose the folder your recovery program saved files into." If you hear nothing, it's a Fail (audit S1).
`[ ] Pass  [ ] Fail  Note: ________________________________`

**3. Info pages.** Open "How Keepsake keeps your photos private". Press next-heading until the end.
Hear: tab title "Your privacy · Keepsake (test)". Focus is on "Your privacy". Then these headings in order: "Nothing is uploaded", "None of your files are deleted", "How to check for yourself", "What we can't control", "What Keepsake stores", "Questions". Press "Back to start" (top or bottom). You should land on the start heading again. Then open the PhotoRec link. Hear: tab title "PhotoRec guide · Keepsake (test)", the heading "Get your photos back from a memory card with PhotoRec", then "Before you start", "Part 1: Get PhotoRec" through "Part 6: What you'll see", "If your photos were in the phone itself" and "If something goes wrong". Each step's "You should see: …" line is read as ordinary text inside its step (in Parts 5 and 6 it's its own paragraph right after the step's text).
`[ ] Pass  [ ] Fail  Note: ________________________________`

**4. Scan progress.** Back on Start, choose the **big** folder. Don't touch anything while it runs.
Hear: focus on "Checking your files…", then short updates only every 10%: "Checking your files… 10%", "… 20%" and so on, then "Looking for exact copies… 0%" onwards. A Fail is hearing "Checked 1,204 of 5,230 files" on every change, or so much that you can't follow it.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**5. Stop keeps focus.** Scan the big folder again. Tab to "Stop scanning" and press Enter.
Hear: the button now says "Stopping…" (dimmed or unavailable) and focus stays on it. The scan usually stops at once, so you may not hear "Stopping…" at all; that's fine. You should not hear the page title or "document" as if focus fell off. Then you're back on the start heading, and a moment later: "Scan stopped. Nothing was changed, and you can start again any time."
`[ ] Pass  [ ] Fail  Note: ________________________________`

**6. Results (G1, T2).** Choose **Recovered from old phone** and wait for the scan to finish (about a second).
Hear: tab title "Clean up · Keepsake (test)". Focus on "We found 214 photos and videos worth keeping." Read on: "Files checked 523", "Kept, sorted by date 214", "Set aside, kept safe below 309", "How many of your files were deleted or uploaded: None deleted, none uploaded", "Your recovery folder is exactly as it was." Then the button "Review my 214 photos and videos". Press next-heading past the month headings (like "December 2024 3 photos" and "No date 20 photos, kept together so none get lost") to "Set aside, kept safe" and hear "We set aside 309 files that look like leftovers from the recovery. You can keep any of these." The four group buttons, each collapsed: "Small preview copies 204 Show", "Exact copies 22 Show", "Damaged or incomplete files 2 Show", "App and system files 81 Show".
`[ ] Pass  [ ] Fail  Note: ________________________________`

**7. "Keep these files" and the ledger (T3).** Open "Small preview copies" (hear "expanded" and "Hide"). Tab to "Keep these files" and press it.
Hear, within about 2 seconds: "Now keeping 418 files. 105 set aside." The button now says "Set these aside again". Go up to the first heading: it says 418. The ledger reads "Kept, sorted by date 418" and "Set aside, kept safe below 105". The group's name now includes "Keeping these". Press "Set these aside again". Hear "Now keeping 214 files. 309 set aside." **Leave it at 214** for the next checks.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**8. No date (T4).** In "Jump to a year", find the button "No date · 20" and press it.
Hear: focus moves to the heading "No date 20 photos, kept together so none get lost."
`[ ] Pass  [ ] Fail  Note: ________________________________`

**9. Timeline by Tab and by heading.** Press "Review my 214 photos and videos".
Hear: tab title "Review · Keepsake (test)". Focus on "Choose what to save 214 selected". Tab from there: "Save 214 selected", "Select all", "Unselect all", the year buttons, the month buttons, then "All", "Photos", "Videos", "Not selected". (In a narrow window the month buttons are replaced by "Jump to a month", a list like "January 2022 · 6 of 6".) Keep tabbing into the photos. Hear a month button like "Unselect all of December", a day checkbox like "Friday 27 December" with "all 3 selected", and photo checkboxes like "Save photo from 27 December 2024, 18:43". Videos add their length ("…, 42 seconds long"). No-date photos say "Save photo with no date (1 of 20)". Then use next-heading and arrow keys down through a month far down the page. **Fail** if any month reads as blank or skips its photos (audit M3).
`[ ] Pass  [ ] Fail  Note: ________________________________`

**10. Choices and the count (G2, part 1).** Press "Unselect all".
Hear, about a second later: "Nothing selected. Nothing is deleted." Tab to the Save button. It says "Save selected", is dimmed or unavailable, and adds "Nothing is selected, so there's nothing to save yet. Your photos are all still here." Press year "2022", then each "Select all of December" … "Select all of January" (12 buttons). After each one, pause and hear, for example, "December 2022: 1 of 1 selected. 1 of 214 selected in all." The last one ends "44 of 214 selected in all." Untick one photo and hear "43 of 214 selected.", then tick it again.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**11. Choose where to save.** Press "Save 44 selected".
Hear: tab title "Save · Keepsake (test)". Focus on "Where should we save your 44 photos and videos?" Then "Selected to save 44", the total size, "None deleted, none uploaded", "You'll need at least … of free space." and "We save new copies. Your recovery folder stays exactly as it was." Press "Choose a folder" and pick **Recovered from old phone**. Hear at once, without moving: "That's your recovery folder. To keep it exactly as it was, Keepsake won't save there. Please choose a different folder." Focus stays on the button, which is now "Choose a different folder".
`[ ] Pass  [ ] Fail  Note: ________________________________`

**12. Saving and the receipt (G2, part 2).** Press "Choose a different folder" and pick **Pictures** on the Desktop.
Hear: "Saving your photos and videos…" with "Saved … of 44." updates (it's quick, so you may not hear them). Then tab title "Done · Keepsake (test)", focus on "Your 44 photos and videos are saved." Then "They're in Keepsake photos, sorted into a folder for each year and month." and "To see them, open Pictures › Keepsake photos in File Explorer (Windows) or Finder (Mac)." Press next-heading to "Your receipt". Hear today's date and time, then "Saved 44 photos and videos", "Couldn't save 0", "Saved to Pictures › Keepsake photos", "Sorted into 1 year, 12 months", "Recovery folder Untouched", "None deleted, none uploaded", then the buttons "Save receipt" and "Print". Afterwards, empty Pictures again.
`[ ] Pass  [ ] Fail  Note: ________________________________`

## Record the result

Fill in this line, and copy it with the 12 boxes into the dashboard (or send it to the Team Lead):

Date: ________ · Reader and version: ________ · Browser and version: ________ · Mac or Windows version: ________ · Build: tab title ________ (and commit, if the Team Lead gave you one) · Big folder used: about ____ files · Time taken: ____ min

Every **Fail**, and any Note that worried you, becomes a task for the Team Lead. Write what you did, what you heard, and what you expected. Don't try to fix anything yourself. Whether T30 is done is your call.

---
*Written Oct 28 by the UX designer from the code (copy.ts, App, Results, Timeline, Save, InfoPage). Not yet heard through a real reader: the order of role words, how the ledger and receipt lists are introduced, and the exact timing of announcements may differ a little.*

## Automated pre-check (Nov 2)

QA, before the owner's pass, so the 45 minutes go on what only a real reader can tell. No screen reader was used. `scripts/sr-precheck.mjs` drives the test build (`dist-test`, tab title "… · Keepsake (test)") in Chromium 1243 at 1280×900 and records page titles, where focus lands, Chromium's accessibility tree in reading order (Playwright ARIA snapshots; headings from Chromium's own tree via CDP) and every change to a live region, with timestamps. The pilot folder is copied into the browser's private storage and picked through a stubbed folder picker; the big folder goes through the file-input fallback. No request left localhost.

Run: `npm run build:test && python3 scripts/make_pilot_folder.py fixtures/pilot --mimic && node scripts/sr-precheck.mjs /opt/pw-browsers/chromium-1243/chrome-linux64/chrome --big <folder>` (big folder: `scripts/make_perf_folder.py <dir> --files 5000 --big 100 --heic 0`, 7,660 files).

**The numbers differ from the script on purpose.** This machine has no PhotoRec and no pillow-heif, so the pilot folder was built with `--mimic` and without iPhone photos: 529 files, 204 kept, 325 set aside (groups 204 / 22 / 3 / 96), 2022 has 40 photos in 12 months. The pre-check checks the words and the pattern; the owner's numbers (523 / 214 / 309, 44) come from the real pilot folder, which `npm run pilot-e2e` checks in the gate.

Totals: **9 Pass (5 of them with a script wording fix), 2 Mismatch (1 script wording, 1 real app bug), 1 Can't check without a real reader (check 9, M3; its wording was fixed too).** Every row below is what was observed in that run.

| # | Status | What was observed |
|---|---|---|
| 1 | Mismatch (script fixed) | Title "Scan · Keepsake (test)". Focus on h1 "Let’s find the photos in your recovered files." Reading order after it: body text, hint, (empty status), button "Choose recovery folder", privacy line, buttons "How Keepsake keeps your photos private" and "New to PhotoRec? Here’s how to recover your files". No browser note in Chromium (correct). **But "Step 2 of 5 · Scan" is in the banner *before* the h1** (`Header.tsx`), so read-all from the focused heading never reaches it. Script reworded to say so. |
| 2 | Mismatch (real bug, minor) | First pick of the empty folder: the always-mounted `role=status` changed to "This folder is empty. Choose the folder your recovery program saved files into." about 150 ms later; focus stayed on "Choose recovery folder". S1 is fixed for this case. **Picking the empty folder a second time changes nothing in any live region (log empty), so a reader says nothing.** Cause: `App.tsx:88` sets the same note string again, and `Start`'s effect (`App.tsx:216-220`) depends only on `note`, so the text never changes. Fix: clear the region and refill it on every pick (for example key the note with a counter, or `setReady(undefined)` then refill). The owner only picks once, so check 2 itself should pass. **Fixed the same day (Nov 2):** the start note now carries a `noteKey` (`src/ui/liveNote.ts`, test `tests/liveNote.test.ts`); rerunning `sr-precheck.mjs` on the fixed build, pick 2 now refills the status region with the same sentence. |
| 3 | Pass (script wording fixed) | Titles "Your privacy · Keepsake (test)" and "PhotoRec guide · Keepsake (test)"; focus on each h1. Privacy headings exactly as scripted, in order. Guide headings in Chromium's tree: Before you start, Part 1: Get PhotoRec, (On Windows, On Mac), Part 2 … Part 3 (two h3s), Part 4A, Part 4B, Part 5: Wait, Part 6: What you’ll see, If your photos were in the phone itself, If something goes wrong. "Back to start" at top and bottom both return focus to the start h1 with title "Scan · …". 7 of the 9 "You should see" lines are paragraphs inside the step's list item; the ones in Parts 5 and 6 are their own paragraphs (script now says so). Note: Playwright's ARIA snapshot leaves out the "Part …" h2s although they are in the DOM and in Chromium's tree; that's a tool quirk, not an app issue. |
| 4 | Pass | 7,660 files. Focus on h1 "Checking your files…". The status region changed 17 times in about 10 s: "Checking your files… 0%", 10%, 20% … 100%, then "Looking for exact copies… 0%", 20%, 50%, 60%, 80%, 100% (that stage is fast, so it skips steps). The visible "Checked x of y" text is `aria-hidden`. Not checked: whether NVDA's progress beeps plus these are too much to follow. |
| 5 | Pass (script wording fixed) | Enter on "Stop scanning": the scan stopped within 30 ms, so the "Stopping…" state was never seen; focus went from the button to the start h1 within 1 ms (one 1 ms "body" moment while the screen swaps), then "Scan stopped. Nothing was changed, and you can start again any time." arrived in the status region 150 ms later. The button uses `aria-disabled` while stopping (`App.tsx:288`), so M2 is fixed in code. Script now says "Stopping…" may not be heard. Whether the 1 ms body moment is voiced is for the real reader. |
| 6 | Pass (script wording fixed) | Title "Clean up · Keepsake (test)", focus on "We found 204 photos and videos worth keeping." Then: "Files checked 529", "Kept, sorted by date 204", "Set aside, kept safe below 325", "How many of your files were deleted or uploaded: None deleted, none uploaded", "Your recovery folder is exactly as it was.", button "Review my 204 photos and videos". The set-aside line and the four buttons ("Small preview copies 204 Show", "Exact copies 22 Show", "Damaged or incomplete files 3 Show", "App and system files 96 Show") match, all `aria-expanded=false`. **Next-heading from the h1 first meets the month headings of the photo preview** ("December 2024 3 photos", "November 2024 4 photos", "September 2024 1 photo", "No date 20 photos, …") before "Set aside, kept safe"; script reworded. |
| 7 | Pass | Space on the group: "Small preview copies 204 Hide", expanded. Enter on "Keep these files": "Now keeping 408 files. 121 set aside." 15 ms later; focus stays on the same button, now "Set these aside again"; h1 408; ledger "Kept, sorted by date 408", "Set aside, kept safe below 121"; group name "Small preview copies Keeping these 204 Hide". Enter again: "Now keeping 204 files. 325 set aside." |
| 8 | Pass | In group "Jump to a year", button "No date · 20"; Enter moves focus to h2 "No date 20 photos, kept together so none get lost" (no full stop at the end, which a reader won't voice anyway). |
| 9 | Can't check without a real reader (M3); rest Pass, script fixed | Title "Review · Keepsake (test)", focus on "Choose what to save 204 selected". Tab order: "Save 204 selected", "Select all", "Unselect all", years, "No date · 20", month buttons, "All" (pressed), "Photos", "Videos", "Not selected", then "Unselect all of December" and the photos. **"Jump to a month" is not in the Tab order at desktop width**: it's `display:none` above 959 px and replaces the month buttons in narrow windows (`app.css:225, 268-274`); script reworded. Names seen: day "Saturday 6 April all 2 selected", photo "Save photo from 25 December 2024, 07:38", video "Save video from 10 February 2024, 11:45, 4 seconds long", no date "Save photo with no date (1 of 20)". Tab reached all 204 photos (25 ms between presses). **M3 risk confirmed in the tree:** a month 80% down the page (February 2020) had 0 checkboxes in the accessibility tree before it was scrolled near, only "February 2020 6 of 6 selected" and "Unselect all of February". Whether browse mode makes the days draw as the reader moves is exactly what the owner must listen for. |
| 10 | Pass | "Nothing selected. Nothing is deleted." Save button "Save selected", `aria-disabled=true`, described by "Nothing is selected, so there’s nothing to save yet. Your photos are all still here." Each of the 12 "Select all of <month>" in 2022 announced e.g. "December 2022: 1 of 1 selected. 40 of 204 selected in all." (pattern exact; 40 here, 44 on the real folder). Untick: "39 of 204 selected."; tick: "40 of 204 selected." |
| 11 | Pass (script wording fixed) | Title "Save · Keepsake (test)", focus on "Where should we save your 40 photos and videos?" Then "Selected to save 40", "Total size 17 MB", "How many of your files were deleted or uploaded: None deleted, none uploaded", **"You’ll need at least 17 MB of free space."** (missing from the script; added), "We save new copies. Your recovery folder stays exactly as it was." Picking the recovery folder inserts a `role=alert` with "That’s your recovery folder." and "To keep it exactly as it was, Keepsake won’t save there. Please choose a different folder."; focus stays on the button, now "Choose a different folder". (A new `role=alert` with text in it is normally announced; the real reader confirms.) |
| 12 | Pass (script wording fixed) | Focus on "Saving your photos and videos…", "Saved 0 of 40." … "Saved 36 of 40." in the status region. Title "Done · Keepsake (test)", focus on "Your 40 photos and videos are saved." Then the two lines exactly as scripted, then two more ("You can close Keepsake now…", "If you can, keep a second copy…"). Headings: h1, "Your receipt". Receipt reads: **the date and time first** (added to the script), "Saved 40 photos and videos", "Couldn’t save 0", "Saved to Pictures › Keepsake photos", "Sorted into 1 year, 12 months", "Recovery folder Untouched", "How many of your files were deleted or uploaded: None deleted, none uploaded", buttons "Save receipt", "Print". |

Script wording changed in checks 1, 3, 5, 6, 9, 11 and 12 (above). What still needs the owner's ears: how role words and the ledger/receipt description lists are voiced, whether the brief focus-on-body moment at each screen change is said aloud (seen at scan → results, scan → stopped, save → saving → done; about 1 ms each), NVDA's progress beeps on top of the 10% updates (check 4), and M3 browse mode (check 9).
