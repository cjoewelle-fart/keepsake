# Pilot kit: usability pilot, Oct 26–27 (T66)

By the Product owner, Oct 22, 2026; updated Oct 27 for D19 and T45. For the owner. Under D19 the phase 3 gate is your own walkthrough of all six tasks, without help, on two folders: **Recovered from old phone** (sections 1–4, with an answer key) and one real recovery of your own photos (section 6, no answer key). The Oct 26–27 run counts as the first of these if all six tasks went without help (your D20 choice, Oct 27); tasks whose screens change after the debrief fixes get redone. Rules, assists and script: `usability-test-plan.md` sections 1 and 5.

**Setup choice**
- **In person (recommended):** your laptop, Chrome, the test build running on your laptop. This setup can run all six tasks.
- **Remote:** the claude.ai preview link. Run G1, T2, T3, T4 and T6, and skip G2, because saving isn't available in the preview. A remote pilot can't check the gate tasks end to end.

---

## 1. Task cards

Read the scenario once, then give one card at a time. Run order: G1, T2, T3, T4, G2, T6.

| # | English | Taglish |
|---|---|---|
| **G1** | Use the app to find the photos in the files your friend recovered. | Gamitin mo yung app para mahanap yung mga photos sa files na na-recover ng kaibigan mo. |
| T2 | The app says it put some files aside. In your own words, what are those files, and what happened to them? | Sabi ng app, may mga files siyang itinabi. Sa sarili mong salita, ano yung mga files na yun, at ano ang nangyari sa kanila? |
| T3 | Your tita says some of the photos she sent you were tiny ones from Messenger. You want to keep those little pictures too, just in case. | Sabi ng tita mo, yung ibang photos na sinend niya sa'yo ay maliliit lang, galing Messenger. Gusto mo ring itago yung maliliit na pictures na yun, just in case. |
| T4 | You remember a photo someone sent you on Messenger. It might not have a date. Find where photos like that ended up. | May naaalala kang photo na sinend sa'yo sa Messenger. Baka wala itong date. Hanapin mo kung saan napunta yung mga ganoong photos. |
| **G2** | Get your photos from 2022 into a folder on this laptop that you can find later. *(Once they say they're done, close the app, then ask:)* Now show me where your 2022 photos are. | Ilagay mo yung mga photos mo noong 2022 sa isang folder dito sa laptop na mahahanap mo ulit mamaya. *(Once they say they're done, close the app, then ask:)* Ngayon, ipakita mo sa'kin kung nasaan yung 2022 photos mo. |
| T6 | A friend tells you apps like this secretly upload your photos to the internet. Do you think this one does? What makes you think that? | May kaibigan kang nagsabi na yung mga ganitong app ay palihim na nag-a-upload ng photos mo sa internet. Sa tingin mo, ganun ba 'to? Bakit mo nasabi? |

**G2 is done when:** the 2022 photos are saved, and the tester opens *Pictures › Keepsake photos › 2022* in File Explorer or Finder.

**Watch out:** the tester can save everything, which includes 2022, and still pass. Whether to count that as done is for the debrief. Note what they did.

---

## 2. Pre-session checklist

**Day before**
- [ ] Ask the Team Lead to set up the test build on your laptop (`npm run build:test`, then `npx vite preview --outDir dist-test`). It opens at http://localhost:4173, the tab title ends in "Keepsake (test)" (for example "Scan · Keepsake (test)"), and there's no "Try with example files" button.
- [ ] Do the whole flow once yourself in Chrome: choose the folder, scan, review, Save into a folder, open it in File Explorer or Finder. Then delete what you saved.
- [ ] Get **Recovered from old phone** from QA (T65) and put it on the Desktop. Keep the master zip safe. Write down its file count: ____
- [ ] Make an empty folder called **Pictures** on the Desktop, as the place to save in G2. Don't use your real Pictures folder.
- [ ] Remote: share the master zip by Drive, and send the preview link.
- [ ] Print the cards and the notes sheet, or have them ready to paste into chat.

**15 minutes before**
- [ ] Laptop charged and plugged in, Do Not Disturb on, other apps closed.
- [ ] Chrome on a fresh tab with the app link ready but not open. Bookmarks bar hidden.
- [ ] Recovery folder's file count matches the number you wrote down. If not, replace it from the master zip.
- [ ] **Pictures** is empty: no "Keepsake photos" folder in it. Downloads has no "Keepsake photos … .zip" files.
- [ ] Wi-Fi on. The pilot doesn't test offline, so don't turn Wi-Fi off and don't mention it. Remote testers need a steady connection for the call and the preview.
- [ ] Recorder tested: record 5 seconds and play it back.

