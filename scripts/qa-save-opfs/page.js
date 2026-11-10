// Runs inside Chromium (secure origin) against OPFS.
window.runProbes = async () => {
  const out = {};
  const log = (k, v) => { out[k] = v; };
  const root = await navigator.storage.getDirectory();
  for await (const n of root.keys()) await root.removeEntry(n, { recursive: true });
  const mk = async (d, path) => { for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: true }); return d; };
  const put = async (d, name, bytes) => { const fh = await d.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(bytes); await w.close(); return fh; };
  const read = async (d, name) => new Uint8Array(await (await (await d.getFileHandle(name)).getFile()).arrayBuffer());
  const list = async (d, pre = '') => { const r = []; for await (const [n, h] of d.entries()) { if (h.kind === 'directory') r.push(...await list(h, pre + n + '/')); else r.push(pre + n + ':' + (await h.getFile()).size); } return r.sort(); };

  // ---- A. API semantics ----
  const a = await mk(root, 'api');
  await put(a, 'theirs.jpg', new Uint8Array([1, 2, 3]));
  const again = await a.getFileHandle('theirs.jpg', { create: true });
  log('A1 getFileHandle(create) on existing returns existing size', (await again.getFile()).size);
  const t = await put(a, 'tmp.tmp', new Uint8Array([7, 7]));
  let mv;
  try { await t.move('theirs.jpg'); mv = 'moved'; } catch (e) { mv = 'threw ' + e.name; }
  log('A2 move() onto existing file', mv + '; theirs.jpg now = [' + (await read(a, 'theirs.jpg')).join(',') + ']');
  await a.getDirectoryHandle('adir', { create: true });
  const t2 = await put(a, 'tmp2.tmp', new Uint8Array([5]));
  try { await t2.move('adir'); mv = 'moved'; } catch (e) { mv = 'threw ' + e.name; }
  log('A3 move() onto existing folder', mv);
  const w = await (await a.getFileHandle('open.bin', { create: true })).createWritable();
  await w.write(new Uint8Array(1000));
  log('A4 size while writable open (swap file)', (await (await a.getFileHandle('open.bin')).getFile()).size);
  await w.abort();
  log('A4b size after abort', (await (await a.getFileHandle('open.bin')).getFile()).size);
  const h = await put(a, 'pathy.bin', new Uint8Array(0));
  await a.removeEntry('pathy.bin');
  await put(a, 'pathy.bin', new Uint8Array(0));
  try { await h.remove(); } catch (e) { log('A5err', e.name); }
  let still; try { await a.getFileHandle('pathy.bin'); still = true; } catch { still = false; }
  log('A5 stale handle.remove() removed a different file now at that path', !still);
  log('A6 move supported', typeof h.move === 'function');

  // ---- B. inRecoveryFolder / insideRecovery with real handles ----
  const home = await mk(root, 'home');
  const rec = await mk(home, 'rec');
  const files = [];
  for (let k = 1; k <= 305; k++) { const d = await rec.getDirectoryHandle(`recup_dir.${k}`, { create: true }); files.push({ directoryHandle: d, webkitRelativePath: `rec/recup_dir.${k}/f${k}.jpg` }); }
  const empty = await mk(rec, 'empty');
  const deep5 = await mk(rec, 'a/b/c/d/e');
  const d1 = await rec.getDirectoryHandle('recup_dir.1');
  const d300 = await rec.getDirectoryHandle('recup_dir.300');
  const sib = await mk(home, 'rec2');
  const pics = await mk(home, 'Pictures');
  const recInKp = await mk(pics, 'Upsort photos/old-rec');
  const recInOther = await mk(pics, 'other/rec3');
  const usb = await mk(root, 'usb');
  const cases = { 'same': rec, 'depth1 recup_dir.1': d1, 'depth1 recup_dir.300': d300, 'depth5 a/b/c/d/e': deep5, 'empty subfolder': empty,
    'parent home (contains rec)': home, 'OPFS root (contains rec)': root, 'sibling rec2': sib, 'Pictures': pics, 'usb': usb };
  const B = {};
  const fb = window.K.scanFolders(files);
  for (const [n, c] of Object.entries(cases)) {
    B[n] = { withHandle: await window.K.inRecoveryFolder(rec, c), fallback: await window.K.insideRecovery(c, fb).catch(() => 'threw->true') };
  }
  B['rec inside Pictures/Upsort photos, chosen=Pictures'] = { withHandle: await window.K.inRecoveryFolder(recInKp, pics) };
  B['rec inside Pictures/other, chosen=Pictures'] = { withHandle: await window.K.inRecoveryFolder(recInOther, pics) };
  // Fallback with files that DO carry handles, chosen = Pictures, recovery inside Pictures/Upsort photos
  const kpFiles = [{ directoryHandle: recInKp, webkitRelativePath: 'old-rec/f.jpg' }];
  B['fallback: rec inside Pictures/Upsort photos, chosen=Pictures'] = { fallback: await window.K.insideRecovery(pics, window.K.scanFolders(kpFiles)) };
  B['fallback: no directoryHandle on files (file input)'] = { fallback: await window.K.insideRecovery(rec, window.K.scanFolders([{ webkitRelativePath: 'rec/recup_dir.1/f.jpg' }])) };
  // A removed/stale recovery handle
  const gone = await mk(root, 'gone');
  await root.removeEntry('gone', { recursive: true });
  B['recovery handle whose folder was removed, chosen=usb'] = { withHandle: await window.K.inRecoveryFolder(gone, usb) };
  // Renamed recovery folder: the kept handle vs the folder under its new name
  const r2 = await mk(root, 'renameme'); await mk(r2, 'recup_dir.1');
  let renamed = 'n/a';
  try { await r2.move('renamed'); const nh = await root.getDirectoryHandle('renamed'); renamed = { sameAfterRename_withKeptHandle: await window.K.inRecoveryFolder(r2, nh), subAfterRename: await window.K.inRecoveryFolder(r2, await nh.getDirectoryHandle('recup_dir.1')) }; } catch (e) { renamed = 'dir move threw ' + e.name; }
  B['renamed recovery folder'] = renamed;
  out.B = B;
  return out;
};

