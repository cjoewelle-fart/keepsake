# Pilot debrief (T68)

For the owner, Oct 28. Fill in from your notes from the Oct 26–27 pilot. You ran it yourself on your laptop, in the test build, on **Recovered from old phone**. It doesn't count toward the gate; it's practice.

Date run: ____ · Build (commit or tab title): ____ · G1 + G2 total time: ____ (target under 25 min)

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
- Without help: yes / with a hint / no · Time: __:__
- Where it stalled:
- Exact words that confused: "____"
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ (role) · P_ · ____

## T2 What was set aside (limit 4 min)
Expected answer: they're leftovers (small previews, copies, damaged and app files), nothing was deleted, they're still in the recovery folder, and any group can be kept.
- Without help: yes / with a hint / no · Time: __:__ · Screen made the answer clear: correct / partly / wrong
- Where it stalled:
- Exact words that confused: "____" (watch for anything that reads like "deleted", "trash", "junk" or "gone")
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ · P_ · ____

## T3 Keep the small copies (limit 4 min)
Expected: open **Small preview copies (204)** › **Keep these files** → title says 418, ledger shows Kept 418 · Set aside 105.
- Without help: yes / with a hint / no · Time: __:__ · Noticed the numbers change: yes / no
- Where it stalled: (for example, the group also holds app icons and gallery thumbnails)
- Exact words that confused: "____"
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ · P_ · ____

## T4 Find photos with no date (limit 4 min)
Expected: chip "No date · 20". Timeline "No date" has 20, or 224 if you kept the previews in T3.
- Without help: yes / with a hint / no · Time: __:__ · Got there by: year chip / scrolling / other ____
- Where it stalled:
- Exact words that confused: "____"
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ · P_ · ____

## G2 2022 into a folder, then find it (limit 17 min)
Expected: 2022 has 44 files. They save to *Pictures › Keepsake photos › 2022* (12 month folders), and you reopen that folder in File Explorer or Finder after closing the app.
- Without help: yes / with a hint / no · Time: __:__
- What you saved: 2022 only / everything / other ____ (whether "everything" counts as done is an owner call; see below)
- Folder picker: picked Pictures / Desktop / Downloads / the recovery folder (saw "That's your recovery folder."?) ____
- Zip fallback appeared: yes / no (it shouldn't in Chrome)
- Reopened the 2022 folder after closing the app: yes / no
- Where it stalled:
- Exact words that confused: "____"
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ · P_ · ____

## T6 Uploads? (limit 4 min)
Expected: the ledger shows "Deleted · Uploaded 0 · 0".
- Without help: yes / with a hint / no · Time: __:__
- What on screen would convince a doubter: ____ · What's missing: ____
- Exact words that confused: "____"
- Severity: blocks / slows / cosmetic · Fresh user would stall here: likely / unsure / no
- Becomes task: ____ · P_ · ____

---

## Check: your numbers against the answer key

| What | Answer key | You saw | Match? |
|---|---|---|---|
| Files checked | 523 | | |
| Kept, sorted by date | 214 | | |
| Set aside | 309 | | |
| Small preview copies / Exact copies / Damaged / App and system | 204 / 22 / 2 / 81 | | |
| Year chips 2024 / 23 / 22 / 21 / 20 / 19 | 27 / 37 / 42 / 32 / 28 / 22 | | |
| No date chip | 20 | | |
| After keeping small previews: kept / set aside | 418 / 105 | | |
| Timeline 2022 | 44 (42 photos + 2 videos) | | |
| Timeline No date | 20 (224 if previews kept) | | |
| Saved 2022 month folders / files | 12 (Jan–Dec) / 44 | | |

Any mismatch → **QA tester, P1**: rerun `eval/pilot.eval.test.ts` and find out why. A real photo set aside by mistake counts against the phase 2 gate (under 1%).

## Safety and privacy (observations only)

- [ ] Recovery folder file count before: ____ after: ____ (both should be 523)
- [ ] No file in the recovery folder renamed, moved or changed
- [ ] Saved copies are in *Pictures › Keepsake photos*, nothing new in the recovery folder
- [ ] Nothing left the computer. How you checked (or "not checked"): ____
- [ ] Receipt shows "Deleted · Uploaded 0 · 0"; "Your files: 0 deleted" showed while scanning and saving
- [ ] Anything that *looked* like a delete or upload, even if it wasn't one: ____

If any box isn't ticked: write down what you saw, change nothing, and tell the Team Lead the same day (data-safety finding, QA tester, P1).

## Kit and timings

- Tasks over their time limit: ____
- Kit fixes (cards, setup, checklist): ____ → Product owner, P2
- What this suggests for the new phase 3 gate (D19) or a walkthrough on a real folder (T45): ____

## Owner decisions, not tasks

Some problems can't be fixed by changing words or layout. Don't make these into tasks. Raise them on the dashboard as **"Decision for owner: problem · options · what the pilot showed"**:
- Anything that would change the **privacy promise**: no server, files never leave the computer.
- Anything that would change the **no-delete promise**: the recovery folder stays read-only, and every cleanup choice can be undone.
- **Scope:** anything outside the phase 3 MVP, for example similar-photo grouping, repair or more file types. Those come after launch.
- **The gate:** the pass rule, what counts as done (for example, saving everything in G2), or whether other testers come back in.
