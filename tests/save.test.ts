import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../src/engine/types';
import {
  NameBook, ZIP_LIMITS, classifyWriteError, dateParts, extFor, insideRecovery, orderForSave, placeFor,
  NAME_LIMITS, planNames, receiptText, safeName, sortedInto, splitParts, utf8Bytes, ZipLog, zipPath,
} from '../src/ui/savePlan';
import type { ResolvingDir } from '../src/ui/savePlan';
import { END_COST, ZipWriter, crc32, dosDateTime, dosFrom, entryCost } from '../src/ui/zip';
import { copy } from '../src/ui/copy';
import { REPO_URL } from '../src/brand';

let i = 0;
const rec = (takenAt: string | undefined, path?: string, kind: FileRecord['kind'] = 'jpeg', size = 1000): FileRecord =>
  ({ index: i++, path: path ?? `recup_dir.1/f${String(i).padStart(7, '0')}.jpg`, size, kind, takenAt, group: 'keep', reason: 'photo' });

describe('where each copy goes', () => {
  it('dated files: Upsort photos/YYYY/MM Month/YYYY-MM-DD HH.MM.ext', () => {
    const p = placeFor(rec('2024-06-28T14:32:09'));
    expect(p).toEqual({ dir: ['2024', '06 June'], base: '2024-06-28 14.32', ext: 'jpg' });
    expect(zipPath({ dir: p.dir, name: '2024-06-28 14.32.jpg' })).toBe('Upsort photos/2024/06 June/2024-06-28 14.32.jpg');
  });

  it('"No date" files keep their original name', () => {
    expect(placeFor(rec(undefined, 'recup_dir.3/f0001234.jpg'))).toEqual({ dir: ['No date'], base: 'f0001234', ext: 'jpg' });
    expect(placeFor(rec(undefined, 'recup_dir.3/README'))).toEqual({ dir: ['No date'], base: 'README', ext: '' });
  });

  it('a date that is not a real date counts as no date', () => {
    expect(dateParts('2024-13-01T10:00:00')).toBeUndefined();
    expect(dateParts('0000-00-00T00:00:00')).toBeUndefined();
    expect(dateParts('nonsense')).toBeUndefined();
    expect(dateParts('2024-01-02T03:04')).toEqual({ y: '2024', mo: '01', d: '02', h: '03', mi: '04', s: '00' });
    expect(placeFor(rec('2024-13-01T10:00:00', 'a/f1.jpg')).dir).toEqual(['No date']);
  });

  it('the format found in the bytes decides the extension; known aliases and RAW keep their own', () => {
    expect(extFor('jpeg', 'a/f1.JPEG')).toBe('jpeg');
    expect(extFor('jpeg', 'a/f1.png')).toBe('jpg'); // PhotoRec guessed wrong
    expect(extFor('heic', 'a/f1.heic')).toBe('heic');
    expect(extFor('mov', 'a/f1.mp4')).toBe('mov');
    expect(extFor('tiff', 'a/f1.tif')).toBe('tif');
    expect(extFor('raw', 'a/f1.CR2')).toBe('cr2');
    expect(extFor('other', 'a/f1')).toBe('');
  });

  it('names are safe on Windows, macOS and Linux', () => {
    expect(safeName('a:b*c?.jpg')).toBe('a_b_c_.jpg');
    expect(safeName('con.jpg')).toBe('_con.jpg');
    expect(safeName('photo. ')).toBe('photo');
    expect(safeName('..')).toBe('file');
    expect(safeName(`${'x'.repeat(300)}.jpg`)).toBe(`${'x'.repeat(115)}.jpg`); // 119 characters
  });
});

