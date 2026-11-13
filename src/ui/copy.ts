// All words the user sees live here, so the UX writer can edit them in one place.
import type { SetAsideGroup } from '../engine/summary';
import { APP_NAME, REPO_URL, TAGLINE } from '../brand';

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

// The product name lives in src/brand.ts (one setting, so a rename is code-only).
const APP = APP_NAME;
// The save folder's name, used for the folder, the zips and every sentence that names it (T94).
const ROOT_FOLDER = `${APP} photos`;
/** ROOT_FOLDER for use inside a RegExp. */
const ROOT_FOLDER_RE = ROOT_FOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The privacy page and PhotoRec guide texts (copy.info), in the small Markdown described there.
/**
 * D48: "Nothing is hidden" and its "See the code" link appear only once the repository is public
 * (`repoUrl` = REPO_URL in src/brand.ts, empty until then). The open-source notices link is always there.
 */
/**
 * D49 (owner, Nov 13): the launch build is hosted on Cloudflare Pages, the beta on Netlify. The three
 * host lines below name the real host; nothing else on the page changes.
 */
export type Host = 'netlify' | 'cloudflare';
export const HOST: Host = import.meta.env.MODE === 'launch' ? 'cloudflare' : 'netlify';
const hostLines = (host: Host) =>
  host === 'cloudflare'
    ? {
        noTracking: 'The app is also built so the page can’t send data to other websites. It doesn’t use ads or tracking.',
        devtools: `You’ll see ${APP} loading its own files when the page opens. You won’t see your photos being sent anywhere.`,
        visits: `${APP} is hosted by Cloudflare. Like most hosts, Cloudflare may keep basic visit records, such as your internet address (IP address) and the time you opened the page. Those records never include your photos.`,
      }
    : {
        noTracking: 'The app is also built so the page can’t send data to other websites. It doesn’t use ads or tracking. One small part is from another company: our host, Netlify, adds a small piece of code for its “Powered by Netlify” badge. It comes from the same address as the app, and it can’t send anything to other websites.',
        devtools: `You’ll see ${APP} loading its own files when the page opens, plus one small file from Netlify for its badge. You won’t see your photos being sent anywhere.`,
        visits: `${APP} is hosted by Netlify. Like most hosts, Netlify may keep basic visit records, such as your internet address (IP address) and the time you opened the page. Those records never include your photos.`,
      };
export const privacyMd = (repoUrl: string, host: Host = HOST) => `# Your privacy

**Your photos never leave this computer, and ${APP} never changes or deletes your files.**

## Nothing is sent anywhere

${APP} runs inside your web browser, on your computer. When you choose your recovery folder, your browser reads the files right here. They are not sent to us or to anyone else.

There is no ${APP} server that stores photos. The app is a set of files your browser loads once, like a page in a book. After that, all the sorting happens on your computer.

${hostLines(host).noTracking}

Photos on the start screen are from Unsplash, by Chris Flexen, averie woodard and Derek Thomson. They come with ${APP}, so nothing is loaded from Unsplash.

iPhone photos (HEIC files) are turned into previews on your computer too. The part that does this comes with ${APP}. Nothing is fetched from anywhere else.

Parts of ${APP}, like this one, are free software made by others. Their licences are listed in the notices.
[Open-source notices](THIRD_PARTY_NOTICES.txt)

Some browsers show a message like “Upload files to this site?” when you choose a folder. That is the browser’s own wording. The files are only read on this computer. They are not sent anywhere.

## None of your files are deleted

${APP} only reads your recovery folder. It can’t change it, move files in it, or delete anything from it.

When we set files aside, they stay exactly where they were. “Set aside” only means we don’t show them with your photos. You can keep any of them.

When you save your photos, ${APP} makes new copies in a folder you choose. It never replaces a file that’s already there. Your recovery folder stays as it was.

If saving stops partway, ${APP} removes the one empty file it had just started for that copy. It never removes anything that was there before, any copy it finished, or anything in your recovery folder.

${repoUrl ? `## Nothing is hidden

${APP} is free and open source. That means anyone can read the instructions the app is made from, check what it does, and point out problems.
[See the code](${repoUrl})

