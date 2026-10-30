# Usability test plan: phase 3 gate (T31)

By the Product owner, Oct 16, 2026. For the owner, who runs the sessions.
Gate: **"5 non-technical testers finish the task without help."** Passing or failing it is the owner's call (Tier 1); this plan gives the rule and the evidence.

Quick links: [1 Goal and pass rule](#1-goal-and-pass-rule) · [2 Who](#2-who) · [3 Setup](#3-setup) · [4 Tasks](#4-tasks) · [5 Script](#5-moderator-script) · [6 Notes sheet](#6-what-to-observe-and-record) · [7 Scoring](#7-scoring-and-reporting) · [8 Timeline](#8-timeline)

---

## 1. Goal and pass rule

**Goal.** Find out if a stressed, non-technical person can go from "a folder of recovered files" to "my photos, sorted by date, in a folder I can find again", and believe nothing was deleted or uploaded.

**The task the gate measures** (the "gate tasks", marked **G** in section 4):
- **G1** Choose the recovery folder and scan it.
- **G2** Save the photos into a folder, then find that folder again after closing the app.

The other tasks tell us what to fix, but don't decide the gate on their own (except the trust rule below).

**What counts as an assist** (each one is counted):
- Pointing at, naming or describing a button, link or part of the screen.
- Explaining what a word or screen means ("set aside means…").
- Answering "should I click this?" / "is this right?" with anything but a neutral prompt.
- Touching the mouse or keyboard to move the task forward.
- Telling them they're done, or that they're not done yet.
- Re-explaining the goal in a more specific way than the task card (e.g. "you need to export").

**Not an assist:**
- Neutral prompts from section 5 ("What would you do if I weren't here?").
- Reading the task card again, word for word.
- Fixing a problem that isn't the app: the call drops, the laptop sleeps, the zip won't download, the folder isn't on their computer yet. Note it, but don't count it.
- Anything said after the session ends.

**A session fails if any of these happen in G1 or G2:**
- 1 or more assists.
- The tester gives up, or says they're done when they aren't (e.g. they think the photos are saved but they aren't).
- Over 25 minutes for G1 + G2 together (moderator time, not counting setup problems).
- The tester changes or deletes files in the recovery folder because the app led them to.

**Trust rule (any task).** If a tester ends the session believing their files were deleted or uploaded, log it as a Critical (4) finding, even if they finished. The gate can't pass with a Critical finding open.

**The gate passes when** 5 testers in a row pass on the same build, with no failed session on that build, and no open Critical finding. If a session fails, the team fixes the cause; the next build starts the count again. Repair-shop staff count toward the 5 only if they pass the screener (section 2).

---

## 2. Who

**5 testers per round, 2 rounds, 10 different people.** Nobody tests twice; nobody who has seen Keepsake or the team's screens.

Each round must include:
- [ ] At least 2 who mostly use a phone, not a computer.
- [ ] At least 1 aged 45+ (try for one 60+), and at least 1 under 30.
- [ ] At least 1 phone repair-shop staff member (counter staff or technician).
- [ ] A mix of men and women.

### Screener (ask in chat or on the phone)

| # | Question | Keep if | Otherwise |
|---|---|---|---|
| 1 | Do you work or study in IT, programming or software? | No | Don't invite |
| 2 | Have you ever used a recovery program like PhotoRec, or typed commands into a black "command" window? | No | Repair staff: run as a bonus session, don't count it. Others: don't invite |
| 3 | Have you ever lost photos from a phone, memory card or computer? If not: how would you feel if you lost all the photos on your phone? | Lost photos, or "I'd be very upset" | Don't invite |
| 4 | How old are you? (18–29 / 30–44 / 45–59 / 60+) | Fill the mix above | — (18+ only) |
| 5 | What do you use most: phone, computer, or both the same? | Fill the mix above | — |
| 6 | For a video call: can you use a laptop or desktop with Chrome, and share your screen? | Yes | Test in person on your laptop |
| 7 | English, Taglish or Tagalog? | Any | Run the session in that language |

Close family is OK, but note it: they're more likely to say nice things. Aim for at most 2 close family per round.

### Recruiting message (English)

> Hi [name]! I'm helping test a free app (working name: Keepsake) that sorts photos after they've been recovered from a broken or wiped phone or memory card. I'm looking for people who are **not** "techy" to try it for about 45 minutes, in person or on a video call, sometime between [dates]. You won't use your own photos; I'll bring test ones. There are no wrong answers: we're testing the app, not you. [Merienda's on me.] Interested? Send me 2 or 3 days and times that work for you.

### Recruiting message (Taglish)

> Hi [name]! May tine-test akong libreng app (Keepsake muna ang pangalan). Inaayos niya yung mga photos na na-recover galing sa sira o na-reset na phone o memory card. Naghahanap ako ng mga **hindi** masyadong techy para i-try siya, mga 45 minutes lang, puwedeng personal o video call, sometime [dates]. Hindi mo kailangang gamitin yung sarili mong photos, may dala akong pang-test. Walang tama o maling sagot, yung app ang tine-test, hindi ikaw. [Libre merienda!] G ka ba? Send mo lang 2 o 3 na araw at oras na okay sa'yo.

### For a repair shop (Taglish)

> Hi po! Ako po si [name], UX designer. May tine-test po kaming libreng app na nag-aayos ng mga photos na na-recover sa phone o memory card ng customer. Puwede po ba akong humingi ng 30–45 minutes sa isa sa staff niyo para i-try ito, dito lang po sa shop, sa oras na hindi kayo busy? May dala po akong laptop at pang-test na files, hindi po namin kailangan ng files ng customer. Salamat po!

A small thank-you (merienda, load) is your call; anything that costs money is yours to decide.

---

## 3. Setup

### What you need

| Item | Notes |
|---|---|
| Laptop with Chrome (latest) | Your laptop for in-person sessions. Remote testers use their own laptop with Chrome. The app is for computers, not phones. |
| The test build | The test build running on your laptop at http://localhost:4173 (pilot kit section 2), without the "Try with example files" button, so testers use the recovery folder like a real user. Saving doesn't work in the claude.ai preview, so don't use it for sessions. Check that "Choose recovery folder" opens the folder picker. |
| A prepared recovery folder | See below. Same folder for every session in a round. |
| Task cards | One card per task (section 4), printed or ready to paste into chat. |
| Notes sheet | Section 6, one per tester. |
| Recording | In person: phone on a stand pointed at the screen, plus voice. Remote: Google Meet or Zoom recording of the shared screen. |
| Timer | Phone stopwatch. |

### Make the recovery folder

**Best: a real recovery of photos you own (about 1 hour, once).** It looks and behaves like what testers would really get.
1. Pick 150–300 of your own photos you're happy for testers to see (no IDs, no private moments). Include:
   - photos from 3–4 different years, with a good number from **2022**;
   - 10–20 photos saved from Messenger or Facebook (these lose their date, so some will land in **No date**);
   - a few screenshots.
2. Copy (don't move) them from your laptop to a spare memory card or USB stick you can wipe. Your originals stay on the laptop.
3. Quick-format the card or stick. Only do this to a spare card or stick whose photos are all also on your laptop.
4. Run PhotoRec on it and save the output into a new folder on your laptop (the writer's PhotoRec guide, T26, walks through it; or ask the Team Lead for help). You'll get folders named `recup_dir.1`, `recup_dir.2`…
5. Put them in a folder on the Desktop called **Recovered from old phone**. Zip a master copy and keep it safe.

**Faster: the team's synthetic folder.** Ask the Team Lead to run `npm run fixture`, which makes `fixtures/recovery` with dates from 2019 to 2024, undated photos, copies, previews and broken files. Downside: the "photos" are colour blurs, so testers can't recognise anything. Fine for the pilot; use the real recovery for rounds 1 and 2.

**Remote testers:** share the master zip by Google Drive a day before. At the start of the call, help them download and unzip it to the Desktop as **Recovered from old phone**. This is setup, not an assist.

**Don't use the testers' own photos.** It protects their privacy, and keeps the recordings clean.

### Consent and recording

Read this before you press record, then ask again once it's recording so their "yes" is on the recording:

> "I'd like to record the screen and our voices so I don't miss anything. Only the Keepsake team will see it, I'll use it only to improve the app, and I'll delete it within 30 days. Your name won't be in any report. You can stop any time, no need to explain. Is that OK?"

> Taglish: "Okay lang ba kung i-record ko yung screen at boses natin, para hindi ako makalimot? Kami lang sa Keepsake team ang makakakita, para lang ma-improve yung app, at ide-delete ko within 30 days. Hindi lalabas ang pangalan mo sa report. Puwede kang huminto anytime, walang tanong. Okay lang ba?"

Use first names or codes (R1-P1, R1-P2…) in notes. Store recordings on your own drive, not in the repo. This follows the Philippine Data Privacy Act's basics: tell them why, get a clear yes, keep only what you need.

### Pre-session checklist (10 minutes before)

- [ ] Laptop charged, notifications off (Do Not Disturb), other tabs and apps closed.
- [ ] Chrome open on a **fresh tab**; the test build link ready but not open. Bookmarks bar hidden if it shows your team links.
- [ ] **Recovered from old phone** on the Desktop. If it was changed in any way, replace it from the master zip.
- [ ] Last session's saved photos folder deleted (the export output, not the recovery folder). Downloads folder cleared of earlier zips.
- [ ] Note the recovery folder's file count (right-click > Properties / Get Info). You'll check it again after the session: it must not change.
- [ ] Task cards in order; notes sheet with the tester's code.
- [ ] Recorder tested (5-second test, play it back).
- [ ] Remote: tester's laptop has Chrome, they can share their screen, zip is unzipped on their Desktop.
- [ ] Which tasks run on this build (section 4 table) checked.

---

## 4. Tasks

Give each task as a card or read it out. Don't name buttons or screens. Stop a task when they say they're done, give up, or hit the time limit.

**Scenario, read once at the start:**
> "Imagine your old phone stopped working and all your photos seemed to be gone. A friend who's good with computers ran a recovery program on its memory card. It saved everything it found into a folder on this laptop, called 'Recovered from old phone'. Your friend told you to use Keepsake to sort it out. Here's the app."

> Taglish: "Isipin mo na nasira yung luma mong phone at parang nawala lahat ng photos mo. May kaibigan kang magaling sa computer na nag-run ng recovery program sa memory card nito. Sinave niya lahat ng nahanap sa isang folder dito sa laptop, 'Recovered from old phone' ang pangalan. Sabi niya, gamitin mo raw yung Keepsake para ayusin. Ito na yung app."

| # | Task card (say this) | Done when | Limit | Can run now? |
|---|---|---|---|---|
| **G1** | "Use the app to find the photos in the files your friend recovered." | Scan finished and they're on the results screen | 8 min | **Yes** |
| T2 | "The app says it put some files aside. In your own words, what are those files, and what happened to them?" | They explain it out loud. Correct = leftovers/copies, still there, can be kept | 4 min | **Yes** |
| T3 | "Your tita says some of the photos she sent you were tiny ones from Messenger. You want to keep those little pictures too, just in case." | They keep the "Small preview copies" group | 4 min | **Yes** (results screen) |
| T4 | "You remember a photo someone sent you on Messenger. It might not have a date. Find where photos like that ended up." | They reach the Undated group and see its photos | 4 min | **Partly now** (results only says how many). Full task **after Sprint 2** (review timeline) |
| **G2** | "Get your photos from 2022 into a folder on this laptop that you can find later." Then close the app and say: "Now show me where your 2022 photos are." | 2022 photos saved, and they open that folder in File Explorer / Finder | 17 min | **After Sprint 2** (review timeline + export) |
| T6 | "A friend tells you apps like this secretly upload your photos to the internet. Do you think this one does? What makes you think that?" | They answer and point to what convinced them (or didn't) | 4 min | **Yes** (privacy line). Privacy page **after the MVP backlog**. Don't ask them to test with Wi-Fi off until QA confirms offline works. |

**Run order:** G1, T2, T3, T4, G2, T6.

**Before Sprint 2 (pilot):** run G1, T2, T3, T6 and the results-screen part of T4. The gate itself can only run once G2 works.

**After the session:** check the recovery folder's file count matches what you noted. If it doesn't, stop testing and tell the Team Lead right away (data-safety finding).

---

## 5. Moderator script

Read the bold lines word for word. About 45 minutes.

### Intro (5 min)

**"Thanks for doing this. I'm testing a new app that sorts photos after they've been recovered from a broken phone or memory card."**

**"I want to be clear: we're testing the app, not you. If something's confusing, that's the app's fault, and that's exactly what I need to find. You can't do anything wrong."**

**"I helped work on it, but I won't be hurt by anything you say. Honest is more useful than nice."**

**"I'll mostly stay quiet and won't be able to help or answer questions while you're doing the tasks. That's on purpose: I want to see how it works when you're on your own. I'll answer everything at the end."**

**"You can stop or take a break any time."**

> Taglish: "Salamat sa oras mo! App ang tine-test natin, hindi ikaw. Kung may nakakalito, kasalanan ng app yun, at yun mismo ang kailangan kong makita. Wala kang magagawang mali. Huwag kang mahiya, mas okay sa'kin ang honest kaysa nice. Hindi muna ako makakatulong o makakasagot habang ginagawa mo yung tasks, para makita ko kung paano kapag mag-isa ka lang. Sasagutin ko lahat sa dulo. Puwede kang huminto anytime."

Then consent and recording (section 3).

### Warm-up (3 min)

1. **"What do you mostly use: your phone, a computer, or both?"**
2. **"Have you ever lost photos, or come close? What happened?"**
3. **"Where do you keep photos you really care about?"**

### Think-aloud (1 min)

**"While you work, please talk out loud: what you're looking at, what you're trying to do, what you expect to happen. If you go quiet, I'll remind you."**

> Taglish: "Habang ginagawa mo, please sabihin mo nang malakas kung ano ang tinitingnan mo, ano ang gusto mong gawin, at ano ang inaasahan mong mangyari. Kapag natahimik ka, ire-remind kita."

Practice (optional): **"Try it now: open the Chrome browser and tell me what you see."**

### During tasks: neutral prompts only

| Situation | Say | Taglish |
|---|---|---|
| They go quiet | "What are you thinking right now?" | "Ano'ng iniisip mo ngayon?" |
| They ask "Should I click this?" | "What do you think would happen if you did?" | "Ano sa tingin mo ang mangyayari kapag pinindot mo?" |
| They ask "Is this right?" | "What would you do if I weren't here?" | "Ano ang gagawin mo kung wala ako dito?" |
| They seem stuck | "What are you looking for?" | "Ano ang hinahanap mo?" |
| They say something interesting | "Tell me more about that." | "Kuwento mo pa." |
| They react ("Oh!", a frown) | "What did you just notice?" | "Ano yung napansin mo?" |
| They want to give up | "Take your time. If you'd stop here in real life, that's OK too. Would you?" | "Dahan-dahan lang. Okay lang kung dito ka na hihinto sa totoong buhay. Hihinto ka na ba?" |
| They say they're done | "OK, thanks." (Nothing else. Don't confirm.) | "Okay, salamat." |

**Don't say:**
- Names of buttons or screens ("export", "review", "set aside", "Undated", "Keep these files").
- "Good", "Perfect", "That's right", "Almost". Use "OK" or "Thanks" for everything.
- "Delete", "upload", "safe" or "private" before T6. They'll hear what they're testing.
- "Most people…", "It's easy, just…", "Don't worry, it doesn't delete anything."
- Don't sigh, nod or lean in when they get close. Keep your hands off the laptop.

**If they're truly stuck** (no progress for 3 minutes, or upset): say **"Let's pause this one. Can you show me where you were stuck?"**, then mark the task "not completed". If it's G1 or G2 and you need them to continue, help them through it, count every assist, and carry on with the next task.

### Post-test (5 min)

Ask in this order:
1. **"In one sentence, what does this app do?"**
2. **"Was there a moment you felt unsure or worried? Tell me about it."**
3. **"If you really had lost your photos, would you use this? Would you tell a friend to? Why or why not?"**

> Taglish: 1. "Sa isang sentence, ano ang ginagawa ng app na 'to?" 2. "May time ba na hindi ka sigurado o nag-alala ka? Kuwento mo." 3. "Kung talagang nawala ang photos mo, gagamitin mo ba 'to? Irerekomenda mo ba sa kaibigan? Bakit o bakit hindi?"

Then the two ratings (say the scale each time):
- **Confidence:** "From 1 to 5, how sure are you that your photos are now saved where you can find them? 1 is not sure at all, 5 is completely sure."
- **Trust:** "From 1 to 5, how much do you trust that this app didn't delete or upload your files? 1 is not at all, 5 is completely."

> Taglish: "Mula 1 hanggang 5, gaano ka kasigurado na naka-save na ang photos mo kung saan mo sila mahahanap?" / "Mula 1 hanggang 5, gaano ka nagtitiwala na walang dinelete o in-upload ang app sa files mo?"

### Wrap-up (2 min)

**"That's everything. Thank you, this really helps. Do you have any questions for me? Now I can answer anything."**

Answer their questions, show them anything they missed, and stop the recording.

---

## 6. What to observe and record

### Notes sheet (one per tester)

Tester: `R_-P_` · Date: ____ · In person / video · Language: EN / Taglish · Age range: ____ · Mostly phone / computer / both · Repair shop: Y/N · Build: ____

| Task | Completed? (Y / Y with help / N) | Assists (count + what you said) | Time (m:ss) | What they did (path, wrong turns) | Quotes | Trust signals (+) / worries (−) |
|---|---|---|---|---|---|---|
| G1 Find the photos | | | | | | |
| T2 What was set aside | Correct / partly / wrong | | | | | |
| T3 Keep the small copies | | | | | | |
| T4 Find undated | | | | | | |
| G2 2022 photos to a folder + find it | | | | | | |
| T6 Uploads? | | | | | | |

**Post-test**

| Q1 What the app does | Q2 Unsure / worried moment | Q3 Would use / recommend | Confidence 1–5 | Trust 1–5 |
|---|---|---|---|---|
| | | | | |

**Session result:** G1 + G2 passed without help? **Yes / No** · Recovery folder file count unchanged? **Yes / No** · Believes files were deleted or uploaded? **Yes / No**

### What to watch for

- **Hesitation:** pauses over 10 seconds, hovering, scrolling up and down looking for something.
- **Wrong turns:** clicking things that don't move them forward, going back, starting over.
- **Words they use** for things: "trash", "deleted", "junk", "backup". Their words are the copy we should test.
- **Trust signals (+):** reads the privacy line, says "OK so it's still there", relaxes after the results count.
- **Worries (−):** "Did it delete them?", "Is this uploading?", "Where did they go?", hesitates before choosing the folder, asks about Google or Facebook.
- **Done-but-not-done:** says they've saved the photos, but they haven't, or can't find them later.
- **Phone habits:** looking for a share button, expecting a gallery, swiping on a trackpad.

---

## 7. Scoring and reporting

### Severity scale

| Level | Meaning | Example |
|---|---|---|
| **4 Critical** | Stops the task, fails a gate session, or leaves someone believing files were deleted or uploaded | Can't find how to save photos; thinks set-aside files are gone |
| **3 Major** | Causes a long delay, a wrong turn they recover from, or a real worry | Opens a set-aside group thinking it's the photos; 3 minutes looking for the year |
| **2 Minor** | Small hesitation or confusion, fixed quickly | Re-reads a heading before moving on |
| **1 Cosmetic** | Mentioned, no effect on the task | "This colour is a bit pale" |

### From notes to findings (within 2 days of each round)

1. Go through each notes sheet (and the recording if a moment is unclear). Write each problem on its own line: tester, task, what happened, severity.
2. Group the same problem across testers into one finding. Count how many testers hit it (e.g. 3 of 5).
3. Rank by severity, then by how many testers hit it.
4. For each finding, write: what happened (facts), one quote, a guess at why, and a suggested fix. Keep facts and guesses apart.
5. Note what worked well too: things to keep.
6. Hand the findings to the Product owner (or put them in `team/research/usability-round-1.md` / `-round-2.md`); the Team Lead turns them into tasks.

### Report (one page per round)

- **Result:** sessions passed of 5; gate-ready yes/no.
- **Per tester:** G1 / G2 pass or fail, assists, time, confidence, trust.
- **Findings table:** # · finding · severity · testers (x of 5) · quote · suggested fix.
- **Trust:** confidence and trust ratings (median and lowest), and every deleted/uploaded worry.
- **Recovery folder unchanged** in every session: yes/no.
- **Top 3 fixes** before the next round.

### What passes the gate

- 5 testers in a row pass G1 + G2 with **0 assists** on the same build, with no failed session on that build.
- **No open Critical (4) finding**, including no tester who believes files were deleted or uploaded.
- The recovery folder's file count was unchanged after every session.

Also reported, but your call rather than an automatic fail: a median trust or confidence rating below 4, or any Major finding hit by 3 or more testers.

Round 1 is for finding problems; expect it to fail. Round 2 is the gate round.

---

## 8. Timeline

Dates follow the current forecast: Sprint 2 (review timeline and export) Oct 26–Nov 1, MVP complete about Dec 6, private beta from Dec 7. Holidays Dec 21–Jan 3.

| When | What | Build |
|---|---|---|
| Oct 19–30 | Recruit 10 testers + 2 spares; screen them | — |
| By Oct 24 | Get the test build without the example-files button; make the recovery folder | Current |
| **Oct 26–27** | **Pilot** with 1 friend (not counted): G1, T2, T3, T6, T4 partly. Time each part; fix the script and setup | Current build |
| Nov 4–5 | Pilot 2 (not counted): G2 and T4 once export and the timeline work | After Sprint 2 |
| **Nov 9–14** | **Round 1**: 5 sessions on the full flow (privacy page and offline may still be missing) | MVP in progress |
| Nov 16 | Round 1 report; fixes go into the backlog | — |
| **Nov 30–Dec 4** | **Round 2 (gate round)**: 5 new testers | MVP release candidate |
| Dec 5 | Round 2 report and gate recommendation | — |
| **Dec 6** | **You decide the gate.** If it fails: fix, run make-up sessions with new testers on the fixed build, and decide whether the beta start moves | — |

If Sprint 2 slips, round 1 moves with it; keep at least 10 days between round 1 and round 2 for fixes.