describe('the start screen shows the real save naming (round 6)', () => {
  it('How it works step 2 is the path a photo from 14 March 2009, 19:05 is saved to', () => {
    const p = placeFor({ takenAt: '2009-03-14T19:05:00', kind: 'jpeg', path: 'recup_dir.1/f0123456.jpg' });
    expect(copy.start.how.steps[1].panel).toEqual([`${copy.save.rootFolder}/`, ...p.dir.map((d) => `${d}/`), `${p.base}.${p.ext}`]);
    // The same month as the date tag on the hero fan's middle print.
    expect(copy.start.fanDate).toBe('Mar 2009');
  });

  it('step 1 is a PhotoRec folder of f…jpg names, step 3 has no listing (photo tiles)', () => {
    const [dir, ...names] = copy.start.how.steps[0].panel;
    expect(dir).toBe('recup_dir.1/');
    expect(names).toHaveLength(3);
    for (const n of names) expect(n).toMatch(/^f\d{7}\.jpg$/);
    expect(copy.start.how.steps[2].panel).toEqual([]);
  });

  it('step 1 shows a size beside each file (the 9 KB one a small preview), the folder none', () => {
    const { panel, sizes } = copy.start.how.steps[0];
    expect(sizes).toHaveLength(panel.length);
    expect(sizes![0]).toBe('');
    for (const size of sizes!) expect(size.length).toBeLessThanOrEqual(7);
    expect(copy.start.how.steps[1].sizes).toBeUndefined();
    expect(copy.start.how.steps[2].sizes).toBeUndefined();
  });

  it('keeps to the designer\'s limits where they are hard ones', () => {
    expect(copy.start.promise.length).toBeLessThanOrEqual(70);
    for (const { title, panel } of copy.start.how.steps) {
      expect(title.length).toBeLessThanOrEqual(28);
      expect(panel.length).toBeLessThanOrEqual(4);
      for (const line of panel) expect(line.length).toBeLessThanOrEqual(20);
    }
    // Screen readers hear the line as it is shown.
    expect(copy.start.titleA + copy.start.titleJoin + copy.start.titleB).toBe('Recovered photos, sorted by date.');
  });
});

