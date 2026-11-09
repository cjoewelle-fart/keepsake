# Your privacy

<!-- T29 · UX writer · 2026-10-16. In-app privacy page. [Name] = product name (rename pending). [CONFIRM: …] = developer to check against the app before publishing. Notes in <!-- --> are for the team, not users. -->

**Your photos never leave this computer, and [Name] never changes or deletes your files.**

## Nothing is uploaded

[Name] runs inside your web browser, on your computer. When you choose your recovery folder, your browser reads the files right here. They are not sent to us or to anyone else.

There is no [Name] server that stores photos. The app is a set of files your browser loads once, like a page in a book. After that, all the sorting happens on your computer.

The app is also built so the page can't send data to other websites. It doesn't use ads or tracking. One small part is from another company: our host, Netlify, adds a small piece of code for its "Powered by Netlify" badge. It comes from the same address as the app, and it can't send anything to other websites.

iPhone photos (HEIC files) are turned into previews on your computer too. The part that does this comes with [Name]. Nothing is fetched from anywhere else.

Some browsers show a message like "Upload files to this site?" when you choose a folder. That is the browser's own wording. The files are only read on this computer. They are not sent anywhere.
<!-- [CONFIRM: which browsers show "upload" wording in the folder dialog (Chrome/Edge show "Upload {n} files to this site?" on the fallback path; Firefox/Safari?). Adjust or drop this paragraph to match.] -->

## None of your files are deleted

[Name] only reads your recovery folder. It can't change it, move files in it, or delete anything from it.

When we set files aside, they stay exactly where they were. "Set aside" only means we don't show them with your photos. You can keep any of them.

When you save your photos, [Name] makes new copies in a folder you choose. It never replaces a file that's already there. Your recovery folder stays as it was.

If saving stops partway, [Name] removes the one empty file it had just started for that copy. It never removes anything that was there before, any copy it finished, or anything in your recovery folder.
<!-- D17. Saving has shipped: writes only inside <chosen folder>/Keepsake photos, refuses the recovery folder, copies and never moves, never overwrites. Removes only its own 0-byte file when a copy fails or is stopped. -->

## Nothing is hidden

[Name] is free and open source. That means anyone can read the instructions the app is made from, check what it does, and point out problems.

[Link: See the code — LINK PLACEHOLDER]
<!-- [CONFIRM: public repo URL, and add the LICENSE file (GPL-3.0 planned) before this page says "open source".] -->

## How to check for yourself

You don't have to take our word for it. Here are three ways to check.

**1. Turn off the internet.**
Open [Name]. When the page has loaded, turn off Wi-Fi (or unplug the internet cable). Then choose your folder. [Name] keeps working, because it doesn't need the internet to read or sort your photos.
<!-- PUBLISH ONLY AFTER QA CONFIRMS OFFLINE WORKS END TO END (voice.md rule 4). Today the app has no offline install (phase 2), so: [CONFIRM: with Wi-Fi off after load, does every step work, including iPhone (HEIC) previews? The HEIC decoder is loaded lazily from the app's own files the first time it's needed, so it may fail if the network is off before then. The example files are also fetched on demand. Reloading the page offline will fail until offline install ships.] -->

**2. Read the code.**
The code is public. Anyone who knows how to read it, or a friend who does, can check what [Name] does with your files.
[Link: See the code — LINK PLACEHOLDER]

**3. Watch what your browser sends.**
Browsers have a tool that lists everything a page sends and receives. On a computer using Chrome or Edge:
1. Press **F12** (on a Mac, press **Option + Command + I**).
2. Click the **Network** tab.
3. Use [Name] as normal.

You'll see [Name] loading its own files when the page opens, plus one small file from Netlify for its badge. You won't see your photos being sent anywhere.
<!-- [CONFIRM: what the Network tab actually shows during a scan in the production build. Preview images use blob: URLs, which can appear in the list as "blob:" lines with the app's own address. If they do, add: "You may see lines starting with 'blob:'. Those are your photos being shown on this computer, not sent anywhere."] -->

## What we can't control

We're honest about the limits.

- **Your browser.** [Name] runs inside your browser, so it can only be as private as the browser is. Use a browser you trust, kept up to date.
- **Browser extensions.** Add-ons you've installed in your browser (like ad blockers, shopping or translation tools) may be able to see pages you open. If you're worried, turn them off while you use [Name], or use a private window.
<!-- [CONFIRM: that the folder picker works in a private/incognito window in Chrome and Edge before recommending it.] -->
- **Your computer's own backups.** Photos you save may be copied by backup or sync tools you already use, like OneDrive, iCloud, Google Drive or Dropbox. That's set up on your computer, not by [Name].
- **The website that sends you the app.** [Name] is hosted by Netlify. Like most hosts, Netlify may keep basic visit records, such as your internet address (IP address) and the time you opened the page. Those records never include your photos.
<!-- Nov 9: host is Netlify (beta). Revisit these three lines (host, “another company”, Network tab) if the launch host changes. -->

## What [Name] stores

- **On our side: nothing.** We have no server that keeps photos, scan results or accounts.
- **In your browser: the app itself.** Your browser may keep [Name]'s own files so it opens faster or works without the internet. These are the app's files, not your photos.
<!-- [CONFIRM: offline install is phase 2. Until it ships, this is only the browser's normal cache. Update once the offline files are in place.] -->
- **Your scan results: only in this browser tab.** The list of what [Name] found is kept while the tab is open. When you close the tab, it's gone. Your photos stay safe in your recovery folder and wherever you saved them.
<!-- [CONFIRM: today nothing is written to localStorage/IndexedDB (checked in src, 2026-10-16). If "resume a scan" is added later, this line must change to say what is kept in the browser and how to clear it.] -->

## Questions

**Do you see my photos?**
No. Your photos are read on your computer and never sent to us. We have no way to see them.

**Do I need an account?**
No. There's nothing to sign up for and no email to give.

**Is it free?**
Yes. [Name] is free to use. There's nothing to buy inside it.
<!-- [CONFIRM: owner decision that there's no paid tier or donation ask planned. Keep this answer only if true.] -->

**Why is it free?**
[Name] is an open-source project, made to help people who have lost photos. It doesn't need servers to store your photos, so it costs very little to run. We don't make money from your data, because we never have it.
<!-- [CONFIRM: owner's reason and any funding (personal project, donations, grant). Rewrite the first sentence to match.] -->
