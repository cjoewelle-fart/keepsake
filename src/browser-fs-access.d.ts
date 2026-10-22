// browser-fs-access ships its file-input fallback as `directoryOpenLegacy` but doesn't type it.
// It's the same call as directoryOpen, always through <input type="file" webkitdirectory>.
import 'browser-fs-access';

declare module 'browser-fs-access' {
  export function directoryOpenLegacy(options?: { recursive: boolean }): Promise<File[]>;
}
