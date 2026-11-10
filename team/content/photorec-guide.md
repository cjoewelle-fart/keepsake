# Get your photos back from a memory card with PhotoRec

<!-- T26 · UX writer · 2026-10-16. [Name] = product name (rename D5/D12 pending). Checked against PhotoRec 7.2. Sources at the bottom are for the team, not users. -->

This guide helps you look for lost photos on a phone's memory card (SD card), a USB stick or a camera card. It uses PhotoRec, a free program. It works on Windows and Mac.

PhotoRec finds the photos. Then [Name] puts them in order by date.

## Before you start

Read these four things first. They matter more than anything else in this guide.

**1. Stop using the card now.**
Don't take new photos. Don't copy anything onto the card. If it's in a phone or camera, turn it off and take the card out. Every new file can cover up an old photo.

**2. If your computer asks to "format" or "fix" the card, say no.**
- On Windows, if you see "You need to format the disk", click **Cancel**.
- On Mac, if you see "The disk you inserted was not readable", click **Ignore**.

**3. Save the photos you find to a different place than the card.**
Save them on your computer, or on a different USB drive. Never save them back onto the card you are searching. That could cover up the photos you're trying to find.

**4. Check you have room, and time.**
- You need about as much free space as the size of the card, plus a little extra. For a 32 GB card, have at least 40 GB free.
- It can take hours. A big or damaged card can take all night. That's normal. Leave the computer plugged in.