**Start of call**
- [ ] Remote: tester opens the preview in Chrome (not Safari or Firefox), unzips the folder to the Desktop as **Recovered from old phone**, and shares their screen. This is setup, not an assist.
- [ ] Read the consent text, start recording, ask again so their yes is recorded.
- [ ] Note the start time. Read the scenario.

---

## 3. Notes sheet

Tester: `PILOT-1` · Date: ____ · In person / remote · EN / Taglish · Age range: ____ · Phone / computer / both · Build: ____

| Task | Done? Y / Y with help / N | Assists (count + what you said) | Time (m:ss) | Path, wrong turns | Quotes | Trust + / worries − |
|---|---|---|---|---|---|---|
| G1 Find the photos (limit 8 min) | | | | | | |
| T2 What was set aside (4) | Correct / partly / wrong | | | | | |
| T3 Keep the small copies (4) | | | | | | |
| T4 Find photos with no date (4) | | | | | | |
| G2 2022 to a folder, then find it (17) | | | | | | |
| T6 Uploads? (4) | | | | | | |

| Q1 What the app does | Q2 Unsure or worried moment | Q3 Would use / recommend | Confidence 1–5 | Trust 1–5 |
|---|---|---|---|---|
| | | | | |

**Session lines (from the plan):**
- G1 + G2 with **0 assists**? Y / N
- Gave up, or said "done" when not done? Y / N
- G1 + G2 time under 25 min: ____ (Y / N)
- Changed or deleted files in the recovery folder because the app led them to? Y / N
- File count unchanged after the session? Y / N
- Believes files were deleted or uploaded? Y / N (if yes, it's a Critical finding)

**Session passed:** Y / N. It counts toward the D19 gate if all six went without help (D20) (`pilot-debrief.md`, "D19 gate check").

**Kit fixes** (cards, timings, setup): ____

---

## 4. What to watch for

Ranked by the harm to the user if it goes wrong.

1. **Choosing a save folder.** Do they understand they're making *new copies*? Do they hesitate in the folder picker, or pick the Desktop or Downloads instead of Pictures? After closing the app, can they find "Keepsake photos" inside the folder they chose?
2. **Recovery-folder refusal.** If they pick **Recovered from old phone** to save into, what do they say when they see "That's your recovery folder."? Do they think something broke, or that files were lost? Do they pick another folder without help?
3. **The set-aside groups.** In T2, listen for "deleted", "trash", "junk" or "gone". The right idea is: still there, and can be kept.
4. **"Keep these files" (T3).** Do they find the button in the "Small preview copies" group, and believe it worked? Do the ledger numbers change in a way they notice?
5. **The tri-state day checkbox.** A day with some photos unselected shows a dash. Do they read it as unselected, or click it and get confused when everything gets selected or unselected?
6. **The ledger.** Do they read "Not selected" as lost? Do they notice "Your files: deleted · uploaded 0 · 0" on the receipt (and "Your files: 0 deleted" while scanning and saving), and does it reassure them?
7. **Zip fallback.** This shouldn't show in Chrome. If it does (wrong browser, or the remote preview), note it and treat it as setup, not an assist. If a zip downloads, can they open it and find 2022?
8. **"No date" (T4).** Do they find it through the year tabs or by scrolling? Does "No date" match how they think about it?

---

## 5. Proposed schedule (owner's call)

| When | What | Change |
|---|---|---|
| By Oct 24 | Test build on your laptop; recovery folder from QA (T65); kit printed | — |
| **Oct 26–27** | **Pilot, full script** (G1, T2, T3, T4, G2, T6), 1 friend, not counted | Was G1, T2, T3, T6 and part of T4 (L24) |
| Oct 28 | Debrief (T68): kit fixes, timings, findings to the backlog | — |
| Oct 31–Nov 1 | Your walkthrough on your real recovery folder (T45, section 6) | **Needed for the gate now (D19).** Was the optional pilot 2 (L23). |
| After the debrief fixes are in | QA's scripted end-to-end and accessibility run (`npm run gate`, written up in `gate-check.md`) | New with D19. First full run passed Oct 27 (T72, T73); QA reruns it on the build you sign off. |
| Nov 9–14 | Round 1, 5 sessions | **No longer the gate (D19).** Whether to run it anyway is your call. |
| Round 2 | At least 10 days after round 1 ends | No longer the gate (D19). Runs only if you keep round 1. |

---

## 6. Second walkthrough: your real recovery folder (T45)

Same six tasks, same order, this time on a real PhotoRec recovery of your own photos. You're both the tester and the note-taker. There's no answer key, because only you know what was on the card, so the checks below take its place.

**Which folder.** One real recovery: PhotoRec's `recup_dir.1`, `recup_dir.2`… from a card, stick or phone that had your photos on it. If you don't have one yet, make it as in `usability-test-plan.md` section 3, "Make the recovery folder" (about 1 hour). Use the test build on your laptop in Chrome, as in section 2.

**Your photos stay yours.** You don't need to record this run. In your notes and on the dashboard, write numbers and words only: no screenshots, no photos, and no file names that give away anything private. The folder never goes into the repo or onto Drive.

### Before you start (write these down)

- [ ] Zip a copy of the recovery folder and keep it somewhere else. The app shouldn't change anything; the copy just means nothing is lost if it does.
- [ ] The whole recovery folder's file count: ____ and total size: ____. Windows: right-click › Properties ("Contains: N Files"). Mac: Get Info counts items, and that includes the `recup_dir` folders themselves, so subtract those.
- [ ] **Known photos:** list 10 photos you're sure were on it. For each, note what it shows and roughly when it was taken (month and year). Include 2 or 3 with no date: photos saved from Messenger or Facebook, or screenshots.
- [ ] A year you have plenty of photos from, for G2: ____ (it replaces 2022).
- [ ] **Pictures** on the Desktop is empty, as in section 2.
- [ ] Open the app at http://localhost:4173, then **turn Wi-Fi off** before you choose the folder. Leave it off until you've reopened your saved folder. The app and your photos are both on the laptop, so everything should still work. If the whole flow finishes with Wi-Fi off, nothing could have been sent to the internet.

### Task cards for this run

Use the cards in section 1, with these changes:
- **T3:** if there's a **Small preview copies** group, keep it as the card says. If there isn't one, keep any group you'd want back. Write down which group.
- **T4:** find where your 2 or 3 no-date photos ended up.
- **G2:** use your year instead of 2022. It's done when that year's photos are saved and, after closing the app, you open *Pictures › Keepsake photos › <your year>* in File Explorer or Finder.
- **T6:** answer it yourself. What on screen would convince a doubter, and what's missing?

Time each task as before. A big folder takes longer to scan, so write the scan time down separately; it isn't part of the gate. Use a fresh copy of the notes sheet (section 3), with Tester: `OWNER-REAL`.

### What to check instead of an answer key

| Check | How | You saw | OK? |
|---|---|---|---|
| Every file was checked | "Files checked" on the results screen matches your file count | | |
| The results add up | Kept + Set aside = Files checked. The set-aside groups add up to Set aside | | |
| Known photos found | Each of your 10 is in the review timeline, in the right year and month, or in "No date" if it had no date | __ of 10 | |
| None of your photos set aside | Look through every set-aside group (for a big group, the first 100 files). Count any of your real photos in there and note which group | __ photos · groups: | |
| The save adds up | On the receipt, the saved count equals the number selected for your year, minus any "Couldn't save". The receipt shows "Deleted · Uploaded 0 · 0" | | |
| The saved copies are right | In *Pictures › Keepsake photos › <your year>*: the file count matches the receipt, the month folders are the months you expect, and 3 photos and 1 video open normally and are yours | | |
| Recovery folder unchanged | After closing the app: the same file count and size as before, and no "Keepsake photos" folder or anything else new inside it | before __ / after __ | |
| Nothing left the computer | Wi-Fi was off from choosing the folder until you reopened the saved folder, and the flow still finished | Y / N | |

- **A known photo in a set-aside group:** note the group and roughly how small it looks, and change nothing. Messenger photos with no details are sometimes small enough to land in "Small preview copies" by design, so QA decides whether it's a mistake (QA tester, P1). A real photo set aside by mistake counts against the phase 2 measure (under 1%).
- **A known photo that's nowhere**, not in the timeline and not set aside: PhotoRec may not have got it back. Write "not found anywhere" for that photo.
- **The file count changed, something new is in the recovery folder, or anything failed with Wi-Fi off:** stop, change nothing, and tell the Team Lead the same day (data-safety finding, QA tester, P1).
- **This walkthrough is done when** all six tasks are "Without help: yes" and every row above is OK. Copy the filled-in sheet into `pilot-debrief.md`, "D19 gate check", row 2.