window.runSave = async (scenario) => {
  const K = window.K;
  const root = await navigator.storage.getDirectory();
  for await (const n of root.keys()) await root.removeEntry(n, { recursive: true });
  const chosen = await root.getDirectoryHandle('chosen', { create: true });
  // Pre-existing content that must never change
  let d = chosen; for (const p of ['Upsort photos', '2024', '06 June']) d = await d.getDirectoryHandle(p, { create: true });
  const put = async (dd, name, bytes) => { const fh = await dd.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(bytes); await w.close(); };
  await put(d, '2024-06-28 14.32.jpg', new Uint8Array([1, 1, 1]));
  await put(d, 'empty-theirs.jpg', new Uint8Array(0));
  const list = async (dd, pre = '') => { const r = []; for await (const [n, h] of dd.entries()) { if (h.kind === 'directory') r.push(...await list(h, pre + n + '/')); else r.push(pre + n + ':' + (await h.getFile()).size); } return r.sort(); };
  const MB = 1024 * 1024;
  const mkFile = (n, seed) => new File([new Uint8Array(n).map((_, k) => (k + seed) & 255)], 'f.jpg');
  const rec = (k) => ({ index: k, path: `recup_dir.1/f${k}.jpg`, size: 0, kind: 'jpeg', takenAt: `2024-06-28T14:32:0${k}`, group: 'keep', reason: 'photo' });
  const items = [0, 1, 2].map((k) => ({ r: rec(k), file: mkFile(1000 + k, k) }));
  const saved = [], failed = [];
  let stop = false;
  const ev = { onSaved: (i) => saved.push(i), onFailed: (i) => failed.push(i), shouldStop: () => stop };
  const P = FileSystemFileHandle.prototype;
  const origMove = P.move, origCW = P.createWritable;
  let moves = 0;
  try {
    if (scenario === 'race-at-move') {
      // Another program creates the exact target name in the instant between Save's check and its move().
      P.move = async function (name) { moves++; if (!name.startsWith('.keepsake-partial-') && name.includes('(2)')) await put(d, name, new Uint8Array([9, 9])); return origMove.call(this, name); };
    } else if (scenario === 'stop-mid-file') {
      items[1].file = mkFile(8 * MB * 2 + 5, 1);
      P.createWritable = async function (o) { const w = await origCW.call(this, o); const ww = w.write.bind(w); let n = 0; w.write = async (x) => { await ww(x); if (++n === 1 && saved.length === 1) stop = true; }; return w; };
    } else if (scenario === 'read-error-mid-file') {
      class Fails extends File { slice(s, e) { if ((e ?? this.size) > 8 * MB) return { arrayBuffer: () => Promise.reject(new DOMException('x', 'NotReadableError')) }; return super.slice(s, e); } }
      items[1].file = new Fails([new Uint8Array(8 * MB * 2)], 'bad.jpg');
    } else if (scenario === 'move-unsupported') {
      P.move = async function () { throw new DOMException('no', 'NotSupportedError'); };
    } else if (scenario === 'move-fails-after-write') {
      P.move = async function (name) { moves++; if (!name.startsWith('.keepsake-partial-') && moves >= 3) throw new DOMException('disk went away', 'InvalidStateError'); return origMove.call(this, name); };
    } else if (scenario === 'move-quota-after-write') {
      P.move = async function (name) { moves++; if (!name.startsWith('.keepsake-partial-') && moves >= 3) throw new DOMException('full', 'QuotaExceededError'); return origMove.call(this, name); };
    } else if (scenario === 'no-move-race-create') {
      // No move(): another program creates the planned name between Save's exists() check and its create.
      delete P.move; // will be restored below
      Object.defineProperty(P, 'move', { value: undefined, configurable: true, writable: true });
      const DP = FileSystemDirectoryHandle.prototype; const og = DP.getFileHandle;
      DP.getFileHandle = async function (name, o) { if (o?.create && name === '2024-06-28 14.32 (2).jpg') { await og.call(this, name, { create: true }).then(async (fh) => { const w = await fh.createWritable(); await w.write(new Uint8Array([4, 4, 4, 4])); await w.close(); }); } return og.call(this, name, o); };
      window.__restoreDP = () => { DP.getFileHandle = og; };
    } else if (scenario === 'no-move-race-create-then-stop') {
      Object.defineProperty(P, 'move', { value: undefined, configurable: true, writable: true });
      const DP = FileSystemDirectoryHandle.prototype; const og = DP.getFileHandle;
      // Another program makes an EMPTY file at the planned name just before Save creates it; then the person presses Stop mid-file.
      DP.getFileHandle = async function (name, o) { if (o?.create && name === '2024-06-28 14.32 (2).jpg') await og.call(this, name, { create: true }); return og.call(this, name, o); };
      window.__restoreDP = () => { DP.getFileHandle = og; };
      items[0].file = mkFile(8 * MB * 2 + 5, 0);
      items.splice(1); items[0].r = rec(0);
      // Make (2) the planned name by pre-occupying the base name (already exists) -> first free is (2)
      P.createWritable = async function (o) { const w = await origCW.call(this, o); const ww = w.write.bind(w); w.write = async (x) => { await ww(x); stop = true; }; return w; };
    }
    const session = K.newFolderSession(chosen);
    const end = await K.saveToFolder(session, items, ev);
    return { end, saved, failed, canMove: session.canMove, after: await list(chosen) };
  } finally {
    Object.defineProperty(P, 'move', { value: origMove, configurable: true, writable: true });
    P.createWritable = origCW;
    window.__restoreDP?.(); window.__restoreDP = undefined;
  }
};