describe('long names (T89): capped by UTF-8 bytes, cut between characters, extension kept', () => {
  const ok = (name: string) => {
    expect(utf8Bytes(name)).toBeLessThanOrEqual(NAME_LIMITS.bytes);
    expect(name.length).toBeLessThanOrEqual(NAME_LIMITS.chars);
    expect(name).toBe(name.normalize('NFC'));
    expect(name).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/); // no half of a surrogate pair
    expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(name))).toBe(name);
  };

  it('counts UTF-8 bytes like TextEncoder', () => {
    for (const t of ['abc', 'é', '日本', '😀', 'e\u0301', '\ud83d']) expect(utf8Bytes(t)).toBe(new TextEncoder().encode(t).length);
  });

  it('short names are unchanged, whatever the script', () => {
    for (const t of ['f0001234.jpg', '家族旅行 2019.JPG', 'Café Noël 😀.png']) expect(safeName(t)).toBe(t);
  });

  it('CJK: 3 bytes a character, so about 48 fit; the extension stays as written', () => {
    const out = safeName(`${'写真'.repeat(120)}.JPG`);
    ok(out);
    expect(out.endsWith('.JPG')).toBe(true);
    expect(out).toBe(`${'写真'.repeat(24)}.JPG`); // 48 × 3 + 4 = 148 bytes
  });

  it('emoji: never splits a surrogate pair or a joined emoji', () => {
    const family = '👨‍👩‍👧'; // one character on screen, 18 bytes
    const out = safeName(`${'😀'.repeat(100)}${family.repeat(10)}.heic`);
    ok(out);
    expect(out.endsWith('.heic')).toBe(true);
    expect(out).toBe(`${'😀'.repeat(36)}.heic`); // 36 × 4 + 5 = 149 bytes
    const fam = safeName(`${family.repeat(20)}.jpg`);
    ok(fam);
    expect(fam).toBe(`${family.repeat(8)}.jpg`); // 8 × 18 + 4 = 148
  });

  it('combining characters stay with their letter', () => {
    // NFC has no single character for "x" + combining acute, so each is a 3-byte pair that must not be split.
    const out = safeName(`${'x\u0301'.repeat(100)}.jpg`);
    ok(out);
    expect(out).toBe(`${'x\u0301'.repeat(48)}.jpg`); // 48 × 3 + 4 = 148
    expect(safeName(`${'e\u0301'.repeat(200)}.jpg`)).toBe(`${'é'.repeat(72)}.jpg`); // NFC first: 2 bytes each
  });

  it('no extension, or one too long to count: the whole name is cut, with no trailing dot or space', () => {
    ok(safeName('a'.repeat(400)));
    expect(safeName('a'.repeat(400))).toHaveLength(119);
    const dotty = safeName(`${'ab. '.repeat(60)}notanextension`);
    ok(dotty);
    expect(dotty).not.toMatch(/[. ]$/);
  });

  it('Windows device names get a "_", in every form Windows reads them', () => {
    for (const t of ['CON .jpg', 'con  .txt', 'COM0.jpg', 'COM¹.jpg', 'com².png', 'LPT³', 'lpt9.x', 'CONIN$', 'conout$.log', 'AUX', 'nul.tar.gz']) {
      expect(safeName(t)).toBe(`_${t.replace(/[. ]+$/, '')}`);
    }
    for (const t of ['CONSOLE.jpg', 'com10.jpg', 'lpt.jpg', 'CONIN.jpg', 'conout$x.jpg', 'Auxiliary.png']) expect(safeName(t)).toBe(t);
  });

  it('lone surrogates become "_", so names are always valid UTF-8; two such names still get their own', () => {
    const a = safeName('a\ud800b.jpg');
    expect(a).toBe('a_b.jpg');
    ok(a);
    expect(safeName('x\udc00.jpg')).toBe('x_.jpg');
    expect(safeName('😀\ud83d.jpg')).toBe('😀_.jpg'); // a real pair is kept
    const plan = planNames([rec(undefined, 'r/a\ud800.jpg'), rec(undefined, 'r/a\udfff.jpg'), rec(undefined, 'r/a_.jpg')]);
    expect(plan.map((p) => p.name).sort()).toEqual(['a_ (2).jpg', 'a_ (3).jpg', 'a_.jpg']);
  });

  it('a reserved name still gets its "_" and stays in the limits', () => {
    const out = safeName(`con.${'x'.repeat(300)}`);
    expect(out.startsWith('_con.')).toBe(true);
    ok(out);
  });

  it('the full path stays under 160 characters, even with " (12)" added', () => {
    const plan = planNames(Array.from({ length: 12 }, () => rec(undefined, `recup_dir.1/${'ü'.repeat(300)}.jpg`)));
    for (const p of plan) expect(zipPath(p).length).toBeLessThan(160);
    expect(plan[11].name.endsWith(' (12).jpg')).toBe(true);
  });

  it('names that become the same once cut still get their own (no collisions)', () => {
    const long = (tail: string) => `recup_dir.1/${'長い名前'.repeat(40)}${tail}.jpg`;
    const plan = planNames([rec(undefined, long('A')), rec(undefined, long('B')), rec(undefined, long('a'))]);
    const names = plan.map((p) => p.name);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(3);
    expect(names[1]).toBe(names[0].replace(/\.jpg$/, ' (2).jpg'));
    for (const n of names) expect(utf8Bytes(n)).toBeLessThan(255);
  });
});

