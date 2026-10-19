// Off the main thread: the CRC-32 each zip entry needs (T25). Reads the file in slices, so
// only one slice (8 MB) is in memory at a time, however big the video.
import * as Comlink from 'comlink';
import { crc32 } from '../ui/zip';

const SLICE = 8 * 1024 * 1024;

const api = {
  /** CRC-32 and the number of bytes actually read (to spot a file that changed since the scan). */
  async crc(file: Blob): Promise<{ crc: number; size: number }> {
    let crc = 0;
    let size = 0;
    for (let at = 0; at < file.size; at += SLICE) {
      const chunk = new Uint8Array(await file.slice(at, Math.min(file.size, at + SLICE)).arrayBuffer());
      crc = crc32(chunk, crc);
      size += chunk.length;
    }
    return { crc, size };
  },
};

export type SaveApi = typeof api;
Comlink.expose(api);
