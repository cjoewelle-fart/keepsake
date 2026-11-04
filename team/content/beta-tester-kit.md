# Beta tester kit

<!-- T86 · UX writer · 2026-11-04. Decisions D26 (working name), D27 (unlisted web address), D28 (testers, form, call). Placeholders: [APP LINK], [FORM LINK], [END DATE], [their name], [your name]. [CONFIRM: …] = check before sending. Notes in <!-- --> are for the team, not testers. Screen labels checked against src/ui/copy.ts on Nov 4: "Choose recovery folder", "Review my {n} photos and videos", "Save {n} selected", "Choose a folder", "Download zip file", folder "Keepsake photos". Re-check after T92 fixes and the rename (T94). -->

The owner sends every part of this kit as themself. "I" and "me" mean the owner.

---

## 1. Invite message

<!-- Under 120 words (111). For chat or email. Swap in the tester's name. -->

> Hi [their name]! I'm working on a small app called Keepsake, and I'd love your help testing it. (Keepsake is a working name. It may change.)
>
> When people get lost photos back from a memory card, the files come back mixed up. Keepsake finds the photos and sorts them by date. It runs in your web browser, on your own computer. Nothing is uploaded and nothing is deleted.
>
> Could you try it once before [END DATE]? It takes about 30 minutes, plus a 2-minute form. You don't need lost photos. I can send you an example folder.
>
> If yes, just reply and I'll send the link and a short guide. Thank you!

<!-- [CONFIRM: "about 30 minutes" end to end on the example folder. A big real recovery folder takes longer to check; the guide says so.] -->

---

## 2. How to start

**Keepsake sorts the files a recovery program got back, and saves the photos and videos in folders by date. It all happens on your computer.**

Keepsake is a working name. The app may have a different name when it comes out.

### What you need

- **A computer.** Windows or Mac. A phone or tablet won't work for this test.
- **Chrome or Edge, if you can.** These save your photos straight into a folder. Firefox and Safari work too, but they save your photos as zip files instead. That way is less tested, so please tell us how it went.
- **A folder of recovered files.** This is the folder PhotoRec (or another recovery program) saved files into. It usually has folders inside called `recup_dir.1`, `recup_dir.2` and so on.
  No folder like this? That's fine. Ask me for an example folder and I'll send you one.
- **Some free space** on your computer for the sorted copies.

<!-- [CONFIRM: how the example folder reaches testers (Drive zip of "Recovered from old phone", as in the pilot kit) and whether the hosted beta also shows "Try with example files". If the button is there, add: "Or click Try with example files on the first screen."] -->

### Steps

**1. Open Keepsake.**
Go to [APP LINK] in Chrome or Edge. There's nothing to install and no account to make.

**2. Choose your recovery folder.**
Click **Choose recovery folder**. Pick the folder that holds the `recup_dir` folders (not one of the `recup_dir` folders itself).
Your browser may ask something like "Let this site view files?" or "Upload files to this site?". That is the browser's own wording. Your files are only read on this computer. They are not sent anywhere.
<!-- [CONFIRM: the exact browser prompts on the hosted beta. Chrome/Edge use the folder picker ("view files"); Firefox/Safari use the file input, which may say "upload". Keep only the wording testers will really see.] -->

**3. Wait while Keepsake checks your files.**
You'll see a count going up. A small folder takes a minute or two. A big one can take longer. You can stop any time, and nothing will be changed.

**4. Look at what Keepsake found.**
Keepsake shows how many photos and videos it found, and how many files it set aside. Set-aside files are things like small preview copies, copies of the same photo, and broken files. Nothing was deleted. They stay in your recovery folder, and you can keep any of them.
Click **Review my … photos and videos** to see them sorted by date. Choose the ones you want.

**5. Save your photos.**
Click **Save … selected**.
- **In Chrome or Edge:** click **Choose a folder**, and pick a place you'll find again, like Pictures. Keepsake makes a folder called **Keepsake photos** inside it, sorted by year and month. Your browser may ask if the site can edit files in that folder. Say yes. It only adds new copies.
- **In Firefox or Safari:** click **Download zip file**. The zip goes to your Downloads folder. Open it to see your photos. A big save may come as more than one zip. If your browser asks to allow several downloads, choose **Allow**.

Then open the saved folder (or zip) and check a few photos. Do they look right? Are they in the right year and month?

