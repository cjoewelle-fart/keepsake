// All words the user sees live here, so the UX writer can edit them in one place.
import type { SetAsideGroup } from '../engine/summary';

const nf = new Intl.NumberFormat('en');
export const n = (x: number) => nf.format(x);
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many);

// Dates are the camera's own local time ('YYYY-MM-DD…'), so format the fields as written, never via a time zone.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** '2024-06-28T…' → '28 June' */
export const dayMonth = (takenAt: string) => `${Number(takenAt.slice(8, 10))} ${MONTHS[Number(takenAt.slice(5, 7)) - 1]}`;
/** '2024-06' → 'June 2024' */
export const monthYear = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** '2024-06' → 'June' */
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** '2024-06-28' → 'Friday 28 June' (weekday worked out from the calendar date, no time zone involved) */
export const weekdayDayMonth = (ymd: string) => {
  const [y, m, d] = [Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), Number(ymd.slice(8, 10))];
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};
/** '2024-06-28T09:12:…' → '09:12' */
export const clock = (takenAt: string) => takenAt.slice(11, 16);
/** A video's length the way phones show it: "0:42", "12:05", "1:02:03". Rounded, never "0:00". */
export const runTime = (secs: number) => {
  const s = Math.max(1, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
/** The same length in words, for screen readers: "42 seconds", "1 minute 5 seconds", "1 hour 2 minutes". */
export const runTimeWords = (secs: number) => {
  const s = Math.max(1, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = h
    ? [`${h} ${plural(h, 'hour', 'hours')}`, m ? `${m} ${plural(m, 'minute', 'minutes')}` : '']
    : [m ? `${m} ${plural(m, 'minute', 'minutes')}` : '', s % 60 ? `${s % 60} ${plural(s % 60, 'second', 'seconds')}` : ''];
  return parts.filter(Boolean).join(' ');
};
/** '2024-06-28T09:12:…' → '28 June 2024, 09:12' (a date with no time stays a date). */
export const dateTime = (takenAt: string) => {
  const d = `${dayMonth(takenAt)} ${takenAt.slice(0, 4)}`;
  return takenAt.length >= 16 ? `${d}, ${clock(takenAt)}` : d;
};
/** Bytes as people read them: '840 KB', '3.4 GB'. */
export const bytes = (x: number) => {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let u = 0;
  while (x >= 1000 && u < units.length - 1) { x /= 1000; u++; }
  return u === 0 ? `${n(x)} ${plural(x, 'byte', 'bytes')}` : `${x >= 100 ? Math.round(x) : x.toFixed(1).replace(/\.0$/, '')} ${units[u]}`;
};

const APP = 'Keepsake';

// The privacy page and PhotoRec guide texts (copy.info), in the small Markdown described there.
const PRIVACY = `# Your privacy

**Your photos never leave this computer, and ${APP} never changes or deletes your files.**

## Nothing is sent anywhere

${APP} runs inside your web browser, on your computer. When you choose your recovery folder, your browser reads the files right here. They are not sent to us or to anyone else.

There is no ${APP} server that stores photos. The app is a set of files your browser loads once, like a page in a book. After that, all the sorting happens on your computer.

The app is also built so the page can’t send data to other websites. It doesn’t use ads or tracking, and it doesn’t load anything from other companies.

iPhone photos (HEIC files) are turned into previews on your computer too. The part that does this comes with ${APP}. Nothing is fetched from anywhere else.

Some browsers show a message like “Upload files to this site?” when you choose a folder. That is the browser’s own wording. The files are only read on this computer. They are not sent anywhere.

## None of your files are deleted

${APP} only reads your recovery folder. It can’t change it, move files in it, or delete anything from it.

When we set files aside, they stay exactly where they were. “Set aside” only means we don’t show them with your photos. You can keep any of them.

When you save your photos, ${APP} makes new copies in a folder you choose. It never replaces a file that’s already there. Your recovery folder stays as it was.

If saving stops partway, ${APP} removes the one empty file it had just started for that copy. It never removes anything that was there before, any copy it finished, or anything in your recovery folder.

## How to check for yourself

You don’t have to take our word for it. Here’s how to check.

**Watch what your browser sends.**
Browsers have a tool that lists everything a page sends and receives. On a computer using Chrome or Edge:
1. Press **F12** (on a Mac, press **Option + Command + I**).
2. Click the **Network** tab.
3. Use ${APP} as normal.

You’ll see ${APP} loading its own files when the page opens. You won’t see your photos being sent anywhere.

## What we can’t control

We’re honest about the limits.

- **Your browser.** ${APP} runs inside your browser, so it can only be as private as the browser is. Use a browser you trust, kept up to date.
- **Browser extensions.** Add-ons you’ve installed in your browser (like ad blockers, shopping or translation tools) may be able to see pages you open. If you’re worried, turn them off while you use ${APP}.
- **Your computer’s own backups.** Photos you save may be copied by backup or sync tools you already use, like OneDrive, iCloud, Google Drive or Dropbox. That’s set up on your computer, not by ${APP}.
- **The website that sends you the app.** Like any website, the place ${APP} is hosted may keep basic visit records, such as when the page was opened. Those records never include your photos.

## What ${APP} stores

- **On our side: nothing.** We have no server that keeps photos, scan results or accounts.
- **In your browser: the app itself.** Your browser may keep ${APP}’s own files so it opens faster or works without the internet. These are the app’s files, not your photos.
- **Your scan results: only in this browser tab.** The list of what ${APP} found is kept while the tab is open. When you close the tab, it’s gone. Your photos stay safe in your recovery folder and wherever you saved them.

## Questions

**Do you see my photos?**
No. Your photos are read on your computer and never sent to us. We have no way to see them.

**Do I need an account?**
No. There’s nothing to sign up for and no email to give.
`;

const GUIDE = `# Get your photos back from a memory card with PhotoRec

This guide helps you look for lost photos on a phone’s memory card (SD card), a USB stick or a camera card. It uses PhotoRec, a free program. It works on Windows and Mac.

PhotoRec finds the photos. Then ${APP} sorts them for you.

## Before you start

Read these four things first. They matter more than anything else in this guide.

**1. Stop using the card now.**
Don’t take new photos. Don’t copy anything onto the card. If it’s in a phone or camera, turn it off and take the card out. Every new file can cover up an old photo.

**2. If your computer asks to “format” or “fix” the card, say no.**
- On Windows, if you see “You need to format the disk”, click **Cancel**.
- On Mac, if you see “The disk you inserted was not readable”, click **Ignore**.

**3. Save the photos you find to a different place than the card.**
Save them on your computer, or on a different USB drive. Never save them back onto the card you are searching. That could cover up the photos you’re trying to find.

**4. Check you have room, and time.**
- You need about as much free space as the size of the card, plus a little extra. For a 32 GB card, have at least 40 GB free.
- It can take hours. A big or damaged card can take all night. That’s normal. Leave the computer plugged in.

**What you need**
- A computer (Windows or Mac).
- A way to plug in the card. Most phone cards need a card reader (a small adapter that plugs into your computer’s USB port).
- About 15 minutes to set up, then time to wait.

**Is your phone’s memory built in, with no card?** Read [If your photos were in the phone itself](#if-your-photos-were-in-the-phone-itself) first. PhotoRec usually can’t help in that case.

---

## Part 1: Get PhotoRec

PhotoRec comes inside a free download called “TestDisk & PhotoRec”. Get it only from its makers’ website, cgsecurity.org.

### On Windows

1. Open your web browser and go to **cgsecurity.org/wiki/TestDisk_Download**.
2. Find the newest version that isn’t marked “Beta”. Today that is **7.2**.
3. Click **Windows 64-bit**. The file is called \`testdisk-7.2.win64.zip\`.
   You should see: the download page, with a link called **Windows 64-bit**.
4. Open your **Downloads** folder.
5. Right-click \`testdisk-7.2.win64.zip\` and choose **Extract All**, then **Extract**.
   You must do this step. PhotoRec won’t start from inside the zip file.
6. Open the new folder called \`testdisk-7.2\`.

### On Mac

1. Open Safari or another browser and go to **cgsecurity.org/wiki/TestDisk_Download**.
2. Find the newest version that isn’t marked “Beta”. Today that is **7.2**.
3. Click the **Mac OS X** download. The file is called \`testdisk-7.2.mac_intel_x86_64.tar.bz2\`.
   You need macOS 10.15 (Catalina) or newer.
4. Open your **Downloads** folder.
5. Double-click the file. A folder called \`testdisk-7.2\` appears.
   You should see: a folder called \`testdisk-7.2\` in your **Downloads** folder.

---

## Part 2: Plug in the card and make a folder for your photos

1. Plug the card into your computer. Use a card reader if you need one.
2. If your computer asks to format or fix the card, say no (**Cancel** on Windows, **Ignore** on Mac).
3. Make a new, empty folder on your computer for the photos PhotoRec finds. Put it on your **Desktop** and call it \`Recovered photos\`.
   Don’t make this folder on the card.

---

## Part 3: Start PhotoRec

There are two kinds of PhotoRec:
- **QPhotoRec** has windows and buttons you can click. It comes with the Windows download.
- **PhotoRec** (the text version) uses the keyboard only. You move with the arrow keys and press Enter. This is the one you use on a Mac.

### On Windows: start QPhotoRec (easiest)

1. In the \`testdisk-7.2\` folder, double-click **qphotorec_win** (it may show as \`qphotorec_win.exe\`).
2. Windows asks, “Do you want to allow this app to make changes to your device?” Click **Yes**.
   PhotoRec needs this to read the card. You need to be signed in as an administrator.
3. If you see “Windows protected your PC”, click **More info**, then **Run anyway**.
4. The QPhotoRec window opens.
   You should see: a window called QPhotoRec, with a list of disks at the top.

Now go to [Part 4A: Search with QPhotoRec](#part-4a-search-with-qphotorec-windows).

If QPhotoRec doesn’t open, you can use the text version instead. Right-click **photorec_win** and choose **Run as administrator**. Then follow [Part 4B](#part-4b-search-with-the-text-version-mac-or-windows).

### On Mac: start PhotoRec in Terminal

Terminal is a Mac app where you type commands. You only need it to start PhotoRec.

1. Press **Command + Space**, type \`Terminal\`, and press **Return**.
   A window with text opens.
   You should see: a plain window with a short line of text at the top. That’s Terminal.
2. Open the \`testdisk-7.2\` folder in Finder, so you can see it next to Terminal.
3. Drag the file called **photorec** from the folder into the Terminal window. Its location appears as text.
4. Click in the Terminal window and press **Return**.
5. If your Mac says it needs **Rosetta**, click **Install** and wait. Then do step 4 again.

**If your Mac blocks PhotoRec**

Your Mac may say it “could not verify” PhotoRec, or that it “can’t be opened”. This happens because PhotoRec isn’t sold in the App Store. It doesn’t mean something is wrong with it.

1. Click **Done** (or **OK**). Don’t click Move to Trash.
2. Open the **Apple menu** and choose **System Settings**.
3. Click **Privacy & Security**. Scroll down to the Security part.
4. Next to the message about photorec, click **Open Anyway**.
   You should see: a message about photorec, with an **Open Anyway** button next to it.
5. Type your Mac password and click **OK**.
6. Go back to Terminal and press the up arrow key, then **Return**. PhotoRec starts.
7. If your Mac asks again, click **Open**.

You only have to do this once, within about an hour of the first try.

**When PhotoRec asks for your password**

1. PhotoRec may say some disks won’t show unless it has more access. Use the arrow keys to choose **Sudo** and press **Return**.
2. Type your Mac password and press **Return**.
   You won’t see anything as you type. That’s normal. Type it anyway.
3. If your Mac account has no password, PhotoRec can’t continue. Set a password first in **System Settings > Users & Groups**, then start again.

Now go to [Part 4B](#part-4b-search-with-the-text-version-mac-or-windows).

---

## Part 4A: Search with QPhotoRec (Windows)

1. At the top, open the list of disks and choose your card.
   Pick it by its size. A 32 GB card may show as about 31 or 32 GB. Don’t choose your computer’s own drive (usually the biggest one).
   You should see: your card chosen at the top. The size should match your card, for example about 31 or 32 GB.
2. In the list below it, click the line for the card’s main part. If you’re not sure, choose the line that says **No partition** or **Whole disk**, or the biggest line.
3. Under the file system choice, pick **FAT/NTFS/HFS+/ReiserFS/…** (the one that is not ext2/ext3/ext4). Phone and camera cards use this kind.
4. Choose **Whole** or **Free**:
   - **Whole** searches the entire card. Choose this if the card stopped working, was formatted, or you’re not sure. It takes longer and also finds photos that are still on the card. That’s fine: ${APP} puts the extra copies aside for you.
   - **Free** only searches the empty space. Choose this if the card still works and you only deleted some photos. It’s faster.
5. Leave **File Formats** as it is. PhotoRec looks for all kinds of files, and that’s fine. ${APP} sorts out what isn’t a photo or video.
6. Click **Browse** and choose the \`Recovered photos\` folder on your Desktop.
   You should see: **Whole** or **Free** chosen, and your \`Recovered photos\` folder filled in as the place to save.
7. Click **Search**.

Now go to [Part 5: Wait](#part-5-wait).

---

## Part 4B: Search with the text version (Mac or Windows)

In the text version, you use the **arrow keys** to move and **Enter** (Return on a Mac) to choose. The keys you can use are listed at the bottom of each screen.

**Pick the card**

1. You see a list of disks. Use the arrow keys to choose your card. Pick it by its size, for example 32 GB.
   Don’t choose your computer’s own drive (usually the biggest one, or the one at the top).
   On a Mac, if you see the card twice, choose the one that starts with \`/dev/rdisk\`. It’s faster.
   You should see: a list of disks, with your card highlighted. The size should match your card.
2. At the bottom, make sure **Proceed** is highlighted, then press **Enter**.

**Pick the part of the card to search**

3. You see a list of the card’s parts. Choose the biggest one, or the one that says **No partition** or **Whole disk**.
4. At the bottom, make sure **Search** is highlighted, then press **Enter**.
   You don’t need **Options** or **File Opt**. PhotoRec looks for all kinds of files, and that’s fine. ${APP} sorts out what isn’t a photo or video.
   You should see: a list of the card’s parts, with **Search** highlighted at the bottom.

**Answer two questions**

5. PhotoRec asks what kind of file system the card uses. Choose **Other** and press **Enter**. Phone and camera cards use this kind.
6. PhotoRec asks where to search. Choose one and press **Enter**:
   - **Whole** searches the entire card. Choose this if the card stopped working, was formatted, or you’re not sure. It takes longer and also finds photos that are still on the card. That’s fine: ${APP} puts the extra copies aside for you.
   - **Free** only searches the empty space. Choose this if the card still works and you only deleted some photos. It’s faster.
   You should see: a question with two choices, **Free** and **Whole**.

**Choose where to save**

PhotoRec now shows folders on your computer. You move into a folder by choosing it and pressing **Enter**. You go back up by choosing \`..\` (two dots) and pressing **Enter**.

7. Find the \`Recovered photos\` folder you made:
   - **On a Mac:** you usually start in your home folder. Choose **Desktop** and press **Return**. Then choose **Recovered photos** and press **Return**.
   - **On Windows:** you start in the \`testdisk-7.2\` folder. Choose \`..\` and press **Enter** until you reach \`C:\`. Then go into **Users**, then your name, then **Desktop**, then **Recovered photos**.
8. Check the line at the top. It should end in \`Recovered photos\`.
   You should see: a line at the top that ends in \`Recovered photos\`.
9. Press the **C** key to start.
   (Some older versions ask you to press **Y** instead. Use whichever key the screen asks for.)

Now go to Part 5.

---

## Part 5: Wait

PhotoRec is now searching. You’ll see a count of files found, by type, going up. “Pass 0” and “Pass 1” are normal.

You should see: a number for each kind of file, going up as PhotoRec finds more.

- This can take hours. Leave it running. You can do other things on the computer.
- Keep the computer plugged in and the card plugged in.
- Don’t let the computer go to sleep. On Windows, check **Settings > System > Power**. On a Mac, check **System Settings > Lock Screen** or **Battery**.
- You can look in the \`Recovered photos\` folder while it runs. Files appear there as they’re found.
- If it stops by mistake, start PhotoRec again the same way. It asks if you want to carry on where it left off.

When it’s done, PhotoRec says so and shows how many files it found. You can close it. (In the text version, choose **Quit** and press **Enter** until it closes.)

---

## Part 6: What you’ll see

Open the \`Recovered photos\` folder. Inside, you’ll see folders named:

\`recup_dir.1\`, \`recup_dir.2\`, \`recup_dir.3\` …

You should see: one or more folders that start with \`recup_dir\`.

Inside them are lots of files with names like \`f12345678.jpg\`. PhotoRec can’t bring back the old names or folders, so everything is mixed together. There will also be small preview copies, copies of the same photo, broken files and files from apps.

You don’t need to sort through them yourself.

**Now open ${APP} and choose that folder.** Choose \`Recovered photos\` (the folder that holds the recup_dir folders). ${APP} finds the photos and videos worth keeping and sorts them by date. It doesn’t change or delete anything in the folder.

---

## If your photos were in the phone itself

Many phones have no memory card. The photos are stored inside the phone.

PhotoRec usually can’t reach this memory. When you plug a phone into a computer, it doesn’t show up as a normal disk, so PhotoRec can’t search it. Phones also lock and scramble their memory to keep it private, which makes deleted photos very hard to find.

Here are some things to check. We can’t promise any of them will work.

1. **Turn on airplane mode and stop using the phone** as much as you can.
2. **Look in “Recently deleted”.** Most phones keep deleted photos for about 30 days.
   - iPhone: **Photos** app > **Albums** > **Recently Deleted**.
   - Android: the **Gallery** or **Google Photos** app > **Trash** or **Bin**.
3. **Check your online backups.** Your photos may have been copied there without you knowing. Sign in on another device or a computer:
   - Google Photos (photos.google.com), iCloud (icloud.com/photos), Samsung Cloud or OneDrive.
4. **Check other places the photos may be.** Chat apps (like Messenger, WhatsApp or Viber), email, an old phone, or a computer you once plugged the phone into.
5. **Ask a data recovery shop.** Some shops can try special methods. Ask for a price before they start, and ask what happens if they find nothing.

Be careful with apps or websites that promise to “recover everything” from a phone. Many can’t, and some charge before showing you anything.

---

## If something goes wrong

**The card doesn’t show up in the list**
- Unplug the card and plug it in again. Then close PhotoRec and start it again.
- Try a different USB port or a different card reader.
- Check that PhotoRec has administrator access. On Windows, click **Yes** when asked. On a Mac, choose **Sudo** and type your password.
- On a Mac: open **System Settings > Privacy & Security > Full Disk Access**. Turn on **Terminal** (click **+** to add it if it isn’t there). Then close Terminal and start again.
- If the computer doesn’t see the card at all, the card or reader may be broken. A data recovery shop may still be able to help.

**It says “Permission denied” or “Operation not permitted”**
- PhotoRec doesn’t have enough access. On Windows, close it and start it again with **Yes** to the question, or right-click and choose **Run as administrator**. On a Mac, choose **Sudo** and type your password, and turn on Full Disk Access for Terminal (see above).
- If it happens when saving, you may have picked a folder PhotoRec can’t write to. Choose your \`Recovered photos\` folder on the Desktop.

**It’s very slow, or seems stuck**
- Hours is normal, especially with **Whole** or a big card. If the file count is still going up now and then, it’s working.
- Damaged cards can be very slow. It’s OK to leave it overnight.
- If the count hasn’t changed for a few hours, you can stop it. The photos already found stay in your \`Recovered photos\` folder, and you can open them in ${APP} now.

**It says the disk is full**
- The place you’re saving to has run out of room. Stop PhotoRec. Free up space or use a bigger drive (never the card itself), then start again. PhotoRec asks if you want to carry on.

Your card and the files already found are fine. Nothing here deletes anything.
`;

export const copy = {
  appName: APP,
  steps: ['Recover', 'Scan', 'Clean up', 'Review', 'Save'],
  stepOf: (i: number, total: number, name: string) => `Step ${i + 1} of ${total} · ${name}`,
  /** The browser tab's title on each step: "Clean up · Keepsake". `app` keeps the test build's "(test)". */
  pageTitle: (step: string, app: string) => `${step} · ${app}`,
  skip: 'Skip to content',
  privacy: 'Your files never leave this computer, and your recovery folder is never changed.',

  start: {
    eyebrow: 'Step 2 of 5',
    title: 'Let’s find the photos in your recovered files.',
    body: 'Choose the folder your recovery program saved files into. We’ll find the photos and videos worth keeping and set the rest aside.',
    hint: 'Inside it, you’ll usually see folders named recup_dir.1, recup_dir.2 and so on.',
    choose: 'Choose recovery folder',
    /** T76: right under the Choose button, where the folder is chosen. */
    chooseNote: 'Keepsake runs in your browser, on this computer. Choosing a folder lets it read your files here. They aren’t sent to us or to any server, and nothing is deleted.',
    browserNote: 'Keepsake works best in Chrome or Edge on a computer. You can still scan your folder in this browser.',
    stopped: 'Scan stopped. Nothing was changed, and you can start again any time.',
    /** Inside the claude.ai preview the folder is chosen with the browser's upload dialog. */
    uploadNote: 'Your browser may ask “Upload files to this site?” That’s the browser’s own wording. Your files are only read on this computer, not sent anywhere.',
    samples: 'Try with example files',
    samplesNote: 'No recovery folder handy? The example files come from a test memory card that was wiped and then recovered.',
  },

  scanning: {
    title: 'Checking your files…',
    copiesTitle: 'Looking for exact copies…',
    progress: (done: number, total: number) => `Checked ${n(done)} of ${n(total)} files`,
    copiesProgress: (done: number, total: number) => `Compared ${n(done)} of ${n(total)} possible copies`,
    reassure: 'This happens on your computer. Nothing is sent anywhere, and you can stop any time.',
    // “Your files”: Save may remove an empty file it made itself (D17), never one of yours (T58).
    // T76: said in words instead of a zero counter.
    deleted: 'Your files are not deleted or changed',
    stagesLabel: 'Scan stages',
    stages: ['Check every file', 'Spot exact copies', 'Sort them by date'],
    stageDone: '(done)',
    stop: 'Stop scanning',
    stopping: 'Stopping…',
  },

  results: {
    // Quiet Prints results screen (T38).
    sortedLine: 'They’re sorted by the date each one was taken.',
    noDatesLine: 'We couldn’t find a date on any of them, so they’re kept together.',
    ledgerLabel: 'Your files, added up',
    ledgerChecked: 'Files checked',
    ledgerKept: 'Kept, sorted by date',
    ledgerAside: 'Set aside, kept safe below',
    // T76: the privacy promise in plain words, not a "0 · 0" counter.
    ledgerSafe: 'Your files',
    ledgerSafeValue: 'Not deleted, not sent anywhere',
    ledgerSafeSr: 'Your files',
    ledgerSafeValueSr: 'Not deleted, not sent anywhere',
    ledgerChanged: (keep: number, aside: number) => `Now keeping ${n(keep)} ${plural(keep, 'file', 'files')}. ${n(aside)} set aside.`,
    untouched: 'Nothing was deleted or sent anywhere. Every file is still in your recovery folder, just as it was.',
    takeYourTime: 'No rush. Look through everything first, then review when you’re ready.',
    /** T77: under the Kept heading. The contact sheet shows photos only (Results.tsx filters on PHOTO_KINDS). Videos are only mentioned when some are kept (QA m4). */
    keptPhotosOnly: (videos: boolean) => (videos ? 'These previews show photos only. You’ll see videos too when you review.' : 'These previews show photos only.'),
    /** T77: under "Set these aside again", after keeping a group. */
    keptAdded: (added: number, total: number) => `Added ${n(added)} to Kept. Kept is now ${n(total)}.`,
    photosByDate: 'Your photos by date',
    jumpLabel: 'Jump to a year',
    undatedChip: (x: number) => `No date · ${n(x)}`,
    monthCount: (x: number) => `${n(x)} ${plural(x, 'photo', 'photos')}`,
    noDateTitle: 'No date',
    noDateCount: (x: number) => `${n(x)} ${plural(x, 'photo', 'photos')}, kept together so none get lost`,
    noDateTag: 'No date',
    seeEveryMonth: 'See every month',
    seeThemAll: 'See them all',
    asideSafeTitle: 'Set aside, kept safe',
    asideIntro: (x: number) =>
      x === 0
        ? 'You’re keeping all of these files. You can set any group aside again.'
        : `We set aside ${n(x)} ${plural(x, 'file that looks', 'files that look')} like leftovers from the recovery. You can keep any of these.`,
    // Not shown since the Quiet Prints layout (T38); kept for the UX writer.
    eyebrow: (total: number) => `Scan finished · ${n(total)} files checked`,
    titleBefore: 'We found ',
    titleAfter: (keep: number) => ` ${plural(keep, 'photo or video', 'photos and videos')} worth keeping.`,
    body: (setAside: number) =>
      setAside === 0
        ? 'Everything here looks worth keeping.'
        : `The other ${n(setAside)} ${plural(setAside, 'file looks', 'files look')} like leftovers from the recovery. We’ve set them aside so you don’t have to dig through them. Nothing has been deleted.`,
    keepingLegend: (x: number) => `Keeping ${n(x)}`,
    asideLegend: (x: number) => `Set aside ${n(x)}`,
    ratio: (total: number, keep: number) => {
      const every = Math.round(total / Math.max(1, keep));
      return every < 2 ? 'Most of these files are worth keeping.' : `About 1 in every ${n(every)} files is worth keeping.`;
    },
    readyTitle: 'Ready to review',
    readySub: 'Sorted by the date each photo was taken.',
    photos: 'Photos',
    videos: 'Videos',
    otherFiles: 'Other files',
    dateRange: 'Date range',
    noDates: 'No dates found',
    morePreviews: (x: number) => `+${n(x)}`,
    undated: (x: number) => `${n(x)} ${plural(x, 'photo has', 'photos have')} no date.`,
    undatedMore: 'They’ll go in their own “No date” group so they don’t get lost.',
    asideTitle: 'Set aside',
    asideSub: 'Open a group to see why we set it aside. If you want those files, you can keep them.',
    files: (x: number) => `${n(x)} ${plural(x, 'file', 'files')}`,
    peek: 'Show',
    hide: 'Hide',
    moveBack: 'Keep these files',
    /** T78: under "Keep these files", while it reads that. */
    moveBackNote: 'Adds them to the files you review and save. Nothing moves on your computer. You can set them aside again.',
    undo: 'Set these aside again',
    movedBack: 'Keeping these',
    previewUnavailable: 'No preview',
    /** D23: under a set-aside group's reason, a list of every file in it. Needs UX writer review. */
    seeAll: (x: number) => `See all ${n(x)} ${plural(x, 'file', 'files')}`,
    hideAll: 'Hide the list',
    allStay: 'These files stay in your recovery folder. Nothing has been deleted.',
    allListLabel: (group: string) => `Every file in ${group}`,
    /** A file in that list: its name, size and (if known) when it was taken. */
    fileMeta: (size: string, takenAt?: string) => (takenAt ? `${size} · ${dateTime(takenAt)}` : size),
    review: (x: number, mediaOnly: boolean) =>
      `Review my ${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    startOver: 'Scan a different folder',
  },

  /** D23: what a file in a set-aside group is, from what it holds (and PhotoRec's name for it). */
  fileType: (kind: string, ext: string) => {
    if (kind === 'empty') return 'Empty file';
    if (['jpeg', 'png', 'gif', 'webp', 'heic', 'avif', 'bmp', 'tiff', 'raw'].includes(kind)) return 'Photo';
    if (['mp4', 'mov', '3gp', 'avi', 'mts'].includes(kind)) return 'Video';
    const e = ext.toLowerCase();
    if (e === 'xml' || e === 'plist' || e === 'json' || e === 'ini') return 'App settings';
    if (e === 'txt' || e === 'log') return 'Log or text';
    if (e === 'sqlite' || e === 'db') return 'App database';
    if (e === 'html' || e === 'htm') return 'Web page';
    if (e === 'gz' || e === 'zip' || e === 'bz2') return 'Compressed file';
    return e ? `${e.toUpperCase()} file` : 'File';
  },

  groups: {
    small: {
      title: 'Small preview copies',
      why: 'Phones and apps save small preview copies of photos. These are tiny or blurry and have no camera details, so they’re usually copies of photos you already have.',
    },
    duplicate: {
      title: 'Exact copies',
      why: 'Each of these is exactly the same as a photo or video you’re keeping. You still have one of each.',
    },
    damaged: {
      title: 'Damaged or incomplete files',
      why: 'Part of each file is missing, so it may not open. Some photos still show part of the picture. Cut-off videos usually won’t play. If one might matter to you, keep it.',
    },
    system: {
      title: 'App and system files',
      why: 'These aren’t photos or videos. They’re leftover files from apps and from the phone or camera itself.',
    },
  } satisfies Record<SetAsideGroup, { title: string; why: string }>,

  empty: {
    noFiles: 'This folder is empty.',
    noFilesBody: 'Choose the folder your recovery program saved files into.',
    noKeepers: 'We didn’t find any photos or videos here.',
    noKeepersBody: 'Nothing was deleted. You can open the groups below to check, or choose a different folder.',
  },

  error: {
    title: 'We couldn’t open that folder.',
    body: 'Your files are fine. Nothing was changed. If the folder is on a memory card or USB drive, check that it’s still plugged in, then try again.',
    retry: 'Choose the folder again',
  },

  // Review timeline, "Choose what to save" (T24). Source: team/brand/quiet-prints/TL-*.dc.html,
  // strings from team/content/review-export-copy.md (T22, draft awaiting owner review).
  timeline: {
    title: 'Choose what to save',
    selectedWord: 'selected',
    intro: 'Everything starts selected, so nothing gets missed. Unselect anything you don’t want to save.',
    ledgerLabel: 'Your files, added up',
    ledgerTotal: 'Kept photos and videos',
    ledgerTotalMixed: 'Kept files',
    ledgerSelected: 'Selected to save',
    ledgerNotSelected: 'Not selected',
    ledgerSize: 'Size to save',
    ledgerAside: 'Still set aside, kept safe',
    ledgerSafe: 'Your files', // T76
    ledgerSafeValue: 'Not deleted, not sent anywhere',
    ledgerSafeSr: 'Your files',
    ledgerSafeValueSr: 'Not deleted, not sent anywhere',
    notSelectedMeans: 'Photos you don’t select stay where they are now. Nothing is deleted.',
    nothingSelected: 'Nothing is selected, so there’s nothing to save yet. Your photos are all still here.',
    save: (x: number) => (x === 0 ? 'Save selected' : `Save ${n(x)} selected`),
    selectAll: 'Select all',
    selectNone: 'Unselect all',
    footerCount: (sel: number, total: number) => `${n(sel)} of ${n(total)} selected`,
    footerDeleted: 'Nothing is deleted',
    /** T79: back to the top of Review (the summary and the first month). */
    backToTop: 'Back to top',
    announce: (sel: number, total: number) => (sel === 0 ? 'Nothing selected. Nothing is deleted.' : `${n(sel)} of ${n(total)} selected.`),
    announceGroup: (group: string, gSel: number, gTotal: number, sel: number, total: number) =>
      sel === 0 ? 'Nothing selected. Nothing is deleted.' : `${group}: ${n(gSel)} of ${n(gTotal)} selected. ${n(sel)} of ${n(total)} selected in all.`,
    jumpYear: 'Jump to a year',
    jumpMonth: 'Jump to a month',
    jumpMonthIn: (y: string) => `Jump to a month in ${y}`,
    noDatePill: (x: number) => `No date · ${n(x)}`,
    monthOption: (label: string, sel: number, total: number) => `${label} · ${n(sel)} of ${n(total)}`,
    filterLabel: 'Show only',
    // "Not selected" isn't in T22 (it has "Screenshots", which the app can't detect): needs UX writer review.
    filters: { all: 'All', photos: 'Photos', videos: 'Videos', unselected: 'Not selected' },
    monthSelected: (sel: number, total: number) => (sel === 0 ? `None of ${n(total)} selected` : `${n(sel)} of ${n(total)} selected`),
    monthNoneNote: 'These won’t be saved. They stay where they are, and nothing is deleted.',
    selectMonth: (name: string) => `Select all of ${name}`,
    unselectMonth: (name: string) => `Unselect all of ${name}`,
    selectNoDate: 'Select all with no date',
    unselectNoDate: 'Unselect all with no date',
    noDate: 'No date',
    noDateNote: 'We couldn’t find when these were taken, so they’re kept together here. Photos sent through chat apps often lose their date. They’ll be saved in a folder called No date.',
    daySelected: (sel: number, total: number) =>
      sel === 0 ? 'none selected' : sel === total ? (total === 1 ? '1 selected' : `all ${n(total)} selected`) : `${n(sel)} of ${n(total)} selected`,
    /** Checkbox names. "Save …" says what ticking does. */
    tileLabel: (type: 'photo' | 'video' | 'other', takenAt: string | undefined, pos: number, of: number, durationSec?: number, cantPlay = false) => {
      const what = type === 'other' ? 'file' : type;
      // Video length (not in T22: needs UX writer review). Mockup TL: "…, video, 0:42".
      const long = type === 'video' && durationSec !== undefined ? `, ${runTimeWords(durationSec)} long` : '';
      // T61, needs UX writer review: same words as the note on the tile.
      const note = cantPlay ? `. ${copy.timeline.cantPlay}` : '';
      return takenAt
        ? `Save ${what} from ${Number(takenAt.slice(8, 10))} ${monthYear(takenAt.slice(0, 7))}, ${takenAt.slice(11, 16)}${long}${note}`
        : `Save ${what} with no date (${n(pos)} of ${n(of)})${long}${note}`;
    },
    video: 'Video',
    /**
     * On a video tile when this browser can't play the video (old phone 3GP, HEVC in a browser
     * without it, AVI). T61, needs UX writer review. It's still selected and saved as it is.
     */
    cantPlay: 'Can’t play in this browser. It can still be saved.',
    /** The same note on timeline tiles under 120 px wide, where the full one only fits very small (T69). The tile's name keeps the full note. */
    cantPlayShort: 'Can’t play. Can save it.',
    emptyFilter: {
      photos: 'There are no photos to show.',
      videos: 'There are no videos to show.',
      unselected: 'Everything is selected right now. Anything you unselect will show here.',
      all: 'There’s nothing to choose from yet.',
    },
    /** Above the list while the Not selected filter is on. */
    unselectedNote: 'Select any you want to save after all. They stay in this list until you choose another filter.',
    showAll: 'Show all',
    asideLine: (x: number) => `${n(x)} ${plural(x, 'file is', 'files are')} still set aside, kept safe. To look through them or keep any, go back to Clean up.`,
    back: 'Back to Clean up',
    /** T79: next to both "Back to Clean up" buttons. */
    backKeeps: 'Your choices here are kept if you go back.',
  },

  /**
   * D24: "click to see larger", in Review and in the set-aside groups (Viewer.tsx). Needs UX writer
   * review. `aside` is a set-aside group, where files are not saved unless that group is kept.
   */
  viewer: {
    /** The tile's own name follows, e.g. "View larger: Save photo from 3 June 2022, 10:15". */
    open: (label: string) => `View larger: ${label}`,
    close: 'Close',
    previous: 'Previous',
    next: 'Next',
    position: (i: number, total: number) => `${n(i)} of ${n(total)}`,
    noDate: 'No date',
    /** '2022-06-03T10:15:…' → 'Friday 3 June 2022, 10:15' */
    date: (takenAt: string) => `${weekdayDayMonth(takenAt.slice(0, 10))} ${takenAt.slice(0, 4)}${takenAt.length >= 16 ? `, ${clock(takenAt)}` : ''}`,
    /** Beside the photo's own checkbox, whose name is the tile's ("Save photo from …"). */
    save: 'Save',
    loading: 'Opening…',
    tooLarge: (aside: boolean) => `This photo is too large to show here. ${aside ? 'It’s still in your recovery folder.' : 'You can still save it.'}`,
    cantPlay: (aside: boolean) => `This video can’t play in this browser. ${aside ? 'It’s still in your recovery folder.' : 'You can still save it.'}`,
    cantShow: (aside: boolean) => `This file can’t be shown here. ${aside ? 'It’s still in your recovery folder.' : 'You can still save it.'}`,
  },

  // Save step (T25). Source: team/brand/quiet-prints/EX-choose and EX-done (.dc.html), strings from
  // team/content/review-export-copy.md sections 4 to 7 (T22). "new, not in T22" = needs UX writer review.
  save: {
    // Folder and file names on the person's disk (D15 may rename "Keepsake photos").
    rootFolder: 'Keepsake photos',
    noDateFolder: 'No date',
    /** '06' → '06 June' */
    monthFolder: (mo: string) => `${mo} ${MONTHS[Number(mo) - 1]}`,
    zipName: (i: number, total: number) => (total === 1 ? 'Keepsake photos.zip' : `Keepsake photos ${i} of ${total}.zip`),
    receiptFile: 'Keepsake receipt.txt', // new, not in T22
    /** "photos and videos", or "files" when the selection has files that are neither. */
    what: (x: number, mediaOnly: boolean) => (mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')),

    // Choose where to save
    titleBefore: 'Where should we save your ',
    titleAfter: (x: number, mediaOnly: boolean) => ` ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}?`,
    ledgerLabel: 'What will be saved',
    ledgerSelected: 'Selected to save',
    ledgerSize: 'Total size',
    needSpace: (size: string) => `You’ll need at least ${size} of free space.`,
    newCopies: 'We save new copies. Your recovery folder stays exactly as it was.',
    // The claude.ai preview (a sandboxed frame), where neither folder saving nor downloads work.
    previewH: 'Saving isn’t available in this preview.',
    previewBody: 'In the real app, your photos are saved to a folder you choose.',
    folderH: 'Save to a folder',
    folderBody: 'Choose a folder or make a new one, for example in Pictures. We’ll put a folder called Keepsake photos inside it. Anything already there stays as it is.',
    notTheCard: 'Choose a place on this computer or on another drive. Don’t save onto the memory card your photos came from.',
    chooseFolder: 'Choose a folder',
    /** `bigFile`: a file over 2 GB makes its zip over 2 GB too, so "under 2 GB" isn't promised. */
    browserNote: (parts: number, bigFile = false) =>
      parts === 1
        ? `In Safari and Firefox, your photos and videos download as a zip file instead${bigFile ? '' : ', under 2 GB'}.`
        : `In Safari and Firefox, your photos and videos download as ${n(parts)} zip files instead${bigFile ? '' : ', each under 2 GB'}.`,
    zipH: 'Download as zip files',
    zipBody: (x: number, mediaOnly: boolean, parts: number, bigFile = false) =>
      `This browser can’t save straight into a folder. So your ${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')} ${
        parts === 1 ? `come as a zip file${bigFile ? '' : ', under 2 GB'}` : `come as ${n(parts)} zip files${bigFile ? '' : ', each under 2 GB'}`
      }. They go to your Downloads folder. Open each one to see your photos, sorted the same way.`,
    /** A file over 2 GB on its own (a long video) makes its zip bigger than that. */
    zipBigFile: 'Any file over 2 GB, usually a long video, gets a zip file of its own. That zip will be over 2 GB too.',
    zipAllowTip: 'Your browser may ask if Keepsake can download several files. Choose Allow.',
    zipChromeTip: 'To save straight into a folder, open Keepsake in Chrome or Edge.',
    downloadZips: (parts: number) => (parts === 1 ? 'Download zip file' : `Download ${n(parts)} zip files`),
    treeH: 'How your folder will look',
    treeLabel: 'Example of how your folder will look',
    /** The example in "How your folder will look" (made-up dates). */
    treeExample: { year: '2024', month: '06', files: ['2024-06-28 14.32.jpg', '2024-06-28 14.32 (2).jpg'] },
    treeCaption:'A folder for each year and month, and one called No date. Each file is named by the date and time it was taken. If two have the same time, the second gets (2) at the end.',
    back: 'Back to review',

    // Problems before saving starts
    deniedH: 'Keepsake can’t save to that folder.',
    deniedBody: 'Your browser didn’t allow it, or the folder is protected. Nothing was saved there, and nothing was deleted. Try a folder in Pictures or Documents.',
    chooseDifferent: 'Choose a different folder',
    recoveryH: 'That’s your recovery folder.',
    recoveryBody: 'To keep it exactly as it was, Keepsake won’t save there. Please choose a different folder.',
    // New (T25 QA follow-up), needs UX writer review: the safety check itself failed.
    uncheckedH: 'We couldn’t check that folder.',
    uncheckedBody: 'Before saving, we make sure a folder isn’t inside your recovery folder. This time we couldn’t tell, so nothing was saved there. Your files are fine. Please choose a different folder, for example in Pictures or Documents.',
    // New (T25 QA follow-up), needs UX writer review: this browser can't save into a folder safely after all.
    unsupportedH: 'Saving into a folder didn’t work in this browser.',
    // T64: "empty folders" is true when move() exists but fails on the first copy: dirFor() in
    // saveRun.ts has already made Keepsake photos/<year>/<month> by then (not when move() is missing).
    unsupportedBody: (mediaOnly: boolean) =>
      mediaOnly
        ? 'No photos or videos were saved there, and your files are fine. You may see some new empty folders there. You can download your photos and videos as zip files instead, using the button below.'
        : 'No files were saved there, and your files are fine. You may see some new empty folders there. You can download your files as zip files instead, using the button below.',
    // T22 proposed a new "Keepsake photos (2)" folder; T25 adds to the existing one instead. New, needs UX writer review.
    existsNote: 'There’s already a Keepsake photos folder here, so we’re adding to it. Nothing in it is changed or replaced. If a name is already taken, the new copy gets (2) at the end.',

    // Saving
    savingH: 'Saving your photos and videos…',
    progress: (done: number, total: number) => `Saved ${n(done)} of ${n(total)}`,
    zipProgress: (i: number, parts: number) => `Making zip file ${n(i)} of ${n(parts)}…`,
    reassure: 'This happens on your computer. Nothing is sent anywhere, and your recovery folder isn’t changed.',
    keepOpen: 'Keep this tab open until it’s done. If you can, keep the computer plugged in so it doesn’t go to sleep.',
    stop: 'Stop saving',
    stopping: 'Stopping…',
    announce: (done: number, total: number) => `Saved ${n(done)} of ${n(total)}.`,

    // Stopped and problems while saving
    stoppedH: 'Saving stopped.',
    stoppedBody: (done: number, total: number, mediaOnly: boolean, zip: boolean) =>
      `${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} ${done === 1 ? 'was' : 'were'} saved ${
        zip ? 'in zip files in your Downloads folder' : 'to Keepsake photos'
      }. None of your files were deleted. You can save the rest any time.`,
    saveRest: 'Save the rest',
    backToReview: 'Back to review',
    fullH: 'The drive is full.',
    fullBody: (done: number, total: number, mediaOnly: boolean, remaining: string, zip = false) =>
      `We saved ${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} before it ran out of space. ${zip ? 'They’re in zip files in your Downloads folder.' : 'They’re in Keepsake photos.'} None of your files were deleted, and your recovery folder is fine. Make some space, or choose a different drive, then try again. You need about ${remaining} more.`,
    brokenH: 'Saving stopped partway.',
    brokenBody: (done: number, total: number, mediaOnly: boolean, zip = false) =>
      `We saved ${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} before something went wrong. ${zip ? 'They’re in zip files in your Downloads folder.' : 'They’re in Keepsake photos.'} None of your files were deleted, and your recovery folder is fine. If you’re saving to a USB drive, check that it’s still plugged in, then try again.`,
    lostH: 'Keepsake can’t save to that folder anymore.',
    lostBody: (done: number, total: number, mediaOnly: boolean) =>
      `We saved ${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'}. None of your files were deleted. Choose the folder again to save the rest.`,
    chooseAgain: 'Choose the folder again',

    // Done
    doneStep: 'Done',
    doneBefore: 'Your ',
    doneAfter: (x: number, mediaOnly: boolean) =>
      ` ${mediaOnly ? plural(x, 'photo or video is', 'photos and videos are') : plural(x, 'file is', 'files are')} saved.`,
    partBefore: '',
    partAfter: (total: number, mediaOnly: boolean) => ` of your ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} are saved.`,
    failedLine: (x: number) => `${n(x)} ${plural(x, 'file', 'files')} couldn’t be copied. They may be damaged. They’re still in your recovery folder, so nothing is lost.`,
    doneLine: 'They’re in Keepsake photos, sorted into a folder for each year and month.',
    doneZipLine: (parts: number) =>
      parts === 1
        ? 'They’re in a zip file in your Downloads folder. Open it to see your photos, sorted into a folder for each year and month.'
        : `They’re in ${n(parts)} zip files in your Downloads folder. Open each one to see your photos, sorted into a folder for each year and month.`,
    /** Browsers can't open a folder in File Explorer or Finder (T25 finding), so say where it is. */
    findThem: (folder: string) => `To see them, open ${folder} › Keepsake photos in File Explorer (Windows) or Finder (Mac).`,
    findZip: (parts: number) =>
      parts === 1
        ? 'In your Downloads folder, look for Keepsake photos.zip.'
        : `In your Downloads folder, look for Keepsake photos 1 of ${n(parts)}.zip to Keepsake photos ${n(parts)} of ${n(parts)}.zip.`,
    closeNow: 'You can close Keepsake now. There’s nothing else to do.',
    secondCopy: 'If you can, keep a second copy too, on a USB drive or a backup you already use.',
    receiptH: 'Your receipt',
    rSaved: 'Saved',
    rSavedValue: (x: number, mediaOnly: boolean) => `${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    rFailed: 'Couldn’t save',
    rSavedTo: 'Saved to',
    rSavedToFolder: (folder: string) => `${folder} › Keepsake photos`,
    rSavedToZip: (parts: number) => `Downloads, ${n(parts)} zip ${plural(parts, 'file', 'files')}`,
    rSorted: 'Sorted into',
    rSortedValue: (years: number, months: number, noDate: number) => {
      const dated = years ? `${n(years)} ${plural(years, 'year', 'years')}, ${n(months)} ${plural(months, 'month', 'months')}` : '';
      return dated && noDate ? `${dated}, plus No date (${n(noDate)})` : dated || `No date (${n(noDate)})`;
    },
    rRecovery: 'Recovery folder',
    rRecoveryValue: 'Untouched',
    /** Receipt row (T58, D17): about the person's files, not the empty file Save may remove. */
    rSafe: 'Your files', // T76
    rSafeValue: 'None deleted, none sent anywhere',
    receiptNote: 'Save or print this so you can find your photos later.',
    saveReceipt: 'Save receipt',
    print: 'Print',
    seeWhich: 'See which ones',
    failedListLabel: 'Files that couldn’t be saved, by where they are in your recovery folder', // new, not in T22
    zipAgainNote: 'If a zip file didn’t download, download it again here. Your photos are fine, and nothing was deleted.', // adapted from T22 section 6
    zipAgain: (i: number, parts: number) => (parts === 1 ? 'Download zip file again' : `Download zip file ${n(i)} of ${n(parts)} again`),
    /** "16 October 2026, 16:05" (this computer's clock) */
    when: (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  },
  /**
   * The privacy page (T29) and the PhotoRec guide (T26), opened from the start screen (T67).
   * Source: team/content/privacy-page.md and photorec-guide.md, without the team notes and
   * without what isn't true yet (open source and the code link, the Wi-Fi check before QA signs
   * it off, private windows, "Is it free?" and "Why is it free?").
   * Written in a small Markdown (src/ui/markdown.ts): # ## ### headings; paragraphs, where a line
   * break stays a line break; "- " and "1. " lists (indent 3 spaces to put something inside an
   * item); **bold**; `code`; [words](#heading-id) links, to a heading on the same page only;
   * [Screenshot: what it shows] placeholders; --- for a divider. A heading's id is its words in
   * lower case, with spaces as dashes and punctuation dropped.
   */
  info: {
    back: 'Back to start',
    /** A placeholder where a screenshot will go (QA will supply them). */
    shot: (what: string) => `Screenshot to come: ${what}`,
    privacy: {
      link: `How ${APP} keeps your photos private`,
      /** In the browser tab: "Your privacy · Keepsake". */
      title: 'Your privacy',
      md: PRIVACY,
    },
    guide: {
      link: 'New to PhotoRec? Here’s how to recover your files',
      title: 'PhotoRec guide',
      md: GUIDE,
    },
  },
};
