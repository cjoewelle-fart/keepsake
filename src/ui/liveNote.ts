/**
 * The start screen's note goes into a live region a moment after it's set, so screen readers
 * announce it (the region has to exist, empty, before its text arrives). Each note carries a
 * key that changes on every pick, so the same text twice in a row (an empty folder picked
 * again) still clears the region and fills it again, and is announced again.
 */
export const NOTE_DELAY_MS = 150;

/** The text the live region shows: the note once its own key has been marked ready, else nothing. */
export function shownNote(note: string | undefined, key: number | undefined, readyKey: number | undefined): string | undefined {
  return note && key !== undefined && readyKey === key ? note : undefined;
}
