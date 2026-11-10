// Where each saved copy goes and what it's called (T25). Pure and framework-free, so it can be
// tested in Node. The browser-only parts (writing to a folder, building zip downloads) live in
// saveRun.ts; this file only decides paths and names.
//
//   Upsort photos/2024/06 June/2024-06-28 14.32.jpg
//   Upsort photos/2024/06 June/2024-06-28 14.32 (2).jpg   (same minute)
//   Upsort photos/No date/f12345678.jpg                   (original name)
import type { Kind } from '../engine/sniff';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';

export type DateParts = { y: string; mo: string; d: string; h: string; mi: string; s: string };

/** 'YYYY-MM-DDTHH:mm(:ss)' → its fields, as written (camera local time, no time zone). */
export function dateParts(takenAt: string | undefined): DateParts | undefined {
  const m = takenAt && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(takenAt);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s = '00'] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59) return undefined;
  return { y, mo, d, h, mi, s };
}

const DEFAULT_EXT: Record<Kind, string> = {
  jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', heic: 'heic', avif: 'avif', bmp: 'bmp', tiff: 'tif', raw: '',
  mp4: 'mp4', mov: 'mov', '3gp': '3gp', avi: 'avi', mts: 'mts', empty: '', other: '',
};
/** Extensions that mean the same format; the file's own one is kept if it's one of these. */
const ALIASES: Partial<Record<Kind, string[]>> = {
  jpeg: ['jpg', 'jpeg'], tiff: ['tif', 'tiff'], heic: ['heic', 'heif'], mp4: ['mp4', 'm4v'], '3gp': ['3gp', '3g2'], mts: ['mts', 'm2ts'],
};

export const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** Lower-case extension of a file name ('' if none, or if it doesn't look like one). */
export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  const e = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(e) ? e : '';
}

/**
 * The extension for a saved copy. The format we found in the bytes wins over the name
 * PhotoRec gave it; RAW files (many formats, one kind) and unchecked files keep their own.
 */
export function extFor(kind: Kind, path: string): string {
  const own = extOf(baseName(path));
  if (!DEFAULT_EXT[kind]) return own;
  return ALIASES[kind]?.includes(own) || own === DEFAULT_EXT[kind] ? own : DEFAULT_EXT[kind];
}

/**
 * Names Windows keeps for devices, whatever comes after them: "CON", "con.jpg", "CON .jpg"
 * (spaces before the dot are ignored), COM0-9 and LPT0-9 with superscript ¹²³ too, CONIN$, CONOUT$.
 */
const RESERVED = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$) *(\.|$)/i;
/** Half of a surrogate pair with no other half: not text, and not valid UTF-8 in a zip or on disk. */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/**
 * Longest name safeName gives, in UTF-8 bytes (macOS and Linux allow 255 per name) and in
 * UTF-16 code units (for the path). NameBook may add " (n)" after it. Only "No date" keeps
 * original names this long; dated folders (up to "Upsort photos/2024/09 September/", 32) hold
 * short "YYYY-MM-DD HH.MM (n).ext" names. So the worst case is "Upsort photos/No date/" (22)
 * + 120 + " (n)", and a full path inside the zip or the chosen folder stays under 160
 * characters while " (n)" is under 18 (any n up to 13 digits). Windows Explorer adds the
 * Downloads folder and the zip's own folder in front, and its limit is 260.
 */
export const NAME_LIMITS = { bytes: 150, chars: 120 } as const;

/** UTF-8 length of a string, without encoding it. */
export function utf8Bytes(s: string): number {
  let b = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) b += 1;
    else if (c < 0x800) b += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { b += 4; i++; }
    else b += 3; // other BMP characters (a lone surrogate is written as U+FFFD, also 3)
  }
  return b;
}

const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined;

