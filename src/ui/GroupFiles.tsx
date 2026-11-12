import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { FileRecord } from '../engine/types';
import { bytes, copy } from './copy';
import { Preview } from './Preview';
import { Lazy } from './Timeline';
import { Viewer } from './Viewer';
import { viewable } from './viewerMedia';

const r = copy.results;
/** Rows per lazily drawn block, and one row's height with its gap (a 56 px tile and 8 px). */
const CHUNK = 50;
const ROW = 64;

const nameOf = (rec: FileRecord) => rec.path.split('/').slice(-2).join('/');
const extOf = (rec: FileRecord) => (rec.path.includes('.') ? rec.path.split('.').pop() ?? '' : '');
const typeOf = (rec: FileRecord) => copy.fileType(rec.kind, extOf(rec));

/**
 * D23: every file in a set-aside group, as a list: a small preview for pictures (which open the
 * viewer, stepping through the group's photos and videos), the kind of file for the rest, and each
 * one's name, size and date if known. Only the rows near the screen are drawn, and previews are
 * made only for those, so a 20,000-file group stays quick. No checkboxes: the group's own
 * "Keep these files" keeps them.
 */
export function GroupFiles({ records, files }: { records: readonly FileRecord[]; files: readonly File[] }) {
  const byIndex = useMemo(() => new Map(records.map((x) => [x.index, x])), [records]);
  const media = useMemo(() => records.filter(viewable).map((x) => x.index), [records]);
  const blocks = useMemo(() => {
    const out: FileRecord[][] = [];
    for (let s = 0; s < records.length; s += CHUNK) out.push(records.slice(s, s + CHUNK));
    return out;
  }, [records]);
  const [viewing, setViewing] = useState<number>();
  const [hold, setHold] = useState<number>();
  const list = useRef<HTMLDivElement>(null);
  const label = (id: number) => `${typeOf(byIndex.get(id)!)} ${nameOf(byIndex.get(id)!)}`;

  const close = (lastId: number) => {
    flushSync(() => setViewing(undefined));
    const find = () => list.current?.querySelector<HTMLElement>(`[data-view="${lastId}"]`);
    if (!find()) flushSync(() => setHold(lastId));
    find()?.focus();
    setHold(undefined);
  };

  return (
    <>
      <p className="sub-sm">{r.allStay}</p>
      <div className="gf-list" ref={list}>
        {blocks.map((b) => (
          <Lazy key={b[0].index} estimate={b.length * ROW - 8} sizeKey="gf" hold={hold !== undefined && b.some((x) => x.index === hold)}>
            {() => (
              <div className="gf-block">
                {b.map((x) => (
                  <div key={x.index} className="gf-item" data-id={x.index}>
                    {viewable(x) ? (
                      <OpenRow rec={x} file={files[x.index]} name={label(x.index)} onOpen={() => setViewing(x.index)} />
                    ) : (
                      <Preview file={files[x.index]} record={x} size="sm" />
                    )}
                    <div className="gf-text">
                      <span className="gf-name">{nameOf(x)}</span>
                      <span className="sub-sm">{typeOf(x)} · {r.fileMeta(bytes(x.size), x.takenAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Lazy>
        ))}
      </div>
      {viewing !== undefined && (
        <Viewer
          ids={media}
          startId={viewing}
          record={(id) => byIndex.get(id)!}
          files={files}
          label={label}
          detail={(id) => `${nameOf(byIndex.get(id)!)} · ${bytes(byIndex.get(id)!.size)}`}
          aside
          onClose={close}
        />
      )}
    </>
  );
}

/** A row's "view larger" button; its name says when the file has no preview (UX11). */
function OpenRow({ rec, file, name, onOpen }: { rec: FileRecord; file: File; name: string; onOpen: () => void }) {
  const [noPreview, setNoPreview] = useState(false);
  return (
    <button type="button" className="gf-open" data-view={rec.index} onClick={onOpen}>
      <span className="sr-only">{copy.viewer.open(noPreview ? r.noPreviewName(name) : name)}</span>
      <span aria-hidden="true"><Preview file={file} record={rec} size="sm" onNoPreview={setNoPreview} /></span>
    </button>
  );
}