<!-- [CONFIRM: Chrome/Edge write-permission prompt wording ("Let site edit files?") on the hosted build.] -->

### What Keepsake will do

- Read your recovery folder, on this computer.
- Find the photos and videos, and sort them by the date each one was taken. Photos with no date go in a **No date** folder.
- Save **new copies** in a folder you choose. Your recovery folder stays as it was.

### What Keepsake won't do

- **It won't delete anything.** Not in your recovery folder, and not in the folder you save to.
- **It won't change or move your files.** It can't save into your recovery folder.
- **It won't upload anything.** Your photos are not sent to me, to the team, or to anyone else. There's no account and no tracking.
- **It won't need the internet after the page opens.** After your first visit, it keeps working offline.

<!-- [CONFIRM: offline after first visit works end to end on the hosted beta (T85 offline check), including iPhone (HEIC) previews. Voice rule 4: keep this line only once QA confirms. If QA confirms, you may add: "To check for yourself, turn off Wi-Fi after the page loads. It still works."] -->

### If something goes wrong

Your files are fine. Keepsake doesn't change or delete them, even if it stops partway.

- **The folder won't open:** if it's on a memory card or USB drive, check that it's still plugged in. Then click **Choose the folder again**.
- **Saving stopped partway:** the photos already saved are kept. Make some space or plug the drive back in, then try again.
- **The page looks stuck or blank:** close the tab and open [APP LINK] again. You'll need to choose your folder again.
- **Anything else:** tell me. It helps a lot if you say:
  - Windows or Mac, and which browser
  - which step you were on
  - what the screen said, in words

You didn't do anything wrong. Finding these problems is the reason for the test.

---

## 3. What we ask

1. **Use Keepsake once** on a real recovery folder or on the example folder, from start to saving. Try to do it on your own, the way you would if I weren't there.
2. **Fill in the form** when you're done. It's 5 short questions and takes about 2 minutes: [FORM LINK]
3. **A call, if you'd like.** I'd love a 20-minute chat about how it went. This is optional. Just say so in the form or reply to me.
4. **Please don't send us your photos.** Words are enough. If you want to show us a screen, describe it, or send a screenshot only if no photos show in it.

Please do this by [END DATE].

**If you have your own PhotoRec folder:** that helps us most, because real recoveries are messier than our example. Use it if you're comfortable. Your photos still stay on your computer.

**If you use Firefox or Safari:** please tell us how saving the zip files went. That part is less tested.

<!-- [CONFIRM: whether the app has a "Send feedback" link (T87) that opens [FORM LINK]. If yes, add: "You can also find the form from the Send feedback link in Keepsake."] -->

---

## 4. Before you start: what to expect

Please read this before you use Keepsake.

- **This is a test version.** It may have mistakes. Some words and screens may change, and so may the name.
- **Keep your recovery folder.** Keepsake doesn't change it. But please don't delete it after you save, even if the sorted copy looks right. A test version could miss a photo.
- **Your photos stay on your computer.** Keepsake doesn't send them anywhere, and we never see them.
- **You can stop any time.** You don't need to give a reason, and you don't need to fill in the form if you stop.
- **What we do with your answers.** Only I and the small team making Keepsake read them. We use them to fix the app before it comes out. We won't share your name or answers with anyone else, and we won't use them to sell you anything.
- **The form is a Google Form.** Google stores what you type in it. Keepsake itself sends nothing to Google or anyone else.
- **If you join a call.** We only record it if you say yes first. You can say no and still have the call.

<!-- [CONFIRM: where form answers are stored (form tool), how long they're kept, and whether they're deleted after launch. If known, add one line: "We delete your answers by [date]."] -->
<!-- [CONFIRM: whether calls will be recorded at all. If never, change the last point to "We don't record the call."] -->

If you have any questions, just ask me.

---

## 5. Reminder message (day 5)

<!-- Send around Nov 21 to testers who haven't filled in the form. Keep it light. -->

> Hi [their name]! Just a friendly reminder about Keepsake. If you have 30 minutes before [END DATE], I'd be so grateful if you could try it and fill in the 2-minute form:
>
> App: [APP LINK]
> Form: [FORM LINK]
>
> No recovery folder? Reply and I'll send you an example one. If something didn't work, please tell me. That's really useful too.
>
> And if you're busy, no worries at all. Thank you!