**What you need**
- A computer (Windows or Mac).
- A way to plug in the card. Most phone cards need a card reader (a small adapter that plugs into your computer's USB port).
- About 15 minutes to set up, then time to wait.

**Is your phone's memory built in, with no card?** Read [If your photos were in the phone itself](#if-your-photos-were-in-the-phone-itself) first. PhotoRec usually can't help in that case.

---

## Part 1: Get PhotoRec

PhotoRec comes inside a free download called "TestDisk & PhotoRec". Get it only from its makers' website, cgsecurity.org.

### On Windows

1. Open your web browser and go to **cgsecurity.org/wiki/TestDisk_Download**.
2. Find the newest version that isn't marked "Beta". Today that is **7.2**.
3. Click **Windows 64-bit**. The file is called `testdisk-7.2.win64.zip`.
   You should see: the download page, with a link called **Windows 64-bit**.
4. Open your **Downloads** folder.
5. Right-click `testdisk-7.2.win64.zip` and choose **Extract All**, then **Extract**.
   You must do this step. PhotoRec won't start from inside the zip file.
6. Open the new folder called `testdisk-7.2`.

### On Mac

1. Open Safari or another browser and go to **cgsecurity.org/wiki/TestDisk_Download**.
2. Find the newest version that isn't marked "Beta". Today that is **7.2**.
3. Click the **Mac OS X** download. The file is called `testdisk-7.2.mac_intel_x86_64.tar.bz2`.
   You need macOS 10.15 (Catalina) or newer.
4. Open your **Downloads** folder.
5. Double-click the file. A folder called `testdisk-7.2` appears.
   You should see: a folder called `testdisk-7.2` in your **Downloads** folder.

---

## Part 2: Plug in the card and make a folder for your photos

1. Plug the card into your computer. Use a card reader if you need one.
2. If your computer asks to format or fix the card, say no (**Cancel** on Windows, **Ignore** on Mac).
3. Make a new, empty folder on your computer for the photos PhotoRec finds. Put it on your **Desktop** and call it `Recovered photos`.
   Don't make this folder on the card.

---

## Part 3: Start PhotoRec

There are two kinds of PhotoRec:
- **QPhotoRec** has windows and buttons you can click. It comes with the Windows download.
- **PhotoRec** (the text version) uses the keyboard only. You move with the arrow keys and press Enter. This is the one you use on a Mac.

### On Windows: start QPhotoRec (easiest)

1. In the `testdisk-7.2` folder, double-click **qphotorec_win** (it may show as `qphotorec_win.exe`).
2. Windows asks, "Do you want to allow this app to make changes to your device?" Click **Yes**.
   PhotoRec needs this to read the card. You need to be signed in as an administrator.
3. If you see "Windows protected your PC", click **More info**, then **Run anyway**.
4. The QPhotoRec window opens.
   You should see: a window called QPhotoRec, with a list of disks at the top.

Now go to [Part 4A: Search with QPhotoRec](#part-4a-search-with-qphotorec-windows).

If QPhotoRec doesn't open, you can use the text version instead. Right-click **photorec_win** and choose **Run as administrator**. Then follow [Part 4B](#part-4b-search-with-the-text-version-mac-or-windows).

### On Mac: start PhotoRec in Terminal

Terminal is a Mac app where you type commands. You only need it to start PhotoRec.

1. Press **Command + Space**, type `Terminal`, and press **Return**.
   A window with text opens.
   You should see: a plain window with a short line of text at the top. That's Terminal.
2. Open the `testdisk-7.2` folder in Finder, so you can see it next to Terminal.
3. Drag the file called **photorec** from the folder into the Terminal window. Its location appears as text.
4. Click in the Terminal window and press **Return**.
5. If your Mac says it needs **Rosetta**, click **Install** and wait. Then do step 4 again.

**If your Mac blocks PhotoRec**

Your Mac may say it "could not verify" PhotoRec, or that it "can't be opened". This happens because PhotoRec isn't sold in the App Store. It doesn't mean something is wrong with it.

1. Click **Done** (or **OK**). Don't click Move to Trash.
2. Open the **Apple menu** and choose **System Settings**.
3. Click **Privacy & Security**. Scroll down to the Security part.
4. Next to the message about photorec, click **Open Anyway**.
   You should see: a message about photorec, with an **Open Anyway** button next to it.
5. Type your Mac password and click **OK**.
6. Go back to Terminal and press the up arrow key, then **Return**. PhotoRec starts.
7. If your Mac asks again, click **Open**.

You only have to do this once, within about an hour of the first try.

**When PhotoRec asks for your password**

1. PhotoRec may say some disks won't show unless it has more access. Use the arrow keys to choose **Sudo** and press **Return**.
2. Type your Mac password and press **Return**.
   You won't see anything as you type. That's normal. Type it anyway.
3. If your Mac account has no password, PhotoRec can't continue. Set a password first in **System Settings > Users & Groups**, then start again.

Now go to [Part 4B](#part-4b-search-with-the-text-version-mac-or-windows).

---

## Part 4A: Search with QPhotoRec (Windows)

1. At the top, open the list of disks and choose your card.
   Pick it by its size. A 32 GB card may show as about 31 or 32 GB. Don't choose your computer's own drive (usually the biggest one).
   You should see: your card chosen at the top. The size should match your card, for example about 31 or 32 GB.
2. In the list below it, click the line for the card's main part. If you're not sure, choose the line that says **No partition** or **Whole disk**, or the biggest line.
3. Under the file system choice, pick **FAT/NTFS/HFS+/ReiserFS/…** (the one that is not ext2/ext3/ext4). Phone and camera cards use this kind.
4. Choose **Whole** or **Free**:
   - **Whole** searches the entire card. Choose this if the card stopped working, was formatted, or you're not sure. It takes longer and also finds photos that are still on the card. That's fine: [Name] puts the extra copies aside for you.
   - **Free** only searches the empty space. Choose this if the card still works and you only deleted some photos. It's faster.
5. Leave **File Formats** as it is. PhotoRec looks for all kinds of files, and that's fine. [Name] sets aside what isn't a photo or video.
6. Click **Browse** and choose the `Recovered photos` folder on your Desktop.
   You should see: **Whole** or **Free** chosen, and your `Recovered photos` folder filled in as the place to save.
7. Click **Search**.

Now go to [Part 5: Wait](#part-5-wait).

---

## Part 4B: Search with the text version (Mac or Windows)

In the text version, you use the **arrow keys** to move and **Enter** (Return on a Mac) to choose. The keys you can use are listed at the bottom of each screen.

**Pick the card**

1. You see a list of disks. Use the arrow keys to choose your card. Pick it by its size, for example 32 GB.
   Don't choose your computer's own drive (usually the biggest one, or the one at the top).
   On a Mac, if you see the card twice, choose the one that starts with `/dev/rdisk`. It's faster.
   You should see: a list of disks, with your card highlighted. The size should match your card.
2. At the bottom, make sure **Proceed** is highlighted, then press **Enter**.

**Pick the part of the card to search**

3. You see a list of the card's parts. Choose the biggest one, or the one that says **No partition** or **Whole disk**.
4. At the bottom, make sure **Search** is highlighted, then press **Enter**.
   You don't need **Options** or **File Opt**. PhotoRec looks for all kinds of files, and that's fine. [Name] sets aside what isn't a photo or video.
   You should see: a list of the card's parts, with **Search** highlighted at the bottom.

**Answer two questions**

5. PhotoRec asks what kind of file system the card uses. Choose **Other** and press **Enter**. Phone and camera cards use this kind.
6. PhotoRec asks where to search. Choose one and press **Enter**:
   - **Whole** searches the entire card. Choose this if the card stopped working, was formatted, or you're not sure. It takes longer and also finds photos that are still on the card. That's fine: [Name] puts the extra copies aside for you.
   - **Free** only searches the empty space. Choose this if the card still works and you only deleted some photos. It's faster.
   You should see: a question with two choices, **Free** and **Whole**.

**Choose where to save**

PhotoRec now shows folders on your computer. You move into a folder by choosing it and pressing **Enter**. You go back up by choosing `..` (two dots) and pressing **Enter**.

7. Find the `Recovered photos` folder you made:
   - **On a Mac:** you usually start in your home folder. Choose **Desktop** and press **Return**. Then choose **Recovered photos** and press **Return**.
   - **On Windows:** you start in the `testdisk-7.2` folder. Choose `..` and press **Enter** until you reach `C:`. Then go into **Users**, then your name, then **Desktop**, then **Recovered photos**.
8. Check the line at the top. It should end in `Recovered photos`.
   You should see: a line at the top that ends in `Recovered photos`.
9. Press the **C** key to start.
   (Some older versions ask you to press **Y** instead. Use whichever key the screen asks for.)

Now go to Part 5.

---

## Part 5: Wait

PhotoRec is now searching. You'll see a count of files found, by type, going up. "Pass 0" and "Pass 1" are normal.

You should see: a number for each kind of file, going up as PhotoRec finds more.

- This can take hours. Leave it running. You can do other things on the computer.
- Keep the computer plugged in and the card plugged in.
- Don't let the computer go to sleep. On Windows, check **Settings > System > Power**. On a Mac, check **System Settings > Lock Screen** or **Battery**.
- You can look in the `Recovered photos` folder while it runs. Files appear there as they're found.
- If it stops by mistake, start PhotoRec again the same way. It asks if you want to carry on where it left off.

When it's done, PhotoRec says so and shows how many files it found. You can close it. (In the text version, choose **Quit** and press **Enter** until it closes.)

---

## Part 6: What you'll see

Open the `Recovered photos` folder. Inside, you'll see folders named:

`recup_dir.1`, `recup_dir.2`, `recup_dir.3` …

You should see: one or more folders that start with `recup_dir`.

Inside them are lots of files with names like `f12345678.jpg`. PhotoRec can't bring back the old names or folders, so everything is mixed together. There will also be small preview copies, copies of the same photo, broken files and files from apps.

You don't need to sort through them yourself.

---

## Part 7: Sort your photos with [Name]

PhotoRec's part is done. Now [Name] puts what PhotoRec found in order.

1. Go back to the start of [Name]. You can use the **Sort my recovered files** button at the bottom of this page.
2. Click **Choose recovery folder**.
3. Choose your `Recovered photos` folder (the one that holds the recup_dir folders).

[Name] finds the photos and videos, sets the rest aside, and sorts your photos into folders by date. It only reads your `Recovered photos` folder. Nothing in it is changed or deleted.

---

## If your photos were in the phone itself

Many phones have no memory card. The photos are stored inside the phone.

PhotoRec usually can't reach this memory. When you plug a phone into a computer, it doesn't show up as a normal disk, so PhotoRec can't search it. Phones also lock and scramble their memory to keep it private, which makes deleted photos very hard to find.

Here are some things to check. We can't promise any of them will work.

1. **Turn on airplane mode and stop using the phone** as much as you can.
2. **Look in "Recently deleted".** Most phones keep deleted photos for about 30 days.
   - iPhone: **Photos** app > **Albums** > **Recently Deleted**.
   - Android: the **Gallery** or **Google Photos** app > **Trash** or **Bin**.
3. **Check your online backups.** Your photos may have been copied there without you knowing. Sign in on another device or a computer:
   - Google Photos (photos.google.com), iCloud (icloud.com/photos), Samsung Cloud or OneDrive.
4. **Check other places the photos may be.** Chat apps (like Messenger, WhatsApp or Viber), email, an old phone, or a computer you once plugged the phone into.
5. **Ask a data recovery shop.** Some shops can try special methods. Ask for a price before they start, and ask what happens if they find nothing.

Be careful with apps or websites that promise to "recover everything" from a phone. Many can't, and some charge before showing you anything.

---

## If something goes wrong

**The card doesn't show up in the list**
- Unplug the card and plug it in again. Then close PhotoRec and start it again.
- Try a different USB port or a different card reader.
- Check that PhotoRec has administrator access. On Windows, click **Yes** when asked. On a Mac, choose **Sudo** and type your password.
- On a Mac: open **System Settings > Privacy & Security > Full Disk Access**. Turn on **Terminal** (click **+** to add it if it isn't there). Then close Terminal and start again.
- If the computer doesn't see the card at all, the card or reader may be broken. A data recovery shop may still be able to help.

**It says "Permission denied" or "Operation not permitted"**
- PhotoRec doesn't have enough access. On Windows, close it and start it again with **Yes** to the question, or right-click and choose **Run as administrator**. On a Mac, choose **Sudo** and type your password, and turn on Full Disk Access for Terminal (see above).
- If it happens when saving, you may have picked a folder PhotoRec can't write to. Choose your `Recovered photos` folder on the Desktop.

**It's very slow, or seems stuck**
- Hours is normal, especially with **Whole** or a big card. If the file count is still going up now and then, it's working.
- Damaged cards can be very slow. It's OK to leave it overnight.
- If the count hasn't changed for a few hours, you can stop it. The photos already found stay in your `Recovered photos` folder, and you can open them in [Name] now.

**It says the disk is full**
- The place you're saving to has run out of room. Stop PhotoRec. Free up space or use a bigger drive (never the card itself), then start again. PhotoRec asks if you want to carry on.

Your card and the files already found are fine. Nothing here deletes anything.

---

## For the team (not for users)

Notes:
- Version check (2026-10-16): stable is 7.2 (released 2024-02-22). Files: `testdisk-7.2.win64.zip`, `testdisk-7.2.mac_intel_x86_64.tar.bz2` (macOS 10.15+). 7.3-WIP is beta; the download page says the beta Mac build runs on M1. The 7.2 Mac build is Intel only, so Apple Silicon Macs run it via Rosetta (third-party source). Re-check before publishing and on each release.
- The official Step By Step page still shows 6.13 and says confirm the destination with **Y**. Current versions show "C when the destination is correct" at the bottom of the destination screen; the guide covers both. QA should confirm every on-screen label (Proceed, Sudo, Other, Free/Whole, QPhotoRec's file system labels, Browse, Search) on a real 7.2 run on Windows 11 and current macOS, and take the screenshots then.
- "Windows protected your PC" (SmartScreen) and the Mac "could not verify" wording are not on cgsecurity.org; they come from Windows/Apple behaviour. Confirm on real machines.
- Free-space rule of thumb (card size + a bit) is ours, not from cgsecurity.org. With "Keep corrupted files" off (default) output should not exceed the card's size by much.
- cgsecurity.org recommends Disk Drill as a GUI alternative on its download page; we deliberately don't, since it's commercial.
- Phone internal memory: MTP and phone encryption are the reason PhotoRec can't reach it; we keep this to plain words and make no promises.

Sources used:
- PhotoRec Step By Step: https://www.cgsecurity.org/wiki/PhotoRec_Step_By_Step
- TestDisk & PhotoRec download (versions, file names, macOS requirement): https://www.cgsecurity.org/wiki/TestDisk_Download
- Starting the tools (Windows file names incl. `qphotorec_win.exe`, admin rights, extract-all, macOS sudo, blank password, Full Disk Access): https://www.cgsecurity.org/testdisk_doc/running.html
- Apple, Open a Mac app from an unknown developer (Privacy & Security > Open Anyway, about one hour): https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac
- Mac walkthrough, third-party (Rosetta on Apple Silicon, `/dev/rdisk`, saving to Desktop and pressing C): https://havecamerawilltravel.com/photorec-recover-photos-memory-card/
- CGSecurity forum, Mac users stuck on sudo / no disk found (shows where people get lost): https://forum.cgsecurity.org/phpBB3/viewtopic.php?p=39657 and https://forum.cgsecurity.org/phpBB3/viewtopic.php?p=25878
