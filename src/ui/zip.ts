// A minimal store-only ZIP writer (T25). Photos and videos are already compressed, so files are
// stored as they are: the zip is just small headers around the original bytes. That means a zip
// can be built as a Blob of [header, File, header, File, …, directory] without ever copying a
// photo into memory; only the CRC-32 needs the bytes, read in slices (in a worker, see
// save.worker.ts). ZIP64 fields are written only when a size or offset needs them (a file of
// 4 GiB or more). Spec: PKWARE APPNOTE.TXT 6.3.10, sections 4.3.7 to 4.3.16 and 4.5.3.
//
// Pure and framework-free, so it can be tested in Node.

// ---- CRC-32 (IEEE 802.3, the one zip uses), slicing-by-8 -------------------------------------
const T = (() => {
  const t = new Uint32Array(8 * 256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  for (let n = 0; n < 256; n++) {
    let c = t[n];
    for (let k = 1; k < 8; k++) {
      c = t[c & 0xff] ^ (c >>> 8);
      t[k * 256 + n] = c >>> 0;
    }
  }
  return t;
})();

/** CRC-32 of `data`, continuing from `crc` (0 to start). Feed a file slice by slice. */
export function crc32(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  let i = 0;
  const n = data.length;
  for (; i + 8 <= n; i += 8) {
    const a = (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) ^ c;
    const b = data[i + 4] | (data[i + 5] << 8) | (data[i + 6] << 16) | (data[i + 7] << 24);
    c = T[1792 + (a & 0xff)] ^ T[1536 + ((a >>> 8) & 0xff)] ^ T[1280 + ((a >>> 16) & 0xff)] ^ T[1024 + (a >>> 24)]
      ^ T[768 + (b & 0xff)] ^ T[512 + ((b >>> 8) & 0xff)] ^ T[256 + ((b >>> 16) & 0xff)] ^ T[b >>> 24];
  }
  for (; i < n; i++) c = T[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// ---- Dates -----------------------------------------------------------------------------------
/** MS-DOS date and time (local, 2-second steps, 1980 to 2107). */
export type DosDateTime = { date: number; time: number };
export function dosDateTime(y: number, mo: number, d: number, h: number, mi: number, s: number): DosDateTime {
  if (y < 1980) return { date: (1 << 5) | 1, time: 0 }; // 1980-01-01 00:00
  if (y > 2107) y = 2107;
  return { date: ((y - 1980) << 9) | (mo << 5) | d, time: (h << 11) | (mi << 5) | (s >> 1) };
}
/** From 'YYYY-MM-DDTHH:mm:ss' as written, or else a Date's local time. */
export function dosFrom(takenAt: string | undefined, fallback: Date): DosDateTime {
  const m = takenAt && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(takenAt);
  if (m) return dosDateTime(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const f = fallback;
  return dosDateTime(f.getFullYear(), f.getMonth() + 1, f.getDate(), f.getHours(), f.getMinutes(), f.getSeconds());
}

// ---- Records ---------------------------------------------------------------------------------
const MAX32 = 0xffffffff;
const MAX16 = 0xffff;
const enc = new TextEncoder();
const FLAG_UTF8 = 0x0800;
const MADE_BY = (3 << 8) | 45; // Unix, spec 4.5, so unzip gives files ordinary permissions
const ATTR_FILE = (0o100644 << 16) >>> 0;

class Out {
  private b: Uint8Array<ArrayBuffer>;
  private v: DataView;
  private p = 0;
  constructor(size: number) {
    this.b = new Uint8Array(size);
    this.v = new DataView(this.b.buffer);
  }
  u16(x: number) { this.v.setUint16(this.p, x, true); this.p += 2; return this; }
  u32(x: number) { this.v.setUint32(this.p, x >>> 0, true); this.p += 4; return this; }
  u64(x: number) { this.v.setBigUint64(this.p, BigInt(x), true); this.p += 8; return this; }
  bytes(x: Uint8Array) { this.b.set(x, this.p); this.p += x.length; return this; }
  done(): Uint8Array<ArrayBuffer> {
    if (this.p !== this.b.length) throw new Error(`zip: wrote ${this.p} of ${this.b.length} bytes`);
    return this.b;
  }
}

export type ZipEntry = {
  /** Path inside the zip, '/'-separated. */
  name: string;
  size: number;
  crc: number;
  date: DosDateTime;
};

type Written = { name: Uint8Array; size: number; crc: number; date: DosDateTime; offset: number; zip64: boolean };

const needs64 = (size: number, force: boolean) => force || size >= MAX32;

/** Bytes an entry adds to a zip (local header + data + central record), for splitting into parts. */
export function entryCost(name: string, size: number, force = false): number {
  const n = enc.encode(name).length;
  const z = needs64(size, force);
  // The central record may also carry a 64-bit offset (+8): counted always when ZIP64 is in play.
  return 30 + n + (z ? 20 : 0) + size + 46 + n + (z ? 28 : 0);
}
/** Bytes every zip ends with, counting the ZIP64 end records in case they're needed. */
export const END_COST = 22 + 56 + 20;

/**
 * Builds one zip. For each file, `add()` returns its local header; put the file's own bytes
 * right after it. `finish()` returns the central directory and end records.
 */
export class ZipWriter {
  private entries: Written[] = [];
  private offset = 0;
  private force64: boolean;
  /** @param force64 write ZIP64 fields even when they're not needed (tests only) */
  constructor(force64 = false) {
    this.force64 = force64;
  }

  get size(): number {
    return this.offset;
  }
  get count(): number {
    return this.entries.length;
  }

  add(e: ZipEntry): Uint8Array<ArrayBuffer> {
    const name = enc.encode(e.name);
    if (name.length > MAX16) throw new Error('zip: name too long');
    const zip64 = needs64(e.size, this.force64);
    const w: Written = { name, size: e.size, crc: e.crc >>> 0, date: e.date, offset: this.offset, zip64 };
    const out = new Out(30 + name.length + (zip64 ? 20 : 0))
      .u32(0x04034b50)
      .u16(zip64 ? 45 : 20) // version needed
      .u16(FLAG_UTF8)
      .u16(0) // stored
      .u16(e.date.time).u16(e.date.date)
      .u32(w.crc)
      .u32(zip64 ? MAX32 : e.size) // compressed size
      .u32(zip64 ? MAX32 : e.size) // uncompressed size
      .u16(name.length)
      .u16(zip64 ? 20 : 0)
      .bytes(name);
    if (zip64) out.u16(0x0001).u16(16).u64(e.size).u64(e.size); // original, then compressed
    const header = out.done();
    this.entries.push(w);
    this.offset += header.length + e.size;
    return header;
  }

  finish(): Uint8Array<ArrayBuffer> {
    const cdStart = this.offset;
    const records: Uint8Array[] = [];
    for (const w of this.entries) {
      const bigSize = w.zip64;
      const bigOffset = this.force64 || w.offset >= MAX32;
      const extraLen = bigSize || bigOffset ? 4 + (bigSize ? 16 : 0) + (bigOffset ? 8 : 0) : 0;
      const out = new Out(46 + w.name.length + extraLen)
        .u32(0x02014b50)
        .u16(MADE_BY)
        .u16(extraLen ? 45 : 20)
        .u16(FLAG_UTF8)
        .u16(0)
        .u16(w.date.time).u16(w.date.date)
        .u32(w.crc)
        .u32(bigSize ? MAX32 : w.size)
        .u32(bigSize ? MAX32 : w.size)
        .u16(w.name.length)
        .u16(extraLen)
        .u16(0) // comment
        .u16(0) // disk
        .u16(0) // internal attributes
        .u32(ATTR_FILE)
        .u32(bigOffset ? MAX32 : w.offset)
        .bytes(w.name);
      if (extraLen) {
        out.u16(0x0001).u16(extraLen - 4);
        if (bigSize) out.u64(w.size).u64(w.size);
        if (bigOffset) out.u64(w.offset);
      }
      records.push(out.done());
    }
    const cdSize = records.reduce((s, r) => s + r.length, 0);
    const count = this.entries.length;
    const big = this.force64 || count >= MAX16 || cdSize >= MAX32 || cdStart >= MAX32;
    const tail: Uint8Array[] = [];
    if (big) {
      const z64At = cdStart + cdSize;
      tail.push(new Out(56)
        .u32(0x06064b50).u64(44) // size of the rest of this record
        .u16(MADE_BY).u16(45)
        .u32(0).u32(0) // this disk, disk with the directory
        .u64(count).u64(count)
        .u64(cdSize).u64(cdStart)
        .done());
      tail.push(new Out(20).u32(0x07064b50).u32(0).u64(z64At).u32(1).done());
    }
    tail.push(new Out(22)
      .u32(0x06054b50)
      .u16(0).u16(0)
      .u16(count >= MAX16 ? MAX16 : count).u16(count >= MAX16 ? MAX16 : count)
      .u32(cdSize >= MAX32 ? MAX32 : cdSize)
      .u32(cdStart >= MAX32 ? MAX32 : cdStart)
      .u16(0)
      .done());
    const all = [...records, ...tail];
    const out = new Uint8Array(all.reduce((s, r) => s + r.length, 0));
    let p = 0;
    for (const r of all) { out.set(r, p); p += r.length; }
    this.offset += out.length;
    return out;
  }
}