describe('name collisions', () => {
  it('same minute: " (2)", " (3)"; case-insensitive; per folder', () => {
    const b = new NameBook();
    expect(b.claim('2024/06 June', '2024-06-28 14.32', 'jpg')).toBe('2024-06-28 14.32.jpg');
    expect(b.claim('2024/06 June', '2024-06-28 14.32', 'jpg')).toBe('2024-06-28 14.32 (2).jpg');
    expect(b.claim('2024/06 June', '2024-06-28 14.32', 'jpg')).toBe('2024-06-28 14.32 (3).jpg');
    expect(b.claim('2024/06 June', '2024-06-28 14.32', 'mov')).toBe('2024-06-28 14.32.mov');
    expect(b.claim('2024/07 July', '2024-06-28 14.32', 'jpg')).toBe('2024-06-28 14.32.jpg');
    expect(b.claim('No date', 'README', '')).toBe('README');
    expect(b.claim('No date', 'readme', '')).toBe('readme (2)');
  });

  it('what is already in the folder is never reused (so never overwritten)', () => {
    const b = new NameBook();
    b.seed('2024/06 June', ['2024-06-28 14.32.JPG', '2024-06-28 14.32 (2).jpg', 'notes.txt']);
    expect(b.isSeeded('2024/06 June')).toBe(true);
    expect(b.claim('2024/06 June', '2024-06-28 14.32', 'jpg')).toBe('2024-06-28 14.32 (3).jpg');
  });

  it('a burst is numbered in the order it was taken, and every file gets its own name', () => {
    const later = rec('2024-06-28T14:32:50', 'recup_dir.1/f1.jpg');
    const earlier = rec('2024-06-28T14:32:05', 'recup_dir.1/f2.jpg');
    const other = rec(undefined, 'recup_dir.2/f1.jpg');
    const same = rec(undefined, 'recup_dir.1/f1.jpg');
    const plan = planNames([later, other, earlier, same]);
    expect(plan.map((p) => [p.id, zipPath(p)])).toEqual([
      [earlier.index, 'Upsort photos/2024/06 June/2024-06-28 14.32.jpg'],
      [later.index, 'Upsort photos/2024/06 June/2024-06-28 14.32 (2).jpg'],
      [same.index, 'Upsort photos/No date/f1.jpg'],
      [other.index, 'Upsort photos/No date/f1 (2).jpg'],
    ]);
  });

  it('40,000 files in a few busy minutes: no two share a path', () => {
    const files = Array.from({ length: 40_000 }, (_, k) => rec(k % 9 === 0 ? undefined : `2023-0${(k % 3) + 1}-0${(k % 5) + 1}T10:0${k % 4}:00`, `recup_dir.${k % 7}/f${k % 1000}.jpg`));
    const paths = planNames(files).map((p) => zipPath(p).toLowerCase());
    expect(new Set(paths).size).toBe(files.length);
  });

  it('save order: oldest first, then "No date" by path', () => {
    const a = rec('2024-01-01T00:00:00', 'z');
    const b = rec('2020-01-01T00:00:00', 'y');
    const c = rec(undefined, 'b');
    const d = rec(undefined, 'a');
    expect(orderForSave([c, a, d, b])).toEqual([b, a, d, c]);
  });
});

describe('zip parts', () => {
  const lim = { maxBytes: 1000, maxEntries: 3 };
  it('fills each part up to the limit, in order', () => {
    expect(splitParts([400, 400, 400, 100, 100], (x) => x, 0, lim)).toEqual([[400, 400], [400, 100, 100]]);
  });
  it('counts the fixed end record', () => {
    expect(splitParts([500, 500], (x) => x, 1, lim)).toEqual([[500], [500]]);
  });
  it('a file bigger than the limit gets a part to itself', () => {
    expect(splitParts([100, 5000, 100], (x) => x, 0, lim)).toEqual([[100], [5000], [100]]);
  });
  it('caps entries per part so the count never needs ZIP64', () => {
    expect(splitParts([1, 1, 1, 1, 1, 1, 1], (x) => x, 0, lim)).toEqual([[1, 1, 1], [1, 1, 1], [1]]);
    expect(ZIP_LIMITS.maxEntries).toBeLessThan(0xffff);
  });
  it('9.8 GB of 4.4 MB photos is 5 parts, each under 2 GB', () => {
    const plan = planNames(Array.from({ length: 2224 }, (_, k) => rec(`2024-06-${String((k % 28) + 1).padStart(2, '0')}T10:00:00`, undefined, 'jpeg', 4_400_000)));
    const parts = splitParts(plan, (p) => entryCost(zipPath(p), p.size), END_COST);
    expect(parts).toHaveLength(5);
    for (const part of parts) expect(part.reduce((s, p) => s + entryCost(zipPath(p), p.size), END_COST)).toBeLessThan(2_000_000_000);
    expect(parts.flat()).toHaveLength(2224);
  });
});