` : ''}## How to check for yourself

You don’t have to take our word for it. Here’s how to check.

**Watch what your browser sends.**
Browsers have a tool that lists everything a page sends and receives. On a computer using Chrome or Edge:
1. Press **F12** (on a Mac, press **Option + Command + I**).
2. Click the **Network** tab.
3. Use ${APP} as normal.

${hostLines(host).devtools}

## What we can’t control

We’re honest about the limits.

- **Your browser.** ${APP} runs inside your browser, so it can only be as private as the browser is. Use a browser you trust, kept up to date.
- **Browser extensions.** Add-ons you’ve installed in your browser (like ad blockers, shopping or translation tools) may be able to see pages you open. If you’re worried, turn them off while you use ${APP}.
- **Your computer’s own backups.** Photos you save may be copied by backup or sync tools you already use, like OneDrive, iCloud, Google Drive or Dropbox. That’s set up on your computer, not by ${APP}.
- **The website that sends you the app.** ${hostLines(host).visits}

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
const PRIVACY = privacyMd(REPO_URL);

const GUIDE = `# Get your photos back from a memory card with PhotoRec

This guide helps you look for lost photos on a phone’s memory card (SD card), a USB stick or a camera card. It uses PhotoRec, a free program. It works on Windows and Mac.

PhotoRec finds the photos. Then ${APP} puts them in order by date.

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
5. Leave **File Formats** as it is. PhotoRec looks for all kinds of files, and that’s fine. ${APP} sets aside what isn’t a photo or video.
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
   You don’t need **Options** or **File Opt**. PhotoRec looks for all kinds of files, and that’s fine. ${APP} sets aside what isn’t a photo or video.
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

---

## Part 7: Sort your photos with ${APP}

PhotoRec’s part is done. Now ${APP} puts what PhotoRec found in order.

