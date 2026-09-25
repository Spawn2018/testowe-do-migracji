/** Punkt 5 — podgląd pliku: scrim + panel (język Claude v2.0). Esc zamyka. */
import { useEffect, useMemo, useState } from 'react';
import type { Document } from '../../types';
import {
  downloadDocumentFile,
  isImageMime,
  objectUrlFromDoc,
} from '../../lib/docsIo';
import { docCategoryLabel } from '../../lib/enumLabels';
import { useTowerStore } from '../../store/useTowerStore';
import { isStoredDoc } from '../../data/registry';
import { downloadStoredDocument, storedDocUrl } from '../../lib/docFiles';
import { t } from '../../i18n/messages';

type Props = {
  doc: Document | null;
  onClose: () => void;
};

export function DocPreview({ doc, onClose }: Props) {
  const locale = useTowerStore((s) => s.locale);
  const stored = !!doc && isStoredDoc(doc);
  const handle = useMemo(() => (doc && !isStoredDoc(doc) ? objectUrlFromDoc(doc) : null), [doc]);
  // BK4: plik w Storage — link podpisany (15 min), pobierany przy otwarciu podglądu.
  const [signed, setSigned] = useState<{ id: string; url: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!doc || !isStoredDoc(doc)) return;
    let live = true;
    storedDocUrl(doc)
      .then((url) => { if (live) setSigned({ id: doc.id, url, error: null }); })
      .catch((e: unknown) => {
        if (live) setSigned({ id: doc.id, url: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => { live = false; };
  }, [doc]);

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

  if (!doc || (!handle && !stored)) return null;

  const mime = handle?.mime || doc.mimeType;
  const showImg = isImageMime(mime, doc.name);
  const hasRealBytes = stored || !!(doc.dataUrl && doc.dataUrl.startsWith('data:'));
  const cur = stored && signed?.id === doc.id ? signed : null;
  const src = stored ? cur?.url ?? null : handle?.url ?? null;

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
            {stored ? ` · ${t(locale, 'bk4_link_ttl')}` : hasRealBytes ? '' : ' · metadane'}
          </span>
          <div className="spacer" />
          <button
            type="button"
            className="iconbtn"
            title="Pobierz"
            aria-label="Pobierz"
            onClick={() => {
              if (stored) void downloadStoredDocument(doc);
              else downloadDocumentFile(doc);
            }}
          >
            ↓
          </button>
          <button type="button" className="iconbtn" title="Zamknij" aria-label="Zamknij" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="panel-bd docpreview-bd">
          {!src ? (
            <div className="note" style={{ border: 0 }}>
              {cur?.error
                ? t(locale, 'bk4_link_failed').replace('{msg}', cur.error)
                : t(locale, 'bk4_link_loading')}
            </div>
          ) : showImg ? (
            <img src={src} alt={doc.name} />
          ) : (
            <iframe title={doc.name} src={src} />
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
