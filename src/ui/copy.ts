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
/** Bytes as people read them: '840 KB', '3.4 GB'. */
export const bytes = (x: number) => {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let u = 0;
  while (x >= 1000 && u < units.length - 1) { x /= 1000; u++; }
  return u === 0 ? `${n(x)} ${plural(x, 'byte', 'bytes')}` : `${x >= 100 ? Math.round(x) : x.toFixed(1).replace(/\.0$/, '')} ${units[u]}`;
};

export const copy = {
  appName: 'Keepsake',
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
    browserNote: 'Keepsake works best in Chrome or Edge on a computer. You can still scan your folder in this browser.',
    stopped: 'Scan stopped. Nothing was changed, and you can start again any time.',
    samples: 'Try with example files',
    samplesNote: 'No recovery folder handy? The example files come from a test memory card that was wiped and then recovered.',
  },

  scanning: {
    title: 'Checking your files…',
    copiesTitle: 'Looking for exact copies…',
    progress: (done: number, total: number) => `Checked ${n(done)} of ${n(total)} files`,
    copiesProgress: (done: number, total: number) => `Compared ${n(done)} of ${n(total)} possible copies`,
    reassure: 'This happens on your computer. Nothing is uploaded, and you can stop any time.',
    // “Your files”: Save may remove an empty file it made itself (D17), never one of yours (T58).
    deleted: 'Your files deleted: 0',
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
    ledgerSafe: 'Deleted · Uploaded',
    ledgerSafeValue: '0 · 0',
    ledgerSafeSr: 'Your files deleted and uploaded',
    ledgerSafeValueSr: 'None deleted, none uploaded',
    ledgerChanged: (keep: number, aside: number) => `Now keeping ${n(keep)} ${plural(keep, 'file', 'files')}. ${n(aside)} set aside.`,
    untouched: 'Your recovery folder is exactly as it was.',
    takeYourTime: 'Take your time. Nothing changes until you choose.',
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
    undo: 'Set these aside again',
    movedBack: 'Keeping these',
    previewUnavailable: 'No preview',
    review: (x: number, mediaOnly: boolean) =>
      `Review my ${n(x)} ${mediaOnly ? plural(x, 'photo or video', 'photos and videos') : plural(x, 'file', 'files')}`,
    startOver: 'Scan a different folder',
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
    ledgerSafe: 'Deleted · Uploaded',
    ledgerSafeValue: '0 · 0',
    ledgerSafeSr: 'Your files deleted and uploaded',
    ledgerSafeValueSr: 'None deleted, none uploaded',
    notSelectedMeans: 'Photos you don’t select stay where they are now. Nothing is deleted.',
    nothingSelected: 'Nothing is selected, so there’s nothing to save yet. Your photos are all still here.',
    save: (x: number) => (x === 0 ? 'Save selected' : `Save ${n(x)} selected`),
    selectAll: 'Select all',
    selectNone: 'Unselect all',
    footerCount: (sel: number, total: number) => `${n(sel)} of ${n(total)} selected`,
    footerDeleted: 'Deleted: 0',
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
    reassure: 'This happens on your computer. Nothing is uploaded, and your recovery folder isn’t changed.',
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
    rSafe: 'Your files deleted · uploaded',
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
};