1. Go back to the start of ${APP}. You can use the **Sort my recovered files** button at the bottom of this page.
2. Click **Sort my recovered files**.
3. Choose your \`Recovered photos\` folder (the one that holds the recup_dir folders).

${APP} finds the photos and videos, sets the rest aside, and sorts your photos into folders by date. It only reads your \`Recovered photos\` folder. Nothing in it is changed or deleted.

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
  /** The steps inside the app (warmth spec §1). Recovering with PhotoRec happens before, so it isn't one. */
  steps: ['Scan', 'Sort', 'Choose', 'Save'],
  stepOf: (i: number, total: number, name: string) => `Step ${i + 1} of ${total} · ${name}`,
  /** Read after a finished step's name in the step indicator. */
  stepDone: '(done)',
  stepsLabel: 'Steps',
  /** The browser tab's title on each step: "Sort · Upsort". `app` keeps the test build's "(test)". */
  pageTitle: (step: string, app: string) => `${step} · ${app}`,
  skip: 'Skip to content',

  start: {
    // Warmth (Nov 6, UX writer option A): one plain sentence that doesn't promise a result.
    // Round 4 (Nov 7): one h1, the prints between its two parts (one line on desktop). Round 6: the
    // comma is shown, so screen readers hear titleA + titleJoin + titleB exactly as the line reads
    // ("Recovered photos, sorted by date.").
    // Nov 10: owner asked for a more human start (UX writer).
    titleA: 'Recovered photos,',
    titleJoin: ' ',
    titleB: 'sorted by date.',
    /** Round 6: How it works now covers the year and month folders, so the lede is short. */
    // D41 (Nov 11): the owner's approved sentence, word for word.
    body: `${APP} turns the jumble of files a recovery tool gives back into a dated photo library. It’s free, runs in your browser, and nothing is uploaded or deleted.`,
    /** D41: the same label as the button at the end of the PhotoRec guide. Still opens the folder picker. */
    choose: 'Sort my recovered files',
    /** Small text under the button, first in the help group. */
    hint: 'Look for the one that holds recup_dir.1, recup_dir.2 and so on.',
    /** Under the button: takes over from the old "Recover" step. Opens the PhotoRec guide. */
    noFolder: 'No recovery folder yet? Here’s how to make one',
    /** The date tag on the hero fan's middle print (decorative). Step 2's panel uses the same month. */
    fanDate: 'Mar 2009',
    /** T83: the privacy promise. Round 6: a plain line right below the button (70 characters at most). */
    promise: 'Your photos stay on your computer. Nothing is uploaded or deleted.',
    /**
     * Round 6: "How it works", three steps below the help text. Titles 28 characters at most.
     * `panel` is the step's small picture, one line each (lines ending in "/" are folders, and each
     * folder line indents the lines after it). Step 2's panel is the app's real save path for a photo
     * taken on 14 March 2009 at 19:05 (tests/save.test.ts checks it against savePlan). Step 3 shows
     * three photo tiles instead.
     */
    how: {
      h: 'How it works',
      /** Round 7: small captions above step 1's and step 2's pictures, either side of the arrow (8 characters at most). */
      before: 'Before',
      after: 'After',
      steps: [
        {
          title: 'Files come back unsorted',
          body: 'Your recovery program brings back files, but not their names or folders. Photos end up mixed in with small previews, app images and copies, with names like f0123456.jpg.',
          panel: ['recup_dir.1/', 'f0123456.jpg', 'f0123457.jpg', 'f0124410.jpg'],
          /** Shown right-aligned beside each line of the panel ('' for none). The 9 KB one is a small preview (7 characters at most). */
          sizes: ['', '2.4 MB', '9 KB', '2.4 MB'],
        },
        {
          title: 'We sort them by date',
          body: `${APP} puts each photo in order by the year and month it was taken. Copies and app images are set aside, never deleted.`,
          panel: [`${ROOT_FOLDER}/`, '2009/', '03 March/', '2009-03-14 19.05.jpg'],
        },
        {
          title: 'You choose what to keep',
          body: 'Look through, unselect anything you don’t want, and save a sorted copy. Your recovery folder stays as it was.',
          panel: [] as string[],
        },
      ],
    },
    /** T83: "Good to know", a short Q&A. Round 6: a quiet section at the bottom of the page. */
    faqH: 'Good to know',
    // D41 (Nov 11): four questions. The last one ends with a link to the PhotoRec guide (`guideLink`).
    faq: [
      { q: 'Is it free?', a: 'Yes. Sorting and saving your photos is free, and there’s no account to make.' },
      { q: 'Does it upload my photos?', a: `No. ${APP} runs inside your browser, on your computer. Your photos are never sent to us or anyone else.` },
      { q: 'Will it change my files?', a: 'No. It only reads them. Saving makes new copies, so you’ll need some free space.' },
      { q: 'I haven’t recovered my files yet', a: `Start with PhotoRec, a free recovery program. ${APP} sorts what it finds. It doesn’t recover files itself.`, guide: true },
    ] as { q: string; a: string; guide?: boolean }[],
    /** Under the last answer: opens the PhotoRec guide. */
    guideLink: 'Read the step-by-step PhotoRec guide',
    /**
     * D43: the launch video section, shown only when a video is set (src/brand.ts LAUNCH_VIDEO).
     * Nothing loads until the button is pressed. `play` is the visible label ("40 sec"); `playName`
     * is the button's accessible name, with the length in words ("40 seconds").
     */
    video: {
      h: `Watch ${APP} sort a recovery folder`,
      play: (seconds: number) => `Play the video (${Math.round(seconds)} sec)`,
      playName: (seconds: number) => `Play the video, ${runTimeWords(seconds)}`,
      offline: 'The video needs an internet connection. Everything else here works offline.',
    },
    /** D41: the quiet footer under Good to know (logo, name, tagline). */
    tagline: TAGLINE,
    browserNote: `${APP} works best in Chrome or Edge on a computer. You can still scan your folder in this browser.`,
    stopped: 'Scan stopped. Nothing was changed, and you can start again any time.',
    /** Inside the claude.ai preview the folder is chosen with the browser's upload dialog. */
    uploadNote: 'Your browser may ask “Upload files to this site?” That’s the browser’s own wording. Your files are only read on this computer, not sent anywhere.',
    samples: 'Try with example files',
    samplesNote: 'No recovery folder handy? The example files come from a test memory card that was wiped and then recovered.',
  },

  scanning: {
    title: 'Checking your files…',
    copiesTitle: 'Checking for photos saved twice…',
    progress: (done: number, total: number) => `Checked ${n(done)} of ${n(total)} files`,
    copiesProgress: (done: number, total: number) => `Compared ${n(done)} of ${n(total)} possible copies`,
    reassure: 'This happens on your computer. Nothing is sent anywhere, and you can stop any time.',
    /** Round 2: shown after about a minute of scanning. */
    slow: 'Big folders can take a while. You can leave this tab open and come back.',
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
    /** Round 2: with the first and last year among the kept files ('YYYY'). */
    sortedLine: (first?: string, last?: string) =>
      !first || !last ? 'They’re sorted by the date each one was taken.'
        : first === last ? `They’re sorted by the date each one was taken, in ${first}.`
          : `They’re sorted by the date each one was taken, from ${first} to ${last}.`,
    noDatesLine: 'We couldn’t find a date on any of them, so they’re kept together.',
    ledgerLabel: 'Your files, added up',
    ledgerChecked: 'Files checked',
    ledgerKept: 'Kept, sorted by date',
    ledgerAside: 'Set aside, kept safe below',
    // Warmth (Nov 6): one safety note under the ledger, a heading line and a line under it.
    safeH: 'None of your files were deleted or sent anywhere.',
    safeLine: 'They’re all still in your recovery folder, just as they were.',
    ledgerChanged: (keep: number, aside: number) => `Now keeping ${n(keep)} ${plural(keep, 'file', 'files')}. ${n(aside)} set aside.`,
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
    /** The results h1: "We found 214 photos and videos." `mediaOnly` is false once a kept group adds other files (same test as `review`). */
    titleBefore: 'We found ',
    titleAfter: (keep: number, mediaOnly = true) =>
      mediaOnly ? ` ${plural(keep, 'photo or video', 'photos and videos')}.` : ` ${plural(keep, 'file', 'files')} to look through.`,
    // Not shown since the Quiet Prints layout (T38); kept for the UX writer.
    eyebrow: (total: number) => `Scan finished · ${n(total)} files checked`,
    keepingLegend: (x: number) => `Keeping ${n(x)}`,
    asideLegend: (x: number) => `Set aside ${n(x)}`,
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
    /** UX11: added to a tile's accessible name (not shown) when it has no preview. */
    noPreviewName: (name: string) => `${name}. No preview`,
    /** UX11: read after the file type on a tile with no preview and no name of its own (not shown). */
    noPreviewAfterType: ', no preview',
    /** D23: under a set-aside group's reason, a list of every file in it. Needs UX writer review. */
    seeAll: (x: number) => `See all ${n(x)} ${plural(x, 'file', 'files')}`,
    hideAll: 'Hide the list',
    allStay: 'These files stay in your recovery folder. Nothing has been deleted.',
    allListLabel: (group: string) => `Every file in ${group}`,
    /** A file in that list: its name, size and (if known) when it was taken. */
    fileMeta: (size: string, takenAt?: string) => (takenAt ? `${size} · ${dateTime(takenAt)}` : size),
    review: (x: number, mediaOnly: boolean) =>
      `Review my ${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    startOver: 'Sort a different folder', // T83
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
    noFiles: 'This folder looks empty.',
    noFilesBody: 'Nothing was changed. Your recovery program may have saved its files somewhere else. Look for the folder that holds recup_dir.1.',
    noKeepers: 'We didn’t find any photos or videos here.',
    noKeepersBody: 'Nothing was deleted. Some damaged files may still show part of a picture. Open the groups below to check, or choose a different folder.',
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
    safeH: 'None of your files are deleted or sent anywhere.',
    safeLine: 'Anything you leave out stays safe in your recovery folder.',
    nothingSelected: 'Nothing is selected, so there’s nothing to save yet. Your photos are all still here.',
    /** Round 2: says what happens. The number is the footer's selected count. */
    save: (x: number, mediaOnly = true) =>
      x === 0 ? (mediaOnly ? 'Save my photos and videos' : 'Save my files')
        : `Save my ${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    /** Round 2: under the ledger when anything is left out. `kind`: what the unselected files all are. */
    leftOutSize: (x: number, size: string, kind: 'photo' | 'video' | 'file') =>
      `Leaving out ${n(x)} ${kind === 'photo' ? plural(x, 'photo', 'photos') : kind === 'video' ? plural(x, 'video', 'videos') : plural(x, 'file', 'files')} makes your save ${size} smaller.`,
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
    // "Not selected" isn't in T22: needs UX writer review. T50 "Screenshots" and T59 "From chat apps"
    // (new, needs UX writer review): neutral names, since photos from chat apps are often family photos.
    filters: { all: 'All', photos: 'Photos', videos: 'Videos', unselected: 'Not selected', screenshots: 'Screenshots', chat: 'From chat apps' },
    /** The count in each filter chip, after its name (the chip's name is "Photos 120"). */
    filterCount: (x: number) => n(x),
    /** m4: said after the number in each filter chip, not shown ("Screenshots 4 files"). */
    filterCountUnit: (x: number) => ` ${plural(x, 'file', 'files')}`,
    /** T50/T59: under the filter chips while a filter other than All is on. Also said by the status line. */
    showing: (shown: number, total: number) => `Showing ${n(shown)} of ${n(total)}.`,
    showingAll: (total: number) => `Showing all ${n(total)}.`,
    /** Next to "Showing N of M": filters never change what's saved. */
    filterOnlyShows: 'A filter only changes what you see. Nothing is unselected or deleted.',
    /** T50/T59: above the list while that filter is on. Plain about it being a guess, and about why someone might keep them. */
    lookNote: {
      screenshots: 'These look like screenshots of a phone or computer screen. Some are worth keeping, like a message or a ticket. This is a best guess from each file, so some may be missed.',
      chat: 'These look like photos sent or saved through chat apps such as WhatsApp or Messenger. Many are family photos worth keeping. This is a best guess from each file, so some may be missed.',
    },
    // T60 "Largest first" (all new, needs UX writer review: see review-export-copy.md §3b).
    orderLabel: 'Sort',
    orders: { date: 'By date', size: 'Largest first' },
    /** Said by the status line when the order changes. */
    orderAnnounce: { date: 'Showing by date.', size: 'Showing largest first.' },
    /** Above the list in the Largest first order. */
    sizeNote: "Largest files first. If the drive you're saving to is small, you can unselect big files you don't need. They stay where they are now. Nothing is deleted.",
    /** A row's checkbox name: the size first (what this order is for), then the tile's own name. */
    /**
     * `file`: the file's own name (e.g. f12345678.mov), so rows of the same size, kind and date get
     * different names in Largest first (T89 QA, a11y). New, needs UX writer check.
     */
    sizeRowLabel: (size: string, name: string, file?: string) => (file ? `${size}, ${file}. ${name}` : `${size}. ${name}`),
    /** The row's "View larger" name in Largest first, with the file's own name (T89 QA). New, needs UX writer check. */
    sizeRowOpen: (name: string, file: string) => `${name}, ${file}`,
    /** The kind of file on a row, after its date. */
    rowKind: { photo: 'Photo', video: 'Video', other: 'File' },
    /** Next to the selected count in the bars, in the Largest first order. */
    footerSize: (size: string) => `${size} to save`,
    /** Added to the status line in the Largest first order, so the size is heard too. */
    announceSize: (size: string) => ` ${size} to save.`,
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
    /** `pos`/`of` (a no-date file's place in its day) are left out in Largest first, where they mean nothing. */
    tileLabel: (type: 'photo' | 'video' | 'other', takenAt: string | undefined, pos: number | undefined, of: number | undefined, durationSec?: number, cantPlay = false) => {
      const what = type === 'other' ? 'file' : type;
      // Video length (not in T22: needs UX writer review). Mockup TL: "…, video, 0:42".
      const long = type === 'video' && durationSec !== undefined ? `, ${runTimeWords(durationSec)} long` : '';
      // T61, needs UX writer review: same words as the note on the tile.
      const note = cantPlay ? `. ${copy.timeline.cantPlay}` : '';
      return takenAt
        ? `Save ${what} from ${Number(takenAt.slice(8, 10))} ${monthYear(takenAt.slice(0, 7))}, ${takenAt.slice(11, 16)}${long}${note}`
        : `Save ${what} with no date${pos !== undefined && of !== undefined ? ` (${n(pos)} of ${n(of)})` : ''}${long}${note}`;
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
      screenshots: 'Nothing here looks like a screenshot.',
      chat: 'Nothing here looks like it came from a chat app.',
      all: 'There’s nothing to choose from yet.',
    },
    /** Above the list while the Not selected filter is on. */
    unselectedNote: 'Select any you want to save after all. They stay in this list until you choose another filter.',
    showAll: 'Show all',
    asideLine: (x: number) => `${n(x)} ${plural(x, 'file is', 'files are')} still set aside, kept safe. To look through them or keep any, go back to Sort.`,
    back: 'Back to Sort',
    /** T79: next to both "Back to Sort" buttons. */
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
    // Folder and file names on the person's disk. The folder name is ROOT_FOLDER (top of this file),
    // so the folder, the zips and the sentences that name it can't drift apart.
    rootFolder: ROOT_FOLDER,
    noDateFolder: 'No date',
    /** '06' → '06 June' */
    monthFolder: (mo: string) => `${mo} ${MONTHS[Number(mo) - 1]}`,
    // T89 (UX writer, Nov 3): one zip is "Upsort photos.zip"; any other is "part N", N counting
    // every zip made while the page is open (so a save after Stop never reuses a name).
    zipName: `${ROOT_FOLDER}.zip`,
    zipPart: (k: number) => `${ROOT_FOLDER} part ${k}.zip`,
    receiptFile: `${APP} receipt.txt`, // new, not in T22
    /** "photos and videos", or "files" when the selection has files that are neither. */
    what: (x: number, mediaOnly: boolean) => (mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')),

    // Choose where to save
    titleBefore: 'Where should we save your ',
    titleAfter: (x: number, mediaOnly: boolean) => ` ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}?`,
    ledgerLabel: 'What will be saved',
    ledgerSelected: 'Selected to save',
    ledgerSize: 'Total size',
    needSpace: (size: string) => `This makes new copies, so you’ll need at least ${size} of free space.`,
    /**
     * Round 2: what's being kept, in real numbers. `days`: separate calendar dates among the dated
     * files; `first` and `last`: their first and last month ('YYYY-MM'). See ui/span.ts.
     */
    span: (days: number, first: string, last: string, mediaOnly: boolean) =>
      `${mediaOnly ? 'Photos and videos' : 'Files'} from ${n(days)} ${plural(days, 'day', 'days')}${
        first.slice(0, 4) !== last.slice(0, 4) ? `, ${first.slice(0, 4)} to ${last.slice(0, 4)}` : first === last ? ` in ${monthYear(first)}` : ` in ${first.slice(0, 4)}`
      }.`,
    spanNoDate: (x: number) => (x === 1 ? 'Plus 1 with no date, kept in its own folder.' : `Plus ${n(x)} with no date, kept together in their own folder.`),
    benefit: 'Once saved, they’re all in one place, sorted by date, ready to look through or back up.',
    /** Round 2: under the done heading, counting only the copies that saved. */
    doneSpan: (days: number, first: string, last: string) =>
      `That’s ${n(days)} ${plural(days, 'day', 'days')}${
        first.slice(0, 4) !== last.slice(0, 4) ? `, from ${first.slice(0, 4)} to ${last.slice(0, 4)},` : first === last ? ` in ${monthYear(first)},` : ` in ${first.slice(0, 4)},`
      } now in one place.`,
    safeH: 'None of your files are deleted or sent anywhere.',
    safeLine: 'We save new copies. Your recovery folder stays as it was.',
    // The claude.ai preview (a sandboxed frame), where neither folder saving nor downloads work.
    previewH: 'Saving isn’t available in this preview.',
    previewBody: 'In the real app, your photos are saved to a folder you choose.',
    folderH: 'Save to a folder',
    folderBody: `Choose a folder or make a new one, for example in Pictures. We’ll put a folder called ${ROOT_FOLDER} inside it. Anything already there stays as it is.`,
    notTheCard: 'Choose a place on this computer or on another drive. Don’t save onto the memory card your photos came from.',
    chooseFolder: 'Choose a folder',
    /** UX9: on the folder button while the picker or the browser's permission question is open. */
    checkingFolder: 'Checking the folder…',
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
    zipAllowTip: `Your browser may ask if ${APP} can download several files. Choose Allow.`,
    zipChromeTip: `To save straight into a folder, open ${APP} in Chrome or Edge.`,
    downloadZips: (parts: number) => (parts === 1 ? 'Download zip file' : `Download ${n(parts)} zip files`),
    treeH: 'How your folder will look',
    treeLabel: 'Example of how your folder will look',
    /** The example in "How your folder will look" (made-up dates). */
    treeExample: { year: '2024', month: '06', files: ['2024-06-28 14.32.jpg', '2024-06-28 14.32 (2).jpg'] },
    treeCaption:'A folder for each year and month, and one called No date. Each file is named by the date and time it was taken. If two have the same time, the second gets (2) at the end.',
    back: 'Back to review',

    // Problems before saving starts
    deniedH: `${APP} can’t save to that folder.`,
    deniedBody: 'Your browser didn’t allow it, or the folder is protected. Nothing was saved there, and nothing was deleted. Try a folder in Pictures or Documents.',
    chooseDifferent: 'Choose a different folder',
    recoveryH: 'That folder is part of your recovery folder.', // T83
    recoveryBody: `${APP} doesn’t save there, so your recovered files stay exactly as they are. Nothing was saved or changed. Choose a different folder, for example in Pictures.`,
    // New (T25 QA follow-up), needs UX writer review: the safety check itself failed.
    uncheckedH: 'We couldn’t check that folder.',
    uncheckedBody: 'Before saving, we make sure a folder isn’t inside your recovery folder. This time we couldn’t tell, so nothing was saved there. Your files are fine. Please choose a different folder, for example in Pictures or Documents.',
    // New (T25 QA follow-up), needs UX writer review: this browser can't save into a folder safely after all.
    unsupportedH: 'Saving into a folder didn’t work in this browser.',
    // T64: "empty folders" is true when move() exists but fails on the first copy: dirFor() in
    // saveRun.ts has already made Upsort photos/<year>/<month> by then (not when move() is missing).
    unsupportedBody: (mediaOnly: boolean) =>
      mediaOnly
        ? 'No photos or videos were saved there, and your files are fine. You may see some new empty folders there. You can download your photos and videos as zip files instead, using the button below.'
        : 'No files were saved there, and your files are fine. You may see some new empty folders there. You can download your files as zip files instead, using the button below.',
    // T22 proposed a new "Keepsake photos (2)" folder (the name then); T25 adds to the existing one instead. New, needs UX writer review.
    existsNote: `There’s already an ${ROOT_FOLDER} folder here, so we’re adding to it. Nothing in it is changed or replaced. If a name is already taken, the new copy gets (2) at the end.`,

    // Saving
    savingH: 'Saving your photos and videos…',
    progress: (done: number, total: number) => `Saved ${n(done)} of ${n(total)}`,
    /** Round 2: the month being saved now ('YYYY-MM'), after the count. */
    progressMonth: (month: string) => ` · now ${monthYear(month)}`,
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
        zip ? 'in zip files in your Downloads folder' : `to ${ROOT_FOLDER}`
      }. None of your files were deleted. You can save the rest any time.`,
    saveRest: 'Save the rest',
    backToReview: 'Back to review',
    fullH: 'The drive is full.',
    fullBody: (done: number, total: number, mediaOnly: boolean, remaining: string, zip = false) =>
      `We saved ${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} before it ran out of space. ${zip ? 'They’re in zip files in your Downloads folder.' : `They’re in ${ROOT_FOLDER}.`} None of your files were deleted, and your recovery folder is fine. Make some space, or choose a different drive, then try again. You need about ${remaining} more.`,
    brokenH: 'Saving stopped partway.',
    brokenBody: (done: number, total: number, mediaOnly: boolean, zip = false) =>
      `We saved ${n(done)} of ${n(total)} ${mediaOnly ? 'photos and videos' : 'files'} before something went wrong. ${zip ? 'They’re in zip files in your Downloads folder.' : `They’re in ${ROOT_FOLDER}.`} None of your files were deleted, and your recovery folder is fine. If you’re saving to a USB drive, check that it’s still plugged in, then try again.`,
    lostH: `${APP} can’t save to that folder anymore.`,
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
    doneLine: `They’re in ${ROOT_FOLDER}, sorted into a folder for each year and month.`,
    doneZipLine: (parts: number) =>
      parts === 1
        ? 'They’re in a zip file in your Downloads folder. Open it to see your photos, sorted into a folder for each year and month.'
        : `They’re in ${n(parts)} zip files in your Downloads folder. Open each one to see your photos, sorted into a folder for each year and month.`,
    /** Browsers can't open a folder in File Explorer or Finder (T25 finding), so say where it is. */
    findThem: (folder: string) => `To see them, open ${folder} › ${ROOT_FOLDER} in File Explorer (Windows) or Finder (Mac).`,
    /**
     * Built from the names of this save's zips (T89, UX writer, Nov 3). 2 names go in the sentence
     * with "and"; 3 or more in an unbroken run read "… part 1.zip to … part 5.zip"; others come as a list.
     */
    findZip: (names: readonly string[]): { text: string; list?: string[] } => {
      const total = names.length;
      const lead = 'In your Downloads folder, look for';
      if (total === 0) return { text: '' };
      if (total === 1) return { text: `${lead} ${names[0]}.` };
      const first = new RegExp(`^${ROOT_FOLDER_RE} part (\\d+)\\.zip$`).exec(names[0]);
      const unbroken = !!first && names.every((name, i) => name === `${ROOT_FOLDER} part ${Number(first[1]) + i}.zip`);
      if (total === 2) return { text: `${lead} these 2 zip files: ${names[0]} and ${names[1]}.` };
      if (unbroken) return { text: `${lead} these ${n(total)} zip files: ${names[0]} to ${names[total - 1]}.` };
      return { text: `${lead} these ${n(total)} zip files:`, list: [...names] };
    },
    /**
     * Zips left from an earlier save that didn't finish (Stop, then Back to review, then Save again).
     * `covered`: everything in them is in this save too. T89, new, needs UX writer check.
     */
    earlierZips: (names: readonly string[], covered: boolean, zipsNow: number, mediaOnly: boolean) => {
      const one = names.length === 1;
      const list = one ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      const what = mediaOnly ? 'photos and videos' : 'files';
      return `${list} ${one ? 'is' : 'are'} from an earlier save that didn’t finish. ${
        covered
          ? `Everything in ${one ? 'it' : 'them'} is also in the ${zipsNow === 1 ? 'zip file' : 'zip files'} above.`
          : `${one ? 'It has' : 'They have'} some ${what} that aren’t in this save.`
      }`;
    },
    closeNow: `You can close ${APP} now, or sort another folder.`, // T83
    /** T83: back to the start screen; this tab's results are cleared, nothing on disk is touched. */
    startOver: 'Sort another folder',
    startOverNote: 'Your saved photos stay where they are. This receipt will close, so save or print it first.',
    secondCopy: 'For some photos, this may be your only copy. If you can, keep a second copy on a USB drive or a backup you already use.',
    receiptH: 'Your receipt',
    rSaved: 'Saved',
    rSavedValue: (x: number, mediaOnly: boolean) => `${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    rFailed: 'Couldn’t save',
    rSavedTo: 'Saved to',
    rSavedToFolder: (folder: string) => `${folder} › ${ROOT_FOLDER}`,
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
    /** Built from the file's own name, so the button says what it downloads (T89, new, needs UX writer check). */
    zipAgain: (name: string) => `Download ${name} again`,
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
      /** In the browser tab: "Your privacy · Upsort". */
      title: 'Your privacy',
      md: PRIVACY,
    },
    guide: {
      title: 'PhotoRec guide',
      md: GUIDE,
      /** T83: a primary button after the guide's text, back to the start screen. */
      cta: 'Sort my recovered files',
    },
  },
};
