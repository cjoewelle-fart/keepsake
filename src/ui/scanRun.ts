// One scan on the page (T100).
//
// The scan worker reports progress through a callback (a Comlink proxy), which travels on its
// own message channel, apart from the one that brings back the scan's answer. The browser keeps
// each channel in order, not the two together: the last "Checked 3 of 3" can arrive AFTER the
// answer, and showing it then put the page back on the progress screen for good, over the
// results (most runs with 1 to 3 files, where the two are sent almost at once). So progress
// counts only while its scan is still the current one and hasn't ended.

/** A scan run: its id (never reused while the page is open) and whether it has ended. */
export type ScanRun = { id: number; stopped: boolean };

/**
 * The progress callback for `run`: passes updates to `show` while `run` is the current scan
 * and still going; an update that arrives after it ended, or was replaced, is dropped.
 */
export function progressFor<P>(run: ScanRun, current: () => ScanRun, show: (p: P) => void): (p: P) => void {
  return (p) => {
    if (!run.stopped && current() === run) show(p);
  };
}
