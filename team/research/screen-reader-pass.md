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
Hear: tab title "Scan · Keepsake (test)". Focus is on the heading "Let's find the photos in your recovered files." Then "Step 2 of 5 · Scan", the body text, the button "Choose recovery folder", and the links "How Keepsake keeps your photos private" and "New to PhotoRec? Here's how to recover your files". (In Safari or Firefox you'll also hear "Keepsake works best in Chrome or Edge on a computer. You can still scan your folder in this browser.")
`[ ] Pass  [ ] Fail  Note: ________________________________`

**2. Empty folder.** Press "Choose recovery folder" and pick the empty folder.
Hear, without moving: "This folder is empty. Choose the folder your recovery program saved files into." If you hear nothing, it's a Fail (audit S1).
`[ ] Pass  [ ] Fail  Note: ________________________________`

**3. Info pages.** Open "How Keepsake keeps your photos private". Press next-heading until the end.
Hear: tab title "Your privacy · Keepsake (test)". Focus is on "Your privacy". Then these headings in order: "Nothing is uploaded", "None of your files are deleted", "How to check for yourself", "What we can't control", "What Keepsake stores", "Questions". Press "Back to start" (top or bottom). You should land on the start heading again. Then open the PhotoRec link. Hear: tab title "PhotoRec guide · Keepsake (test)", the heading "Get your photos back from a memory card with PhotoRec", then "Before you start", "Part 1: Get PhotoRec" through "Part 6: What you'll see", "If your photos were in the phone itself" and "If something goes wrong". Each step's "You should see: …" line is read as ordinary text inside its step.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**4. Scan progress.** Back on Start, choose the **big** folder. Don't touch anything while it runs.
Hear: focus on "Checking your files…", then short updates only every 10%: "Checking your files… 10%", "… 20%" and so on, then "Looking for exact copies… 0%" onwards. A Fail is hearing "Checked 1,204 of 5,230 files" on every change, or so much that you can't follow it.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**5. Stop keeps focus.** Scan the big folder again. Tab to "Stop scanning" and press Enter.
Hear: the button now says "Stopping…" (dimmed or unavailable) and focus stays on it. You should not hear the page title or "document" as if focus fell off. Then you're back on the start heading, and a moment later: "Scan stopped. Nothing was changed, and you can start again any time."
`[ ] Pass  [ ] Fail  Note: ________________________________`

**6. Results (G1, T2).** Choose **Recovered from old phone** and wait for the scan to finish (about a second).
Hear: tab title "Clean up · Keepsake (test)". Focus on "We found 214 photos and videos worth keeping." Read on: "Files checked 523", "Kept, sorted by date 214", "Set aside, kept safe below 309", "How many of your files were deleted or uploaded: None deleted, none uploaded", "Your recovery folder is exactly as it was." Then the button "Review my 214 photos and videos". Press next-heading to "Set aside, kept safe" and hear "We set aside 309 files that look like leftovers from the recovery. You can keep any of these." The four group buttons, each collapsed: "Small preview copies 204 Show", "Exact copies 22 Show", "Damaged or incomplete files 2 Show", "App and system files 81 Show".
`[ ] Pass  [ ] Fail  Note: ________________________________`

**7. "Keep these files" and the ledger (T3).** Open "Small preview copies" (hear "expanded" and "Hide"). Tab to "Keep these files" and press it.
Hear, within about 2 seconds: "Now keeping 418 files. 105 set aside." The button now says "Set these aside again". Go up to the first heading: it says 418. The ledger reads "Kept, sorted by date 418" and "Set aside, kept safe below 105". The group's name now includes "Keeping these". Press "Set these aside again". Hear "Now keeping 214 files. 309 set aside." **Leave it at 214** for the next checks.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**8. No date (T4).** In "Jump to a year", find the button "No date · 20" and press it.
Hear: focus moves to the heading "No date 20 photos, kept together so none get lost."
`[ ] Pass  [ ] Fail  Note: ________________________________`

**9. Timeline by Tab and by heading.** Press "Review my 214 photos and videos".
Hear: tab title "Review · Keepsake (test)". Focus on "Choose what to save 214 selected". Tab from there: "Save 214 selected", "Select all", "Unselect all", the year buttons, the month buttons, "Jump to a month" (a list like "January 2022 · 6 of 6"), then "All", "Photos", "Videos", "Not selected". Keep tabbing into the photos. Hear a month button like "Unselect all of December", a day checkbox like "Friday 27 December" with "all 3 selected", and photo checkboxes like "Save photo from 27 December 2024, 18:43". Videos add their length ("…, 42 seconds long"). No-date photos say "Save photo with no date (1 of 20)". Then use next-heading and arrow keys down through a month far down the page. **Fail** if any month reads as blank or skips its photos (audit M3).
`[ ] Pass  [ ] Fail  Note: ________________________________`

**10. Choices and the count (G2, part 1).** Press "Unselect all".
Hear, about a second later: "Nothing selected. Nothing is deleted." Tab to the Save button. It says "Save selected", is dimmed or unavailable, and adds "Nothing is selected, so there's nothing to save yet. Your photos are all still here." Press year "2022", then each "Select all of December" … "Select all of January" (12 buttons). After each one, pause and hear, for example, "December 2022: 1 of 1 selected. 1 of 214 selected in all." The last one ends "44 of 214 selected in all." Untick one photo and hear "43 of 214 selected.", then tick it again.
`[ ] Pass  [ ] Fail  Note: ________________________________`

**11. Choose where to save.** Press "Save 44 selected".
Hear: tab title "Save · Keepsake (test)". Focus on "Where should we save your 44 photos and videos?" Then "Selected to save 44", the total size, "None deleted, none uploaded", and "We save new copies. Your recovery folder stays exactly as it was." Press "Choose a folder" and pick **Recovered from old phone**. Hear at once, without moving: "That's your recovery folder. To keep it exactly as it was, Keepsake won't save there. Please choose a different folder." Focus stays on the button, which is now "Choose a different folder".
`[ ] Pass  [ ] Fail  Note: ________________________________`

**12. Saving and the receipt (G2, part 2).** Press "Choose a different folder" and pick **Pictures** on the Desktop.
Hear: "Saving your photos and videos…" with "Saved … of 44." updates (it's quick, so you may not hear them). Then tab title "Done · Keepsake (test)", focus on "Your 44 photos and videos are saved." Then "They're in Keepsake photos, sorted into a folder for each year and month." and "To see them, open Pictures › Keepsake photos in File Explorer (Windows) or Finder (Mac)." Press next-heading to "Your receipt". Hear "Saved 44 photos and videos", "Couldn't save 0", "Saved to Pictures › Keepsake photos", "Sorted into 1 year, 12 months", "Recovery folder Untouched", "None deleted, none uploaded", then the buttons "Save receipt" and "Print". Afterwards, empty Pictures again.
`[ ] Pass  [ ] Fail  Note: ________________________________`

## Record the result

Fill in this line, and copy it with the 12 boxes into the dashboard (or send it to the Team Lead):

Date: ________ · Reader and version: ________ · Browser and version: ________ · Mac or Windows version: ________ · Build: tab title ________ (and commit, if the Team Lead gave you one) · Big folder used: about ____ files · Time taken: ____ min

Every **Fail**, and any Note that worried you, becomes a task for the Team Lead. Write what you did, what you heard, and what you expected. Don't try to fix anything yourself. Whether T30 is done is your call.

---
*Written Oct 28 by the UX designer from the code (copy.ts, App, Results, Timeline, Save, InfoPage). Not yet heard through a real reader: the order of role words, how the ledger and receipt lists are introduced, and the exact timing of announcements may differ a little.*
