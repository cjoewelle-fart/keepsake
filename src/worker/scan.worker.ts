// Runs the scan off the main thread so the page stays responsive.
import * as Comlink from 'comlink';
import { scanAll } from '../engine/scan';
import type { FileRecord, FileSource, Progress } from '../engine/types';

// One flag per scan: work abandoned by Stop keeps seeing its own (set) flag, even after a
// new scan starts, so it can't come back to life and report progress into the new one.
let current = { cancelled: false };

const fromFile = (f: File, path: string): FileSource => ({
  path,
  size: f.size,
  // A whole-file read skips slice(): in Chrome each slice() registers a new blob with the
  // browser process, which made up about a third of a 40,000-file scan (T27).
  read: async (start, end) => new Uint8Array(await (start <= 0 && end >= f.size ? f : f.slice(start, end)).arrayBuffer()),
});

const api = {
  async scan(files: File[], paths: string[], onProgress: (p: Progress) => void): Promise<FileRecord[] | null> {
    current.cancelled = true;
    const run = (current = { cancelled: false });
    return scanAll(files.map((f, i) => fromFile(f, paths[i])), { onProgress, isCancelled: () => run.cancelled });
  },
  cancel() {
    current.cancelled = true;
  },
};

export type ScanApi = typeof api;
Comlink.expose(api);
