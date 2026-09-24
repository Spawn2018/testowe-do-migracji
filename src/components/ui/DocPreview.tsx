/** Punkt 5 — podgląd pliku: scrim + panel (język Claude v2.0). Esc zamyka. */
import { useEffect, useMemo } from 'react';
import type { Document } from '../../types';
import {
  downloadDocumentFile,
  isImageMime,
  objectUrlFromDoc,
} from '../../lib/docsIo';
import { docCategoryLabel } from '../../lib/enumLabels';
import { useTowerStore } from '../../store/useTowerStore';

type Props = {
  doc: Document | null;
  onClose: () => void;
};

export function DocPreview({ doc, onClose }: Props) {
  const locale = useTowerStore((s) => s.locale);
  const handle = useMemo(() => (doc ? objectUrlFromDoc(doc) : null), [doc]);

  useEffect(() => {
    return () => {
      handle?.revoke();
    };
  }, [handle]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [doc, onClose]);

  if (!doc || !handle) return null;

  const mime = handle.mime || doc.mimeType;
  const showImg = isImageMime(mime, doc.name);
  const hasRealBytes = !!(doc.dataUrl && doc.dataUrl.startsWith('data:'));

  return (
    <>
      <button
        type="button"
        className="scrim"
        style={{ zIndex: 50 }}
        aria-label="Zamknij podgląd"
        onClick={onClose}
      />
      <div
        className="panel docpreview"
        role="dialog"
        aria-modal="true"
        aria-label={`Podgląd · ${doc.name}`}
      >
        <header className="panel-hd">
          <h2 style={{ fontSize: 18 }}>{doc.name}</h2>
          <span className="sub">
            {docCategoryLabel(doc.category, locale)}
            {hasRealBytes ? '' : ' · metadane'}
          </span>
          <div className="spacer" />
          <button
            type="button"
            className="iconbtn"
            title="Pobierz"
            aria-label="Pobierz"
            onClick={() => downloadDocumentFile(doc)}
          >
            ↓
          </button>
          <button type="button" className="iconbtn" title="Zamknij" aria-label="Zamknij" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="panel-bd docpreview-bd">
          {showImg ? (
            <img src={handle.url} alt={doc.name} />
          ) : (
            <iframe title={doc.name} src={handle.url} />
          )}
          {!hasRealBytes ? (
            <div className="note" style={{ borderTop: '1px solid var(--rule-2)', marginTop: 8 }}>
              Brak bajtów w vault — pokazano stub metadanych. Wgraj plik, aby zobaczyć obraz lub PDF.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