describe('receipt', () => {
  it('"6 years, 41 months, plus No date (312)"', () => {
    const plan = planNames([rec('2024-06-01T00:00:00'), rec('2024-05-01T00:00:00'), rec('2019-05-01T00:00:00'), rec(undefined), rec(undefined)]);
    const s = sortedInto(plan);
    expect(s).toEqual({ years: 2, months: 3, noDate: 2 });
    expect(copy.save.rSortedValue(s.years, s.months, s.noDate)).toBe('2 years, 3 months, plus No date (2)');
    expect(copy.save.rSortedValue(1, 1, 0)).toBe('1 year, 1 month');
    expect(copy.save.rSortedValue(0, 0, 4)).toBe('No date (4)');
  });

  it('only promises "under 2 GB" when no single file is over 2 GB, and says where zips are', () => {
    expect(copy.save.zipBody(3, true, 1)).toContain('come as a zip file, under 2 GB.');
    expect(copy.save.zipBody(3, true, 1, true)).toContain('come as a zip file. They go');
    expect(copy.save.zipBody(30, true, 4, true)).toContain('come as 4 zip files. They go');
    expect(copy.save.browserNote(4)).toMatch(/4 zip files instead, each under 2 GB\.$/);
    expect(copy.save.browserNote(4, true)).toMatch(/4 zip files instead\.$/);
    expect(copy.save.fullBody(1, 3, true, '2 GB', true)).toContain('They’re in zip files in your Downloads folder. None of your files were deleted');
    expect(copy.save.brokenBody(1, 3, true)).toContain('They’re in Upsort photos. None of your files were deleted');
    // T94: the final name, and one folder name behind the folder, the zips and the sentences.
    expect(copy.appName).toBe('Upsort');
    expect(copy.save.rootFolder).toBe('Upsort photos');
    expect(copy.save.zipName).toBe(`${copy.save.rootFolder}.zip`);
    expect(copy.save.zipPart(3)).toBe(`${copy.save.rootFolder} part 3.zip`);
    expect(copy.save.existsNote).toMatch(/^There’s already an Upsort photos folder here/);
    expect(copy.save.rSavedToFolder('Pictures')).toBe('Pictures › Upsort photos');
    expect(copy.save.doneLine).toContain('They’re in Upsort photos,');
    expect(JSON.stringify(copy).split(REPO_URL).join('')).not.toMatch(/keepsake/i); // the old codename only in the repository address
    const L ='In your Downloads folder, look for';
    const parts = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => `Upsort photos part ${a + k}.zip`);
    expect(copy.save.findZip(parts(1, 5))).toEqual({ text: `${L} these 5 zip files: Upsort photos part 1.zip to Upsort photos part 5.zip.` });
    expect(copy.save.findZip(['Upsort photos.zip'])).toEqual({ text: `${L} Upsort photos.zip.` });
  });

  it('zip find text (T89): built from the names; an unbroken run, 2 names in the sentence, 3 or more as a list', () => {
    const L = 'In your Downloads folder, look for';
    expect(copy.save.findZip(['Upsort photos part 4.zip', 'Upsort photos part 5.zip', 'Upsort photos part 6.zip']))
      .toEqual({ text: `${L} these 3 zip files: Upsort photos part 4.zip to Upsort photos part 6.zip.` });
    expect(copy.save.findZip(['Upsort photos.zip', 'Upsort photos part 2.zip']))
      .toEqual({ text: `${L} these 2 zip files: Upsort photos.zip and Upsort photos part 2.zip.` });
    // A gap (a part with no readable file made no zip) is not an unbroken run.
    expect(copy.save.findZip(['Upsort photos part 1.zip', 'Upsort photos part 3.zip', 'Upsort photos part 4.zip']))
      .toEqual({ text: `${L} these 3 zip files:`, list: ['Upsort photos part 1.zip', 'Upsort photos part 3.zip', 'Upsort photos part 4.zip'] });
    expect(copy.save.findZip(['Upsort photos.zip', 'Upsort photos part 2.zip', 'Upsort photos part 3.zip']).list).toHaveLength(3);
    expect(copy.save.findZip([])).toEqual({ text: '' });
    expect(copy.save.findZip(['Upsort photos part 2.zip', 'Upsort photos part 3.zip']))
      .toEqual({ text: `${L} these 2 zip files: Upsort photos part 2.zip and Upsort photos part 3.zip.` });
    expect(copy.save.zipAgain('Upsort photos part 2.zip')).toBe('Download Upsort photos part 2.zip again');
  });

  it('zip names (T89): one name per zip for the whole page; "part N" counts every zip made', () => {
    const log = new ZipLog();
    const v1 = log.newVisit(1);
    expect(log.add(v1, 1, [1, 2])).toBe('Upsort photos.zip'); // first save fits in one zip
    expect(log.add(v1, 1, [3])).toBe('Upsort photos part 2.zip'); // Save the rest
    log.finish(v1);
    const v2 = log.newVisit(1);
    expect(log.add(v2, 1, [1, 2, 3])).toBe('Upsort photos part 3.zip'); // a later save never reuses "Upsort photos.zip"
    const multi = new ZipLog();
    const m = multi.newVisit(1);
    expect([multi.add(m, 3, [1]), multi.add(m, 3, [2]), multi.add(m, 3, [3])])
      .toEqual(['Upsort photos part 1.zip', 'Upsort photos part 2.zip', 'Upsort photos part 3.zip']);
  });

  it('earlier zips (T89): only from saves that did not finish, and whether this save has all of it', () => {
    const log = new ZipLog();
    const done = log.newVisit(1);
    log.add(done, 1, [9]);
    log.finish(done);
    const stopped = log.newVisit(1);
    log.add(stopped, 2, [1, 2]);
    const now = log.newVisit(1);
    log.add(now, 1, [1, 2, 3]);
    expect(log.leftovers(now, new Set([1, 2, 3]))).toEqual({ names: ['Upsort photos part 2.zip'], covered: true });
    expect(log.leftovers(now, new Set([1, 3]))).toEqual({ names: ['Upsort photos part 2.zip'], covered: false });
    expect(log.leftovers(stopped, new Set([1, 2]))).toEqual({ names: [], covered: true }); // its own zips aren't "earlier"
  });

  it('earlier zips (T89): a zip from another scan is never mentioned, and never "covered", even with the same indices', () => {
    const log = new ZipLog();
    const a = log.newVisit(1); // folder A
    expect(log.add(a, 1, [0, 1, 2])).toBe('Upsort photos.zip'); // stopped; indices 0-2 of scan 1
    const b = log.newVisit(2); // folder B: its indices also start at 0
    expect(log.add(b, 1, [0, 1, 2, 3])).toBe('Upsort photos part 2.zip'); // the name counter is page-wide
    expect(log.leftovers(b, new Set([0, 1, 2, 3]))).toEqual({ names: [], covered: true });
    // The same folder scanned again is a new scan too: its indices may point at other files.
    const a2 = log.newVisit(3);
    expect(log.leftovers(a2, new Set([0, 1, 2]))).toEqual({ names: [], covered: true });
    // Back in scan 2, a later visit still sees only scan 2's unfinished zip.
    const b2 = log.newVisit(2);
    expect(log.leftovers(b2, new Set([0, 1, 2]))).toEqual({ names: ['Upsort photos part 2.zip'], covered: false });
    expect(log.leftovers(b2, new Set([0, 1, 2, 3]))).toEqual({ names: ['Upsort photos part 2.zip'], covered: true });
    expect(copy.save.earlierZips(['Upsort photos.zip'], true, 1, true))
      .toBe('Upsort photos.zip is from an earlier save that didn’t finish. Everything in it is also in the zip file above.');
    expect(copy.save.earlierZips(['Upsort photos.zip', 'Upsort photos part 2.zip'], false, 3, true))
      .toBe('Upsort photos.zip and Upsort photos part 2.zip are from an earlier save that didn’t finish. They have some photos and videos that aren’t in this save.');
  });

  it('the text file says the same as the screen, and lists what could not be saved', () => {
    const txt = receiptText({
      when: new Date(2026, 9, 16, 16, 5), saved: 2224, failed: 1, mediaOnly: true, savedTo: 'Pictures › Upsort photos',
      sorted: { years: 6, months: 41, noDate: 312 }, failedPaths: ['recup_dir.4/f0099.jpg'],
    });
    expect(txt).toContain('16 October 2026, 16:05');
    expect(txt).toMatch(/Saved\s+2,224 photos and videos/);
    expect(txt).toMatch(/Couldn’t save\s+1/);
    expect(txt).toMatch(/Saved to\s+Pictures › Upsort photos/);
    expect(txt).toMatch(/Sorted into\s+6 years, 41 months, plus No date \(312\)/);
    expect(txt).toMatch(/Recovery folder\s+Untouched/);
    // T76: the promise in words, no "0 · 0" counter or "upload" wording.
    expect(txt).toMatch(/Your files\s+None deleted, none sent anywhere\n/);
    expect(txt).not.toContain('0 · 0');
    expect(txt).not.toMatch(/upload/i);
    expect(txt).not.toContain('Your files deleted');
    // Rows line up: every value starts in the same column.
    const rows = txt.split('\n').slice(3, 9);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((l) => l.match(/^.*?\S {2,}(?=\S)/)?.[0].length)).size).toBe(1);
    expect(txt).toContain('  recup_dir.4/f0099.jpg');
  });
});

