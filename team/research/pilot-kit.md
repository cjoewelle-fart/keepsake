# Pilot kit: usability pilot, Oct 26–27 (T66)

By the Product owner, Oct 22, 2026. For the owner. 1 friend, **not counted** toward the gate. Goal: run the full script once, time each task, fix the kit. Rules, assists and script: `usability-test-plan.md` sections 1 and 5.

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

**Session passed:** Y / N. It doesn't count; it's for practice.

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
| Oct 31–Nov 1 | Pilot 2 on your real folder (L23) | **Optional now.** Keep it if the pilot is remote (skips G2) or the debrief changes the script a lot. |
| Nov 9–14 | Round 1, 5 counted sessions | **Option:** start earlier, from about Nov 2, *only if* you have 5 screened testers by then and the debrief fixes are in. Your call. |
| Round 2 | At least 10 days after round 1 ends | Moves earlier only if round 1 does |
