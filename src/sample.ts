// Example files for previews and demos (enabled with VITE_SAMPLES=1).
// The pack is a real PhotoRec output from a wiped test SD card, published next to the page.
// Format: 4-byte big-endian index length, JSON index [{ path, size }], then file bytes in order.

export const SAMPLES_ENABLED = import.meta.env.VITE_SAMPLES === '1';

export async function loadSamples(): Promise<{ files: File[]; paths: string[] }> {
  // Raw bytes; .wasm is only used because it's a binary type the preview host serves.
  const res = await fetch('./sample-pack.wasm');
  if (!res.ok) throw new Error(`sample pack: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const len = new DataView(buf.buffer).getUint32(0);
  const index: { path: string; size: number }[] = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len)));
  let at = 4 + len;
  const files: File[] = [];
  const paths: string[] = [];
  for (const { path, size } of index) {
    files.push(new File([buf.subarray(at, at + size)], path.split('/').pop()!));
    paths.push(path);
    at += size;
  }
  return { files, paths };
}
