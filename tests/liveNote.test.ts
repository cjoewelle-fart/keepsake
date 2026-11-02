import { describe, expect, it } from 'vitest';
import { NOTE_DELAY_MS, shownNote } from '../src/ui/liveNote';

const EMPTY = 'No files found.';

describe('start-screen live note', () => {
  it('shows nothing until the note has been marked ready (first pick, "Scan stopped")', () => {
    expect(shownNote(EMPTY, 1, undefined)).toBeUndefined();
    expect(shownNote(EMPTY, 1, 1)).toBe(EMPTY);
  });

  it('clears and refills when the same note comes back with a new key (empty folder twice)', () => {
    // Second pick: the screen gets key 2 while key 1 is still the ready one, so the region empties...
    expect(shownNote(EMPTY, 2, 1)).toBeUndefined();
    // ...and fills again once key 2 is ready.
    expect(shownNote(EMPTY, 2, 2)).toBe(EMPTY);
  });

  it('shows nothing without a note or a key', () => {
    expect(shownNote(undefined, 1, 1)).toBeUndefined();
    expect(shownNote(EMPTY, undefined, undefined)).toBeUndefined();
  });

  it('waits long enough for the empty region to register', () => {
    expect(NOTE_DELAY_MS).toBe(150);
  });
});
