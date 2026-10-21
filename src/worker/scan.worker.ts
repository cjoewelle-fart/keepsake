// Runs the scan off the main thread so the page stays responsive.
import * as Comlink from 'comlink';
import { scanAll } from '../engine/scan';
import { feed, type Feed } from '../engine/handoff';
import type { FileRecord, FileSource, Progress } from '../engine/types';

// One flag per scan: work abandoned by Stop keeps seeing its own (set) flag, even after a
// new scan starts, so it can't come back to life and report progress into the new one.
let current: { id: number; cancelled: boolean; files?: Feed<File> } = { id: 0, cancelled: false };

// The size comes from the page with the file (read there anyway, see engine/handoff.ts).
const fromFile = (f: File, path: string, size: number): FileSource => ({
  path,
  size,
  // A whole-file read skips slice(): in Chrome each slice() registers a new blob with the
  // browser process, which made up about a third of a 40,000-file scan (T27).
  read: async (start, end) => new Uint8Array(await (start <= 0 && end >= size ? f : f.slice(start, end)).arrayBuffer()),
});

const stop = () => {
  current.cancelled = true;
  current.files?.close(new Error('stopped'));
};

const api = {
  /**
   * Scan files the page hands over with add() in batches (T52); the paths come first so the
   * scan can start, and show progress, before every file has arrived.
   */
  async scan(id: number, paths: string[], onProgress: (p: Progress) => void): Promise<FileRecord[] | null> {
    stop();
    const files = feed<File>(paths, fromFile);
    const run = (current = { id, cancelled: false, files });
    try {
      return await scanAll(files.sources, { onProgress, isCancelled: () => run.cancelled, ready: files.ready });
    } finally {
      if (current === run) current.files = undefined; // let go of the files once done
    }
  },
  /** Files `start`, `start + 1`, … of scan `id`. Batches from an earlier, stopped scan are dropped. */
  add(id: number, start: number, files: File[], sizes: number[]) {
    if (current.id === id && !current.cancelled) current.files?.add(start, files, sizes);
  },
  cancel() {
    stop();
  },
};

export type ScanApi = typeof api;
Comlink.expose(api);
