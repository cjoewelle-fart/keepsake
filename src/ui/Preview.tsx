import { useEffect, useState } from 'react';
import { PREVIEWABLE } from '../engine/sniff';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';

/** A small square preview made from the local file. Nothing is uploaded: the URL points at the file on this computer. */
export function Preview({ file, record, size = 'md' }: { file: File; record: FileRecord; size?: 'md' | 'sm' }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const canShow = PREVIEWABLE.has(record.kind) && record.size > 0;

  useEffect(() => {
    if (!canShow) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, canShow]);

  const ext = record.path.split('.').pop()?.toUpperCase() ?? '';
  return (
    <div className={`tile tile-${size}`}>
      {canShow && url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="tile-label" title={copy.results.previewUnavailable}>{ext || '—'}</span>
      )}
    </div>
  );
}
