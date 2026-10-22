// Where the page is running, for the parts that depend on it: the claude.ai preview runs the
// app inside a sandboxed frame, where the folder picker is refused (or missing) and downloads may
// be blocked. Pure functions of a window-like object, so they're tested in Node.

type Win = { self?: unknown; top?: unknown; document?: { domain?: string } };

/** Is the page inside a frame (another page's iframe)? A frame we can't even look at counts. */
export function inFrame(w: object | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!w) return false;
  try {
    const x = w as Win;
    return x.self !== x.top;
  } catch {
    return true;
  }
}

/**
 * Can the recovery folder be picked with the browser's folder picker? Not in a frame: Chromium
 * refuses it in sandboxed and cross-origin frames (SecurityError), so the page uses the
 * folder-upload input there instead (it still only reads the files on this computer).
 */
export function canUseFolderPicker(w: object | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  return !!w && 'showDirectoryPicker' in w && !inFrame(w);
}

/**
 * Is the page in a sandboxed frame? Every sandboxed document refuses a document.domain
 * assignment (no sandbox keyword lifts it), so trying one is a safe probe: assigning the same
 * value changes nothing. Only tried inside a frame.
 */
export function inSandbox(w: object | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!w || !inFrame(w)) return false;
  const d = (w as Win).document;
  if (!d) return false;
  try {
    // eslint-disable-next-line no-self-assign
    d.domain = d.domain;
    return false;
  } catch {
    return true;
  }
}

/**
 * Can a download (a zip, the receipt) be handed to the browser? Not from a sandboxed frame:
 * downloads there need the frame's allow-downloads keyword, the page can't see whether it has
 * it, and a blocked download fails silently. So there we say saving isn't available.
 */
export const canDownload = (w: object | undefined = typeof window !== 'undefined' ? window : undefined): boolean => !inSandbox(w);