describe('write errors', () => {
  it('maps browser errors to what the screens say', () => {
    expect(classifyWriteError(new DOMException('x', 'QuotaExceededError'))).toBe('full');
    expect(classifyWriteError(new DOMException('x', 'NotAllowedError'))).toBe('denied');
    expect(classifyWriteError(new DOMException('x', 'SecurityError'))).toBe('denied');
    expect(classifyWriteError(new DOMException('x', 'NotFoundError'))).toBe('broken');
    expect(classifyWriteError(new Error('x'))).toBe('broken');
    expect(classifyWriteError(undefined)).toBe('broken');
  });
});

describe('the recovery folder is never a save target', () => {
  // A fake folder tree: handles that know their path and resolve() like the real API.
  const dir = (path: string): ResolvingDir & { path: string } => ({
    path,
    async resolve(d) {
      const p = (d as unknown as { path: string }).path;
      if (p === path) return [];
      return p.startsWith(`${path}/`) ? p.slice(path.length + 1).split('/') : null;
    },
  });
  // Recovery folder /home/me/rec; its files are in rec/recup_dir.1 and rec/recup_dir.2 (depth 1).
  const scanDirs = [{ dir: dir('/home/me/rec/recup_dir.1'), depth: 1 }, { dir: dir('/home/me/rec/recup_dir.2'), depth: 1 }];
  it('refuses the recovery folder, its subfolders and anything inside them', async () => {
    expect(await insideRecovery(dir('/home/me/rec'), scanDirs)).toBe(true);
    expect(await insideRecovery(dir('/home/me/rec/recup_dir.2'), scanDirs)).toBe(true);
    expect(await insideRecovery(dir('/home/me/rec/recup_dir.1/x'), scanDirs)).toBe(true);
  });
  it('allows folders beside it or above it', async () => {
    expect(await insideRecovery(dir('/home/me'), scanDirs)).toBe(false);
    expect(await insideRecovery(dir('/home/me/Pictures'), scanDirs)).toBe(false);
    expect(await insideRecovery(dir('/home/me/rec2'), scanDirs)).toBe(false);
  });
});