/** The longest start of `s` within both limits, cut between characters (never inside one). */
function cut(s: string, maxBytes: number, maxChars: number): string {
  let out = '';
  let bytes = 0;
  const pieces: Iterable<string> = graphemes ? [...graphemes.segment(s)].map((g) => g.segment) : Array.from(s); // code points
  for (const g of pieces) {
    const b = utf8Bytes(g);
    if (bytes + b > maxBytes || out.length + g.length > maxChars) break;
    out += g;
    bytes += b;
  }
  return out;
}

/** A name that's safe on Windows, macOS and Linux (and that the File System Access API accepts). */
export function safeName(name: string): string {
  // eslint-disable-next-line no-control-regex
  let s = name.replace(LONE_SURROGATE, '_').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/, '').trim();
  if (!s || s === '.' || s === '..') s = 'file';
  // One byte is kept for the "_" a reserved name gets.
  const maxBytes = NAME_LIMITS.bytes - 1;
  const maxChars = NAME_LIMITS.chars - 1;
  if (s.length > maxChars || utf8Bytes(s) > maxBytes) {
    const e = extOf(s);
    const own = e ? s.slice(-e.length) : ''; // the extension as written (extOf lower-cases it)
    const room = e ? e.length + 1 : 0;
    const base = cut(e ? s.slice(0, -room) : s, maxBytes - room, maxChars - room).replace(/[. ]+$/, '').trim() || 'file';
    s = e ? `${base}.${own}` : base;
  }
  if (RESERVED.test(s)) s = `_${s}`;
  return s;
}

/** The folder (below "Upsort photos") and preferred name for one file, before collisions. */
export function placeFor(r: Pick<FileRecord, 'takenAt' | 'kind' | 'path'>): { dir: string[]; base: string; ext: string } {
  const p = dateParts(r.takenAt);
  if (p) {
    return {
      dir: [p.y, copy.save.monthFolder(p.mo)],
      base: `${p.y}-${p.mo}-${p.d} ${p.h}.${p.mi}`,
      ext: extFor(r.kind, r.path),
    };
  }
  const own = safeName(baseName(r.path));
  const e = extOf(own);
  return { dir: [copy.save.noDateFolder], base: e ? own.slice(0, -(e.length + 1)) : own, ext: e ? own.slice(-e.length) : '' };
}

const key = (name: string) => name.normalize('NFC').toLowerCase();

/**
 * Hands out file names per folder, never the same one twice: "name.jpg", then "name (2).jpg",
 * "name (3).jpg". Case-insensitive (Windows and macOS folders are). Seed a folder with what's
 * already in it so nothing there is ever overwritten.
 */
export class NameBook {
  private dirs = new Map<string, Set<string>>();
  /** Where to start counting for a name already handed out, so many same-minute photos stay fast. */
  private next = new Map<string, number>();
  private names(dir: string): Set<string> {
    let s = this.dirs.get(dir);
    if (!s) this.dirs.set(dir, (s = new Set()));
    return s;
  }
  isSeeded(dir: string): boolean {
    return this.dirs.has(dir);
  }
  seed(dir: string, existing: Iterable<string>): void {
    const s = this.names(dir);
    for (const n of existing) s.add(key(n));
  }
  /** Mark a name as taken (e.g. one found on disk after it was handed out). */
  take(dir: string, name: string): void {
    this.names(dir).add(key(name));
  }
  /**
   * Give back a name handed out for a copy that didn't get it (its move failed), so the retry
   * doesn't skip a number. Callers still check the disk before using a name.
   */
  release(dir: string, name: string): void {
    this.dirs.get(dir)?.delete(key(name));
    const pre = `${dir}\u0000`;
    for (const h of [...this.next.keys()]) if (h.startsWith(pre)) this.next.delete(h);
  }
  claim(dir: string, base: string, ext: string): string {
    const s = this.names(dir);
    const make = (k: number) => `${base}${k > 1 ? ` (${k})` : ''}${ext ? `.${ext}` : ''}`;
    const hint = `${dir}\u0000${key(make(1))}`;
    let k = this.next.get(hint) ?? 1;
    while (s.has(key(make(k)))) k++;
    const name = make(k);
    s.add(key(name));
    this.next.set(hint, k + 1);
    return name;
  }
}

