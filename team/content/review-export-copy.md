# Review and save: screen copy

<!-- T22 · UX writer · 2026-10-19. For T24 (review timeline) and T25 (save: folder and zip). Source mockups: team/brand/quiet-prints/TL-desktop, TL-phone, EX-choose, EX-done (.dc.html). Name decided Nov 10 by the owner: Upsort (T94); every "Upsort" here was swapped for it. {n}, {total}, {size} etc. are real values filled in by the app; numbers always use thousands separators (copy.ts `n()`). "new" = state not in the mockups yet. [CONFIRM: …] = developer to check before shipping. Status: draft, awaiting owner review on the dashboard. -->

## Words we use on these screens

Same words as the results screen and `src/ui/copy.ts`:

- **selected / unselect / select all**: the review choice. Not "tick", "untick", "check" or "include".
- **Not selected** means *not copied*. It never means removed. Always say "Nothing is deleted" nearby.
- **set aside, kept safe**: files from the Clean up step.
- **No date**: photos without a date taken. Not "Undated". (Change `copy.ts` `results.undatedMore`, which still says "Undated".)
- **save / copies**: what the last step does. Not "export". The step is called **Save** (change `copy.ts` `steps[4]` from "Export" to "Save" so it matches the mockups' "Step 5 of 5 · Save").
- **Your files · Not deleted, not sent anywhere** (T76, Nov 2 pilot: the "Deleted · Uploaded 0 · 0" counter made uploading sound like part of the process): the same box everywhere; the screen-reader text says the same words (`ledgerSafeSr`, `ledgerSafeValueSr`).
- **Your files are not deleted or changed** (T58, owner's D17; D18 (owner, Oct 22); said in words by T76): while scanning and saving, and on the receipt ("Your files · None deleted, none sent anywhere"), the promise is about *your* files. Saving may remove an empty file it made itself, so a bare "Deleted: 0" wouldn't be strictly true. Same idea as "None of your files were deleted".

---

## 1. Review timeline, desktop (TL-desktop)

| Location | Current | Proposed | Why |
|---|---|---|---|
| Header | Step 4 of 5 · Review | keep | |
| h1 | Choose what to save / 2,224 / selected | keep | Clear, and the number matches the ledger. |
| Intro | Everything starts selected, because saving it all is the safe choice. Untick anything you don't want. | Everything starts selected, so nothing gets missed. Unselect anything you don't want to save. | "the safe choice" suggests unselecting is risky. "Unselect" is clearer than "untick" for readers who use US English (Philippines). |
| Ledger aria-label | Your photos, added up | Your files, added up | The list includes 36,176 set-aside files, which aren't all photos. Matches the results screen. |
| Ledger | Kept photos and videos · 2,236 | keep | Matches "Review my 2,236 photos and videos" on results. |
| Ledger | Selected to save · 2,224 | keep | |
| Ledger | Not selected · 12 | keep | |
| Ledger | **new** Size to save · 9.8 GB | | Size of what's selected now. |
| Ledger | Still set aside, kept safe · 36,176 | keep | Matches the results screen. |
| Ledger | Your files · Not deleted, not sent anywhere | T76 (was "Deleted · Uploaded · 0 · 0"); screen reader says the same words | Same as results. |
| Note under ledger | Not selected means not saved. Nothing is deleted. | Photos you don't select stay where they are now. Nothing is deleted. | "not saved" can read as "lost". This says what really happens. |
| Same (role) | role="status" on fixed text | Make the note plain text. Put a separate status line in the page that announces changes (see "Announcements"). | Fixed text in a status region is never announced. Changes should be. |
| Main button | Save 2,224 photos and videos | **Save 2,224 selected** | Shorter (the owner said button text feels oversized). Still true when videos are included. Singular: "Save 1 selected". |
| Text link | Select everything | Select all | Shorter. Matches "Select all of June". |
| Text link | Select none | Unselect all | Pairs with "Select all". Same verb as the intro. |
| Year nav aria-label | Jump to a year | keep | Matches results. |
| Year pills | 2024 … 2019 · No date · 312 | keep | Matches results (`undatedChip`). |
| Month nav aria-label | Jump to a month in 2024 | keep | |
| Month pills | June, May, April, February, January | keep | Show only months that have photos. |
| Filter group aria-label | Show | Show only | Screen readers say "Show only, radio group, All". |
| Filters | All · Photos · Videos · Screenshots | All · Photos · Videos · Not selected | Screenshots dropped for the MVP (owner). "Not selected" matches the ledger. Empty: "Everything is selected right now. Anything you unselect will show here." Note while on: "Select any you want to save after all. They stay in this list until you choose another filter." |
| Month heading | June 2024 · 136 of 148 selected | keep | |
| Month button | Select all of June | keep when some or none are selected. When all are selected: **Unselect all of June** | One button that switches, so a month can be emptied in one go. |
| Day row | Friday 28 June · 4 of 6 selected | keep | |
| Day row | Sunday 23 June · all 6 selected | keep | |
| Photo checkbox aria-label | 28 June 2024, 09:12, photo | Save photo from 28 June 2024, 09:12 | "Checked" alone doesn't say what checking does. |
| Video checkbox aria-label | 28 June 2024, 11:40, video, 0:42 | Save video from 28 June 2024, 11:40, 42 seconds long | Same reason. "0:42" is read out oddly. |
| Time tags | 09:12 etc. | keep | |
| Video badge | ▶ 0:42 (inline SVG triangle) | keep | |
| Set-aside card | 36,176 files set aside, kept safe. You can look through them on the Clean up step. | 36,176 files are still set aside, kept safe. To look through them or keep any, go back to Clean up. | Says what you can do there. |
| Set-aside button | Go back to Clean up | Back to Clean up | Shorter. [CONFIRM: going back keeps the selections made here.] |

## 2. Review timeline, phone (TL-phone)

| Location | Current | Proposed | Why |
|---|---|---|---|
| Header | Step 4 of 5 · Review | keep | |
| h1 | Choose what to save | keep | |
| Intro | Everything starts selected. Untick anything you don't want. Nothing is deleted. | Everything starts selected. Unselect anything you don't want to save. Nothing is deleted. | Same verb as desktop. |
| Year nav | Jump to a year · 2024 … · No date · 312 | keep | |
| Month picker label | Jump to month | Jump to a month | Matches desktop. |
| Month option | June 2024 · 136 of 148 | keep | |
| Day row | Friday 28 June · 4 of 6 | keep | |
| Photo and video aria-labels | as desktop | as desktop | |
| Video tag | 0:42 ▶ (in place of the time) | 11:40 time tag, plus a separate 0:42 badge with an SVG triangle, as on desktop | Phone loses the time for videos; "▶" may render as an emoji on iOS. |
| Footer status | 2,224 of 2,236 selected · Nothing is deleted · Back to top (T79) | keep | |
| Footer button | Save 2,224 | **Save 2,224 selected** | Same label on every screen size. |
| Missing on phone | (Select all / Unselect all, filters, set-aside card) | Add the same strings as desktop, or confirm on purpose (open question 3) | |

## 3. Review timeline: states not in the mockups (new)

| State | Location | Proposed | Notes |
|---|---|---|---|
| **new** Nothing selected | h1 number | 0 / selected | |
| | Note under ledger | Nothing is selected, so there's nothing to save yet. Your photos are all still here. | Replaces the usual note. |
| | Main button (disabled) | Save selected | Leave out "0". Keep it focusable with `aria-disabled="true"` and `aria-describedby` to the note. |
| | Phone footer | 0 of 2,236 selected · Nothing is deleted · Back to top | |
| **new** Month fully unselected | Month heading count | None of 148 selected | |
| | Line under heading | These won't be saved. They stay where they are, and nothing is deleted. | Only in this state. |
| | Phone month option | June 2024 · 0 of 148 | |
| **new** Day fully unselected | Day row count | none selected | |
| **new** No date section | Heading | No date · 312 of 312 selected | Matches `noDateTitle`. |
| | Intro | We couldn't find when these were taken, so they're kept together here. Photos sent through chat apps often lose their date. They'll be saved in a folder called No date. | |
| | Section button | Select all with no date / Unselect all with no date | |
| | Photo aria-label | Save photo with no date ({n} of 312) | |
| **new** Filter shows nothing | Empty message | No videos from June 2024. (Also: "No photos from June 2024.") | |
| | Button | Show all | |
| **new** Announcements (status line) | After one photo changes | {selected} of {total} selected. | Polite; wait ~1 s after the last click. |
| | After a day, month or all changes | June 2024: 148 of 148 selected. {selected} of {total} selected in all. | |
| | Nothing selected | Nothing selected. Nothing is deleted. | |

## 3b. Review timeline: Largest first (T60, checked by the UX writer Nov 3)

<!-- T60 · front-end dev · 2026-11-03. Drafted by the developer from voice.md; every row below is **new** and waits for the UX writer. Strings live in copy.ts `timeline` (orderLabel … announceSize). -->

For people saving to a small drive: the same files, biggest first, so they can see what takes the most space. Ticks work the same as in the date view; nothing else changes what is saved.

| Location | Proposed (new) | Notes |
|---|---|---|
| Sort group aria-label | Sort | Two pressed/not-pressed buttons next to the filters. Writer: "Order" reads as a purchase in Philippine English; "Show in order" clashes with "Show only". |
| Order buttons | By date · Largest first | "By date" is the default and is the timeline as before. |
| Status line, on switching | Showing by date. / Showing largest first. | Polite, said straight away. Focus stays on the button. |
| Note above the list | Largest files first. If the drive you're saving to is small, you can unselect big files you don't need. They stay where they are now. Nothing is deleted. | Only in Largest first. Writer: says where the space is and that unselected files are not deleted. Never use "free up space", "remove" or "clean up" in this view. |
| Row (visible) | 48 MB / 28 June 2024, 09:12 · Video · 0:42 | Size in bold; "No date" for files without one; "Can’t play. Can save it." added for videos this browser can’t play. |
| Row checkbox name | 48 MB. Save video from 28 June 2024, 09:12, 42 seconds long | Size first (what this view is for), then the tile’s usual name. |
| Row checkbox name, no date (T89 QA fix, **needs UX writer check**) | 6 MB, f0012345.mov. Save video with no date, 42 seconds long | The date view’s "(207 of 460)" is left out here, where it means nothing. The file’s own name (cut to 40 characters) comes after the size, so rows of the same size, kind and date sound different. Applies to every row in Largest first. The viewer’s own title is unchanged. |
| Row "View larger" name (T89 QA fix, **needs UX writer check**) | View larger: Save video with no date, 42 seconds long, f0012345.mov | Same reason: the open buttons of look-alike rows need different names. |
| Bar and phone footer count | 2,224 of 2,236 selected · 9.8 GB to save | Only in Largest first; the date view’s bars are unchanged. Same number as the ledger’s "Size to save". |
| Status line after a change | 2,224 of 2,236 selected. 9.8 GB to save. | Only in Largest first, so screen-reader users hear the size too. Not added when nothing is selected. |
| Viewer detail line | 48 MB | Under the file’s name in the viewer, only when opened from Largest first. |

Not new: the filters, empty messages, "Not selected" note and Save button are the same strings as the date view. Year pills and month jump are hidden in Largest first (there are no months to jump to).

## 4. Choose where to save (EX-choose)

| Location | Current | Proposed | Why |
|---|---|---|---|
| Header | Step 5 of 5 · Save | keep (and change `copy.ts` steps to "Save") | |
| h1 | Where should we save your 2,224 photos and videos? | keep | |
| Ledger aria-label | What will be saved | keep | |
| Ledger | Selected to save · 2,224 | keep | |
| Ledger | Total size · 9.8 GB | keep | |
| Ledger | Free space on that drive · after you choose | Remove the row. Under the ledger: "You'll need at least 9.8 GB of free space." | A browser can't read a folder's free space (open question 1). |
| Ledger | Your files · Not deleted, not sent anywhere | T76 | |
| Note | We make new copies. Your recovery folder stays exactly as it was. | We save new copies. Your recovery folder stays exactly as it was. | |
| Section h2 | Choose a folder | Save to a folder | The h2 and the button said the same thing twice. |
| Body | Pick or make a folder, for example in Pictures. We'll add your photos to it and won't change anything already there. | Choose a folder or make a new one, for example in Pictures. We'll put a folder called Upsort photos inside it. Anything already there stays as it is. | Matches the receipt ("Pictures › Upsort photos"). |
| new line under body | (none) | Choose a place on this computer or on another drive. Don't save onto the memory card your photos came from. | Saving onto the source card could overwrite unrecovered files. |
| Button | Choose a folder | keep | |
| Browser note | In Safari and Firefox, your photos download as zip files instead: 9.8 GB comes as 5 files of under 2 GB each. | In Safari and Firefox, your photos and videos download as 5 zip files instead, each under 2 GB. | |
| Example h2 | How your folder will look | keep | |
| Example aria-label | Folder layout example | Example of how your folder will look | |
| Example items | Upsort photos / 2024 / 06 June / 2024-06-28 14.32.jpg / 2024-06-28 14.32 (2).jpg / No date | keep | "Upsort photos" follows the app name (copy.ts ROOT_FOLDER, T94). |
| Caption | A folder for each year and month. Each photo is named by the date and time it was taken. | A folder for each year and month, and one called No date. Each file is named by the date and time it was taken. If two have the same time, the second gets (2) at the end. | |
| **new** Back link | (none) | Back to review | |

### Choose where to save: states not in the mockups (new)

| State | Location | Proposed | Notes |
|---|---|---|---|
| **new** Safari/Firefox (zip) | Section h2 | Download as zip files | |
| | Body | This browser can't save straight into a folder. So your 2,224 photos and videos come as 5 zip files, each under 2 GB. They go to your Downloads folder. Open each one to see your photos, sorted the same way. | |
| | Tip | Your browser may ask if Upsort can download several files. Choose Allow. | [CONFIRM: what Safari and Firefox show.] |
| | Tip | To save straight into a folder, open Upsort in Chrome or Edge. | |
| | Button | Download 5 zip files | Singular: "Download zip file". |
| **new** Folder picker cancelled | (none) | No message. Stay on this screen. | |
| **new** Permission denied | Heading | Upsort can't save to that folder. | |
| | Body | Your browser didn't allow it, or the folder is protected. Nothing was saved there, and nothing was deleted. Try a folder in Pictures or Documents. | [CONFIRM: which folders Chrome and Edge block.] |
| | Button | Choose a different folder | |
| **new** Chose the recovery folder | Heading | That's your recovery folder. | |
| | Body | To keep it exactly as it was, Upsort won't save there. Please choose a different folder. | Only if the app can tell. [CONFIRM] |
| **new** Upsort photos folder exists | Note while saving | There's already an Upsort photos folder here, so we're adding to it. Nothing in it is changed or replaced. If a name is already taken, the new copy gets (2) at the end. | Team decision: add to it, don't make "Upsort photos (2)". |
| **new** A file over 2 GB (zip) | Body | Any file over 2 GB, usually a long video, gets a zip file of its own. That zip will be over 2 GB too. | When shown, drop "each under 2 GB" from the zip body and browser note. |

## 5. Saving in progress (new)

| Location | Proposed | Notes |
|---|---|---|
| h1 | Saving your photos and videos… | |
| Progress | Saved {done} of 2,224 | Same pattern as "Checked {n} of {total} files". |
| Zip progress | Making zip file {i} of 5… · Saved {done} of 2,224 | |
| Reassurance | This happens on your computer. Nothing is sent anywhere, and your recovery folder isn't changed. | |
| Safe count | Your files are not deleted or changed | Was "Deleted: 0" (T58, D17), then "Your files deleted: 0", then "Your files: 0 deleted" (D18); said in words by T76. Same string on the scanning screen. |
| Tip | Keep this tab open until it's done. If you can, keep the computer plugged in so it doesn't go to sleep. | |
| Button | Stop saving / Stopping… | |
| Announcements | Saved {done} of 2,224. | Polite, about every 10%. |
| Stopped: heading | Saving stopped. | |
| Stopped: body | {done} of 2,224 photos and videos were saved to Upsort photos. None of your files were deleted. You can save the rest any time. | [CONFIRM: "Save the rest" skips files already saved.] |
| Stopped: buttons | Save the rest · Back to review | |

## 6. Saving problems (new)

| State | Location | Proposed |
|---|---|---|
| **Drive full** | Heading | The drive is full. (Zip: "Your Downloads drive is full.") |
| | Body | We saved {done} of 2,224 photos and videos before it ran out of space. They're in Upsort photos. None of your files were deleted, and your recovery folder is fine. Make some space, or choose a different drive, then try again. You need about {remainingSize} more. |
| | Buttons | Save the rest · Choose a different folder |
| **Stopped partway** | Heading | Saving stopped partway. |
| | Body | We saved {done} of 2,224 photos and videos before something went wrong. They're in Upsort photos. None of your files were deleted, and your recovery folder is fine. If you're saving to a USB drive, check that it's still plugged in, then try again. |
| | Buttons | Save the rest · Choose a different folder |
| **Permission lost mid-save** | Heading | Upsort can't save to that folder anymore. |
| | Body | We saved {done} of 2,224 photos and videos. None of your files were deleted. Choose the folder again to save the rest. |
| | Button | Choose the folder again |
| **Zip download didn't start** | Body | Zip file {i} of 5 didn't download. Your photos are fine, and nothing was deleted. |
| | Button | Download {zip file name} again, e.g. "Download Upsort photos part 2.zip again" (T89, UX writer approved Nov 3) |
| **Some files couldn't be saved** (Done screen) | h1 | {saved} of your 2,224 photos and videos are saved. |
| | Line | {failed} files couldn't be copied. They may be damaged. They're still in your recovery folder, so nothing is lost. |
| | Receipt row / button | Couldn't save · {failed} / See which ones |

## 7. Done (EX-done)

| Location | Current | Proposed | Why |
|---|---|---|---|
| h1 | Your 2,224 photos and videos are saved. | keep | |
| Line | They're in Upsort photos, sorted into a folder for each year and month. | keep | |
| Button | Show me where they are | Remove. Line: "To see them, open {folder} › Upsort photos in File Explorer (Windows) or Finder (Mac)." | A browser can't open the folder. |
| Line | You can close Upsort now. Nothing else needs doing. | You can close Upsort now. There's nothing else to do. | |
| **new** Tip | (none) | If you can, keep a second copy too, on a USB drive or a backup you already use. | |
| Receipt | Your receipt / date / Saved / Couldn't save / Saved to / Sorted into / Recovery folder · Untouched / Your files | Last row: Your files · None deleted, none sent anywhere (T76; screen reader says the same words); same row in the saved receipt file | T58, D17: Save may remove an empty file it made itself; none of *your* files. Reworded by D18 (owner, Oct 22). |
| Note | Keep this so you can find your photos later, even after closing Upsort. | Save or print this so you can find your photos later. | |
| Button | Save this receipt | Save receipt | |
| Button | Print | keep | |

### Done: zip version (new)

| Location | Proposed |
|---|---|
| Line | They're in 5 zip files in your Downloads folder. Open each one to see your photos, sorted into a folder for each year and month. |
| Location text | One zip: "In your Downloads folder, look for Upsort photos.zip." An unbroken run of 3 or more: "In your Downloads folder, look for these 5 zip files: Upsort photos part 1.zip to Upsort photos part 5.zip." Any 2 names (developer choice, "to" read oddly for 2; **needs UX writer check**): "… look for these 2 zip files: Upsort photos.zip and Upsort photos part 2.zip." Three or more that aren't a run: "… look for these 3 zip files:" then the names, one per line. Built from the names of this save's zips. (T89, UX writer approved Nov 3) |
| Zip file names | One zip in the save: Upsort photos.zip. More than one, or any zip after the first while the page is open: Upsort photos part N.zip, N counting on across the page (so a save after Stop never reuses a name). No "of N". (T89, UX writer approved Nov 3) |
| Earlier zip note (T89, new, **needs UX writer check**) | After Stop, Back to review, then Save again, under the location text: "Upsort photos.zip is from an earlier save that didn't finish. Everything in it is also in the zip file above." If it has files this save doesn't: "… It has some photos and videos that aren't in this save." Plural: "Upsort photos part 1.zip and Upsort photos part 2.zip are from … Everything in them …" / "They have some …" |
| Receipt row | Saved to · Downloads, 5 zip files |

---

D17: if saving fails or is stopped, the app removes only the empty file it had just made for that copy. So say "none of your files", never "nothing", on the stopped and error screens.

## Open questions for design and development

Decided Oct 19: 1, 2 and 3 (Screenshots dropped; location shown as text; filter is Not selected) and 5(c), with the answers above.

1. **Free space can't be shown** by a browser for a picked folder. A full drive only shows up when saving fails (section 6).
2. **"Show me where they are" / "Open my photos".** Browsers can't open a folder in File Explorer or Finder. Proposed: show the location as text (matches the T25 note).
3. **Screenshots filter, and the phone layout.** Nothing in `src` detects screenshots, so drop that filter unless it's built. The phone mockup has no Select all / Unselect all, filters or set-aside card: on purpose?
4. **Two copy.ts fixes** for T24/T25: `steps[4]` "Export" → "Save"; `results.undatedMore` "Undated" → "No date". On day rows, `aria-checked="mixed"` on a native checkbox does nothing; set `indeterminate` in code.
5. **Behaviour the copy depends on:** (a) "Back to Clean up" keeps review selections; (b) "Save the rest" skips files already saved; (c) what happens if an "Upsort photos" folder exists; (d) whether the app can tell the chosen folder is the recovery folder.
