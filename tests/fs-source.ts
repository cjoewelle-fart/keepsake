import { openSync, readSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FileSource } from '../src/engine/types';

/** A FileSource backed by a file on disk, for tests (read-only). */
export function fsSource(root: string, abs: string): FileSource {
  const size = statSync(abs).size;
  return {
    path: relative(root, abs).split('\\').join('/'),
    size,
    async read(start, end) {
      const len = Math.max(0, end - start);
      const buf = new Uint8Array(len);
      const fd = openSync(abs, 'r');
      try { readSync(fd, buf, 0, len, start); } finally { /* closed by GC-safe close below */ }
      (await import('node:fs')).closeSync(fd);
      return buf;
    },
  };
}

export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out.sort();
}