export const dirKey = (dir: readonly string[]) => dir.join('/');

/** Save order: oldest first (so "(2)" is the later photo in a burst), then "No date" by path. */
export function orderForSave<T extends Pick<FileRecord, 'takenAt' | 'path'>>(records: readonly T[]): T[] {
  const dated: { r: T; t: string }[] = [];
  const undated: T[] = [];
  for (const r of records) {
    const p = dateParts(r.takenAt);
    if (p) dated.push({ r, t: `${p.y}${p.mo}${p.d}${p.h}${p.mi}${p.s}` });
    else undated.push(r);
  }
  dated.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.r.path < b.r.path ? -1 : a.r.path > b.r.path ? 1 : 0));
  undated.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return [...dated.map((x) => x.r), ...undated];
}

export type Planned = {
  /** FileRecord.index */
  id: number;
  /** Folders below "Upsort photos". */
  dir: string[];
  name: string;
  size: number;
  takenAt?: string;
};

/** Names for every file, in save order, with collisions resolved (for the zip download). */
export function planNames(records: readonly FileRecord[], sizeOf: (r: FileRecord) => number = (r) => r.size, book = new NameBook()): Planned[] {
  return orderForSave(records).map((r) => {
    const { dir, base, ext } = placeFor(r);
    return { id: r.index, dir, name: book.claim(dirKey(dir), base, ext), size: sizeOf(r), takenAt: r.takenAt };
  });
}

/**
 * Every zip downloaded while this page is open (T89), so no two downloads ever share a name, even
 * after Stop, "Back to review" and Save again (which starts a new visit to the Save step).
 * - The very first zip, when its save fits in one, is "Upsort photos.zip".
 * - Every other zip is "Upsort photos part N.zip", N counting every zip made on this page.
 * Names are given out when a zip is made, not when it's planned, so a stopped part or one with no
 * readable file never leaves a gap.
 */
export class ZipLog {
  /** Files are remembered as "scan:index", since FileRecord.index restarts at 0 with every scan. */
  private made: { name: string; files: ReadonlySet<string>; visit: number }[] = [];
  /** Visit → the scan it saved from. */
  private visitScan: number[] = [0];
  private finished = new Set<number>();

  /** A new visit to the Save step, saving files from scan `scan` (unique while the page is open). */
  newVisit(scan: number): number {
    this.visitScan.push(scan);
    return this.visitScan.length - 1;
  }
  /** The name for the next zip; `partsInRun` is how many zips this run of the save planned. */
  nextName(partsInRun: number): string {
    return this.made.length === 0 && partsInRun === 1 ? copy.save.zipName : copy.save.zipPart(this.made.length + 1);
  }
  /** A zip was made and downloaded, holding these files (FileRecord indices). Returns its name. */
  add(visit: number, partsInRun: number, ids: readonly number[]): string {
    const name = this.nextName(partsInRun);
    const scan = this.visitScan[visit];
    this.made.push({ name, files: new Set(ids.map((id) => `${scan}:${id}`)), visit });
    return name;
  }
  /** That visit's save finished: its zips hold everything it saved. */
  finish(visit: number): void {
    this.finished.add(visit);
  }
  /**
   * Zips from visits before this one, from the same scan, whose save didn't finish (Stop, then
   * "Back to review"), since the last save from that scan that did (its Done screen already spoke
   * for them). They hold only some files. Zips from another scan (another folder, or the same one
   * scanned again) are never mentioned. `covered`: is everything in them also in this save (`saved`)?
   */
  leftovers(visit: number, saved: ReadonlySet<number>): { names: string[]; covered: boolean } {
    const scan = this.visitScan[visit];
    const sameScan = (v: number) => v < visit && this.visitScan[v] === scan;
    const since = Math.max(0, ...[...this.finished].filter(sameScan));
    const old = this.made.filter((z) => z.visit > since && sameScan(z.visit) && !this.finished.has(z.visit));
    const savedKeys = new Set([...saved].map((id) => `${scan}:${id}`));
    return { names: old.map((z) => z.name), covered: old.every((z) => [...z.files].every((k) => savedKeys.has(k))) };
  }
}

