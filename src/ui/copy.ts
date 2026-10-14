// All words the user sees live here, so the UX writer can edit them in one place.
import type { SetAsideGroup } from '../engine/summary';

const nf = new Intl.NumberFormat('en');
export const n = (x: number) => nf.format(x);
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many);

export const copy = {
  appName: 'Keepsake',
  steps: ['Recover', 'Scan', 'Clean up', 'Review', 'Export'],
  privacy: 'Your files never leave this computer, and your recovery folder is never changed.',

  start: {
    eyebrow: 'Step 2 of 5',
    title: 'Let’s sort out your recovered photos.',
    body: 'Choose the folder your recovery program saved files into. We’ll find the photos and videos worth keeping and set the clutter aside.',
    hint: 'Inside it, you’ll usually see folders named recup_dir.1, recup_dir.2 and so on.',
    choose: 'Choose recovery folder',
    browserNote: 'Keepsake works best in Chrome or Edge on a computer. You can still scan your folder in this browser.',
    stopped: 'Scan stopped. Nothing was changed, and you can start again any time.',
  },

  scanning: {
    title: 'Checking your files…',
    copiesTitle: 'Looking for exact copies…',
    progress: (done: number, total: number) => `Checked ${n(done)} of ${n(total)} files`,
    copiesProgress: (done: number, total: number) => `Compared ${n(done)} of ${n(total)} possible copies`,
    reassure: 'This happens on your computer. Your files aren’t uploaded anywhere.',
    stop: 'Stop scanning',
    stopping: 'Stopping…',
  },

  results: {
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
    undatedMore: 'They’ll go in their own “Undated” group so they don’t get lost.',
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

  review: {
    title: 'Your photos and videos by year',
    body: 'Here’s how many you have from each year. Seeing each photo and choosing which to save is coming in the next version.',
    undated: 'Photos with no date',
    videos: 'Videos',
    otherFiles: 'Other files you kept',
    back: 'Back to cleanup results',
  },
};
