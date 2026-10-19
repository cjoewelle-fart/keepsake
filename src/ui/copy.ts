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
  skip: 'Skip to content',
  privacy: 'Your files never leave this computer, and your recovery folder is never changed.',

  start: {
    eyebrow: 'Step 2 of 5',
    title: 'Let’s sort out your recovered photos.',
    body: 'Choose the folder your recovery program saved files into. We’ll find the photos and videos worth keeping and set the clutter aside.',
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
    deleted: 'Deleted: 0',
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
    ledgerSafeSr: 'Files deleted and uploaded',
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
    groupLabel: (open: boolean, title: string, count: number, kept: boolean) =>
      `${open ? 'Hide' : 'Show'} ${title.toLowerCase()}, ${n(count)} ${plural(count, 'file', 'files')}${kept ? ', keeping these' : ''}`,
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
      why: 'Part of each file is missing, so it may not open. Some still show part of a picture, so look through them in case one matters to you.',
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
    title: 'We couldn’t read that folder.',
    body: 'Nothing was changed. Try choosing the folder again. If it’s on an SD card or USB drive, check that it’s still plugged in.',
    retry: 'Choose folder again',
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
    ledgerSize: 'Size of what’s selected', // not in T22: needs UX writer review
    ledgerAside: 'Still set aside, kept safe',
    ledgerSafe: 'Deleted · Uploaded',
    ledgerSafeValue: '0 · 0',
    ledgerSafeSr: 'Files deleted and uploaded',
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
    tileLabel: (type: 'photo' | 'video' | 'other', takenAt: string | undefined, pos: number, of: number) => {
      const what = type === 'other' ? 'file' : type;
      return takenAt
        ? `Save ${what} from ${Number(takenAt.slice(8, 10))} ${monthYear(takenAt.slice(0, 7))}, ${takenAt.slice(11, 16)}`
        : `Save ${what} with no date (${n(pos)} of ${n(of)})`;
    },
    video: 'Video',
    emptyFilter: {
      photos: 'There are no photos to show.',
      videos: 'There are no videos to show.',
      unselected: 'Everything is selected. Photos you unselect will show here.',
      all: 'There’s nothing to choose from yet.',
    },
    showAll: 'Show all',
    asideLine: (x: number) => `${n(x)} ${plural(x, 'file is', 'files are')} still set aside, kept safe. To look through them or keep any, go back to Clean up.`,
    back: 'Back to Clean up',
  },

  save: {
    // Placeholder until the export step (T25) is built.
    title: (x: number) => `Ready to save ${n(x)} ${plural(x, 'file', 'files')}`,
    body: 'Saving to a new folder is coming in the next version. Nothing has been changed.',
    back: 'Back to choosing',
  },

  review: {
    title: 'Your photos and videos by year',
    body: 'Here’s how many you have from each year. Seeing each photo and choosing which to save is coming in the next version.',
    undated: 'Photos with no date',
    videos: 'Videos',
    otherFiles: 'Other files you kept',
    back: 'Back to cleanup results',
  },
};