describe('CRC-32', () => {
  const ascii = (s: string) => new TextEncoder().encode(s);
  it('matches the standard check values', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(ascii('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
  it('can be fed slice by slice', () => {
    const data = new Uint8Array(100_003).map((_, k) => (k * 31 + 7) & 0xff);
    const whole = crc32(data);
    let c = 0;
    for (let at = 0; at < data.length; at += 4093) c = crc32(data.subarray(at, at + 4093), c);
    expect(c).toBe(whole);
  });
});

describe('DOS dates', () => {
  it('packs local date and time, 2-second steps', () => {
    expect(dosDateTime(2024, 6, 28, 14, 32, 9)).toEqual({ date: (44 << 9) | (6 << 5) | 28, time: (14 << 11) | (32 << 5) | 4 });
    expect(dosDateTime(1970, 1, 1, 0, 0, 0)).toEqual({ date: 33, time: 0 });
    expect(dosFrom('2024-06-28T14:32:09', new Date(0))).toEqual(dosDateTime(2024, 6, 28, 14, 32, 9));
    expect(dosFrom(undefined, new Date(2020, 0, 2, 3, 4, 6))).toEqual(dosDateTime(2020, 1, 2, 3, 4, 6));
  });
});

/** Build a zip in memory the way the app does (header, data, header, data, …, directory). */
function build(entries: { name: string; data: Uint8Array }[], force64 = false) {
  const w = new ZipWriter(force64);
  const chunks: Uint8Array[] = [];
  for (const e of entries) {
    chunks.push(w.add({ name: e.name, size: e.data.length, crc: crc32(e.data), date: dosDateTime(2024, 6, 28, 14, 32, 10) }), e.data);
  }
  chunks.push(w.finish());
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  expect(w.size).toBe(out.length);
  return out;
}

const has = (cmd: string) => { try { execFileSync('sh', ['-c', `command -v ${cmd}`]); return true; } catch { return false; } };

describe('ZIP writer', () => {
  const entries = [
    { name: 'Upsort photos/2024/06 June/2024-06-28 14.32.jpg', data: new Uint8Array(5000).map((_, k) => k & 0xff) },
    { name: 'Upsort photos/2024/06 June/2024-06-28 14.32 (2).jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
    { name: 'Upsort photos/No date/f0001234 café.jpg', data: new Uint8Array(0) },
  ];

  it('writes the local header byte for byte', () => {
    const w = new ZipWriter();
    const h = w.add({ name: 'a.jpg', size: 3, crc: 0x12345678, date: { date: 0x58dc, time: 0x7404 } });
    expect([...h]).toEqual([
      0x50, 0x4b, 0x03, 0x04, 20, 0, 0x00, 0x08, 0, 0, 0x04, 0x74, 0xdc, 0x58,
      0x78, 0x56, 0x34, 0x12, 3, 0, 0, 0, 3, 0, 0, 0, 5, 0, 0, 0, 0x61, 0x2e, 0x6a, 0x70, 0x67,
    ]);
  });

  it('entryCost and END_COST predict the size exactly (no ZIP64) and never under-count (ZIP64)', () => {
    const plain = build(entries);
    expect(plain.length).toBe(entries.reduce((s, e) => s + entryCost(e.name, e.data.length), 22));
    const forced = build(entries, true);
    expect(forced.length).toBeLessThanOrEqual(entries.reduce((s, e) => s + entryCost(e.name, e.data.length, true), END_COST));
  });

  for (const force64 of [false, true]) {
    it(`unzip and Python read it back${force64 ? ' with ZIP64 fields' : ''}`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'keepsake-zip-'));
      try {
        const file = join(dir, 'test.zip');
        writeFileSync(file, build(entries, force64));
        if (has('unzip')) {
          const out = execFileSync('unzip', ['-t', file]).toString();
          expect(out).toMatch(/No errors detected/);
        }
        if (has('python3')) {
          const py = 'import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nfor i in z.infolist(): print(i.filename, i.file_size, i.date_time[:5])';
          const out = execFileSync('python3', ['-I', '-c', py, file]).toString().trim().split('\n');
          expect(out).toEqual(entries.map((e) => `${e.name} ${e.data.length} (2024, 6, 28, 14, 32)`));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it('a 5 GB video gets ZIP64 sizes, and the zip ends with ZIP64 end records', () => {
    const size = 5_000_000_000;
    const w = new ZipWriter();
    const h = w.add({ name: 'v.mov', size, crc: 1, date: { date: 33, time: 0 } });
    const v = new DataView(h.buffer);
    expect(v.getUint16(4, true)).toBe(45);
    expect(v.getUint32(18, true)).toBe(0xffffffff);
    expect(v.getUint32(22, true)).toBe(0xffffffff);
    expect(v.getUint16(28, true)).toBe(20); // extra length
    expect(v.getUint16(35, true)).toBe(1); // ZIP64 extra id after the 5-byte name
    expect(Number(v.getBigUint64(39, true))).toBe(size);
    expect(Number(v.getBigUint64(47, true))).toBe(size);
    const end = w.finish();
    const e = new DataView(end.buffer);
    const cdLen = 46 + 5 + 20;
    expect(e.getUint32(0, true)).toBe(0x02014b50);
    expect(Number(e.getBigUint64(46 + 5 + 4, true))).toBe(size);
    expect(e.getUint32(cdLen, true)).toBe(0x06064b50);
    expect(Number(e.getBigUint64(cdLen + 48, true))).toBe(h.length + size); // directory offset
    expect(e.getUint32(cdLen + 56, true)).toBe(0x07064b50);
    expect(Number(e.getBigUint64(cdLen + 56 + 8, true))).toBe(h.length + size + cdLen);
    expect(e.getUint32(cdLen + 76, true)).toBe(0x06054b50);
    expect(e.getUint32(cdLen + 76 + 16, true)).toBe(0xffffffff);
    expect(end.length).toBe(cdLen + 76 + 22);
  });
});