/** Full path inside a zip ("Upsort photos/2024/06 June/…"). */
export const zipPath = (p: Pick<Planned, 'dir' | 'name'>) => [copy.save.rootFolder, ...p.dir, p.name].join('/');

/** "6 years, 41 months, plus No date (312)" comes from these. */
export function sortedInto(planned: readonly Pick<Planned, 'dir'>[]): { years: number; months: number; noDate: number } {
  const years = new Set<string>();
  const months = new Set<string>();
  let noDate = 0;
  for (const p of planned) {
    if (p.dir[0] === copy.save.noDateFolder) { noDate++; continue; }
    years.add(p.dir[0]);
    months.add(dirKey(p.dir));
  }
  return { years: years.size, months: months.size, noDate };
}

export type PartLimits = {
  /** Every part (headers included) stays at or under this, unless one file alone is bigger. */
  maxBytes: number;
  /** Below 65,535 so a part never needs ZIP64 just for its file count. */
  maxEntries: number;
};
/** "Under 2 GB" in the units the app shows sizes in (1 GB = 1,000,000,000 bytes). */
export const ZIP_LIMITS: PartLimits = { maxBytes: 2_000_000_000 - 1, maxEntries: 65_000 };

/**
 * Split files into zip parts, in order, each under the limit. A file bigger than the limit
 * on its own (a long video) gets a part to itself.
 * @param cost bytes one entry adds to a zip (headers + data), see zip.ts entryCost
 * @param fixed bytes every zip has anyway (the end record), see zip.ts endCost
 */
