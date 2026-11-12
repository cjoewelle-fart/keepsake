/**
 * UX5: when leaving the page (reload, closing the tab) would lose work, the browser asks first.
 * Only the browser's own "Leave site?" prompt: no dialog or control of ours.
 */
export type LeaveState = {
  /** A save is running (copying into a folder, or building zip files). */
  saving: boolean;
  /** The selection on review differs from the default after a scan (everything selected). */
  choicesMade: boolean;
  /** The last save finished (the receipt is showing): the choices are already saved. */
  saved: boolean;
};

/** Whether a `beforeunload` prompt should stop the page from closing right now. */
export function needsLeaveGuard({ saving, choicesMade, saved }: LeaveState): boolean {
  return saving || (choicesMade && !saved);
}

/**
 * Ask the browser to confirm leaving (when `active()` says so at that moment). Returns the remover.
 * `active` is read at unload time, because the selection is mutated in place.
 */
export function addLeaveGuard(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, active: () => boolean): () => void {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!active()) return;
    e.preventDefault();
    // Older Chromium and Safari still need returnValue set to show the prompt.
    e.returnValue = '';
  };
  target.addEventListener('beforeunload', onBeforeUnload);
  return () => target.removeEventListener('beforeunload', onBeforeUnload);
}
