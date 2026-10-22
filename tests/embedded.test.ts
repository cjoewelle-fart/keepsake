import { describe, expect, it } from 'vitest';
import { canDownload, canUseFolderPicker, inFrame, inSandbox } from '../src/ui/embedded';
import { canSaveToFolder } from '../src/ui/saveRun';

// Window-like objects: a top-level page, a frame, and a sandboxed frame (refuses document.domain).
const move = { FileSystemFileHandle: { prototype: { move() {} } } };
const topLevel = () => { const w: Record<string, unknown> = { showDirectoryPicker() {}, ...move, document: { domain: 'localhost' } }; w.self = w; w.top = w; return w; };
const frame = () => ({ ...topLevel(), self: {}, top: {} });
const sandboxed = () => {
  const doc = { get domain() { return 'localhost'; }, set domain(_v: string) { throw new DOMException('Assignment is forbidden for sandboxed iframes.', 'SecurityError'); } };
  return { ...frame(), document: doc };
};
/** A cross-origin parent: even reading `top` can throw in some browsers. */
const hostile = () => ({ get self() { return {}; }, get top(): unknown { throw new DOMException('blocked', 'SecurityError'); } });

describe('where the page runs (claude.ai preview)', () => {
  it('tells a frame from a top-level page', () => {
    expect(inFrame(topLevel())).toBe(false);
    expect(inFrame(frame())).toBe(true);
    expect(inFrame(hostile())).toBe(true);
    expect(inFrame(undefined)).toBe(false);
    expect(inFrame({})).toBe(false); // Node-like: no self/top
  });

  it('uses the folder picker only at the top level', () => {
    expect(canUseFolderPicker(topLevel())).toBe(true);
    expect(canUseFolderPicker(frame())).toBe(false);
    const { showDirectoryPicker: _, ...noPicker } = topLevel();
    expect(canUseFolderPicker(noPicker)).toBe(false);
  });

  it('never saves into a folder from a frame', () => {
    expect(canSaveToFolder(topLevel())).toBe(true);
    expect(canSaveToFolder(frame())).toBe(false);
    expect(canSaveToFolder(sandboxed())).toBe(false);
  });

  it('treats a sandboxed frame as unable to download, and nothing else', () => {
    expect(inSandbox(sandboxed())).toBe(true);
    expect(canDownload(sandboxed())).toBe(false);
    expect(inSandbox(frame())).toBe(false);
    expect(canDownload(frame())).toBe(true);
    // Not even probed at the top level.
    let probed = false;
    const w = topLevel();
    w.document = { get domain() { return 'x'; }, set domain(_v: string) { probed = true; } };
    expect(canDownload(w)).toBe(true);
    expect(probed).toBe(false);
  });

  it('a sandboxed frame offers no way to save at all', () => {
    const w = sandboxed();
    expect(!canSaveToFolder(w) && !canDownload(w)).toBe(true);
  });
});