export function splitParts<T>(items: readonly T[], cost: (x: T) => number, fixed: number, limits: PartLimits = ZIP_LIMITS): T[][] {
  const parts: T[][] = [];
  let cur: T[] = [];
  let bytes = fixed;
  for (const x of items) {
    const c = cost(x);
    if (cur.length && (bytes + c > limits.maxBytes || cur.length >= limits.maxEntries)) {
      parts.push(cur);
      cur = [];
      bytes = fixed;
    }
    cur.push(x);
    bytes += c;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** Why a write to the chosen folder failed, in the terms the screens use. */
export type WriteProblem = 'full' | 'denied' | 'broken';
export function classifyWriteError(e: unknown): WriteProblem {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError' || (e as { code?: number } | null)?.code === 22) return 'full';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  return 'broken';
}

/** The parts of a FileSystemDirectoryHandle the recovery-folder check needs. */
export type ResolvingDir = { resolve(possibleDescendant: ResolvingDir): Promise<string[] | null> };
/** The recovery folder's own handle, kept from when it was picked (see recoveryFolder.ts). */
export type RecoveryRootDir = ResolvingDir & { isSameEntry(other: ResolvingDir): Promise<boolean> };

/** The answer to "is this the recovery folder or inside it?": 'unknown' if the browser couldn't tell. */
export type FolderCheck = 'inside' | 'outside' | 'unknown';

/**
 * Is `chosen` the recovery folder or anywhere inside it (T55), at any depth, empty subfolders
 * included? Also 'inside' if the recovery folder is inside "<chosen>/Upsort photos", where the
 * copies would go. 'unknown' if the browser couldn't answer.
 */
export async function checkRecoveryFolder(root: RecoveryRootDir, chosen: ResolvingDir): Promise<FolderCheck> {
  try {
    if (await root.isSameEntry(chosen)) return 'inside';
    if ((await root.resolve(chosen)) !== null) return 'inside';
    const down = await chosen.resolve(root);
    return down !== null && down.length > 0 && key(down[0]) === key(copy.save.rootFolder) ? 'inside' : 'outside';
  } catch {
    return 'unknown';
  }
}

/**
 * Must Upsort refuse to save into `chosen`? Yes if it's inside the recovery folder (above), and
 * yes if the browser can't answer: a folder we can't check is never written to.
 */
export async function inRecoveryFolder(root: RecoveryRootDir, chosen: ResolvingDir): Promise<boolean> {
  return (await checkRecoveryFolder(root, chosen)) !== 'outside';
}

type ScannedFile = { directoryHandle?: unknown; webkitRelativePath?: string };
/**
 * The folders the scan's files are in, with their depth below the recovery folder, for the
 * fallback check when there's no handle for the recovery folder itself. Every folder, no limit.
 */
export function scanFolders(files: readonly ScannedFile[]): { dir: ResolvingDir; depth: number }[] {
  const m = new Map<unknown, number>();
  for (const f of files) {
    const d = f.directoryHandle;
    if (d && !m.has(d)) m.set(d, Math.max(0, (f.webkitRelativePath || '').split('/').length - 2));
  }
  return [...m].map(([dir, depth]) => ({ dir: dir as ResolvingDir, depth }));
}

/**
 * Best-effort fallback when the recovery folder's own handle isn't known: is `chosen` the recovery folder or inside it? The scan's files only know the folder they're
 * in (`directoryHandle`, e.g. recup_dir.1) and their path from the recovery folder
 * ('recovery/recup_dir.1/f1.jpg'), so for each such folder D at depth k below the recovery
 * folder: chosen is inside D, or chosen is D or one of its k ancestors up to the recovery folder.
 * Also true when the recovery folder is inside "<chosen>/<rootFolder>", where the copies would go
 * (same case-insensitive name compare as checkRecoveryFolder).
 * It can miss a subfolder with no scanned files in it; that's why the handle check comes first.
 */
export async function insideRecovery(chosen: ResolvingDir, dirs: readonly { dir: ResolvingDir; depth: number }[]): Promise<boolean> {
  for (const { dir, depth } of dirs) {
    if ((await dir.resolve(chosen)) !== null) return true; // chosen is D or below it
    const down = await chosen.resolve(dir); // chosen is above D
    if (down !== null && down.length <= depth) return true;
    // chosen is above the recovery folder: refuse if the path down goes through the save folder.
    if (down !== null && down.length > depth && key(down[0]) === key(copy.save.rootFolder)) return true;
  }
  return false;
}

export type Receipt = {
  when: Date;
  saved: number;
  failed: number;
  mediaOnly: boolean;
  savedTo: string;
  sorted: { years: number; months: number; noDate: number };
  /** Where the files that couldn't be saved are in the recovery folder. */
  failedPaths: readonly string[];
};

/** The receipt as a small text file, same words as the screen. */
export function receiptText(r: Receipt): string {
  const s = copy.save;
  const rows: [string, string][] = [
    [s.rSaved, s.rSavedValue(r.saved, r.mediaOnly)],
    [s.rFailed, String(r.failed)],
    [s.rSavedTo, r.savedTo],
    [s.rSorted, s.rSortedValue(r.sorted.years, r.sorted.months, r.sorted.noDate)],
    [s.rRecovery, s.rRecoveryValue],
    [s.rSafe, s.rSafeValue],
  ];
  const w = Math.max(...rows.map(([k]) => k.length));
  const lines = [
    `${copy.appName}: ${s.receiptH.toLowerCase()}`,
    s.when(r.when),
    '',
    ...rows.map(([k, v]) => `${k.padEnd(w)}  ${v}`),
    '',
    s.receiptNote,
  ];
  if (r.failedPaths.length) lines.push('', `${s.rFailed}:`, ...r.failedPaths.map((p) => `  ${p}`));
  return `${lines.join('\n')}\n`;
}
