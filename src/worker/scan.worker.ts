// Runs the scan off the main thread so the page stays responsive.
import * as Comlink from 'comlink';
import { scanAll } from '../engine/scan';
import type { FileRecord, FileSource, Progress } from '../engine/types';

let cancelled = false;

const fromFile = (f: File, path: string): FileSource => ({
  path,
  size: f.size,
  read: async (start, end) => new Uint8Array(await f.slice(start, end).arrayBuffer()),
});

const api = {
  async scan(files: File[], paths: string[], onProgress: (p: Progress) => void): Promise<FileRecord[] | null> {
    cancelled = false;
    return scanAll(files.map((f, i) => fromFile(f, paths[i])), { onProgress, isCancelled: () => cancelled });
  },
  cancel() {
    cancelled = true;
  },
};

export type ScanApi = typeof api;
Comlink.expose(api);
