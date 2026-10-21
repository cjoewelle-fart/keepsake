// Keeps the recovery folder's own folder handle from the moment it's picked (T55), so the Save
// step can refuse any save folder that is the recovery folder or inside it, however big the
// recovery is and whether or not a subfolder has files in it.
//
// browser-fs-access calls window.showDirectoryPicker() and hands back only the files, so for the
// length of one pick we watch what that call returns. The handle is only ever used to compare
// folders (isSameEntry, resolve): nothing is written through it, and it's opened read-only.

/** What the Save step needs from the recovery folder's handle. */
export type RecoveryRoot = {
  isSameEntry(other: unknown): Promise<boolean>;
  resolve(possibleDescendant: unknown): Promise<string[] | null>;
};

type PickerWindow = { showDirectoryPicker?: (...a: unknown[]) => Promise<unknown> };

/**
 * Run `open` (the folder pick) and also return the folder handle the browser's picker gave it,
 * if there was one. With the file-input fallback (Safari, Firefox) there's no handle.
 */
export async function withPickedFolder<T>(
  open: () => Promise<T>,
  win: PickerWindow | undefined = typeof window === 'undefined' ? undefined : (window as unknown as PickerWindow),
): Promise<{ result: T; root?: RecoveryRoot }> {
  const orig = win?.showDirectoryPicker;
  if (!win || typeof orig !== 'function') return { result: await open() };
  const own = Object.prototype.hasOwnProperty.call(win, 'showDirectoryPicker');
  let root: RecoveryRoot | undefined;
  // Not async: the real picker is called in the same task, so the click still counts as the
  // user gesture the browser asks for.
  win.showDirectoryPicker = function (this: unknown, ...a: unknown[]) {
    return orig.apply(this, a).then((h) => {
      const d = h as Partial<RecoveryRoot> | null;
      root = d && typeof d.isSameEntry === 'function' && typeof d.resolve === 'function' ? (d as RecoveryRoot) : undefined;
      return h;
    });
  };
  try {
    return { result: await open(), root };
  } finally {
    if (own) win.showDirectoryPicker = orig;
    else delete win.showDirectoryPicker;
  }
}
