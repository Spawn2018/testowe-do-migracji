/** Punkt 5 — wiersz pliku w stylu .mrow + .iconbtn ↓ (Claude v2: zwykły tekst ✓ nazwa). */
import type { Document } from '../../types';
import { downloadDocumentFile } from '../../lib/docsIo';
import { downloadStoredDocument } from '../../lib/docFiles';
import { isStoredDoc } from '../../data/registry';
import { docCategoryLabel } from '../../lib/enumLabels';
import { useTowerStore } from '../../store/useTowerStore';

type Props = {
  doc: Document;
  label?: string;
  onPreview: (doc: Document) => void;
  onUploadClick?: () => void;
  showUpload?: boolean;
};

export function DocFileRow({ doc, label, onPreview, onUploadClick, showUpload }: Props) {
  const locale = useTowerStore((s) => s.locale);
  const uploaded = doc.status === 'UPLOADED' || doc.status === 'MISMATCH' || doc.status === 'EXPIRED';
  const okColor = doc.status === 'MISMATCH' ? 'var(--amber)' : 'var(--go)';

  return (
    <div className="mrow">
      <span className="lbl">{label ?? docCategoryLabel(doc.category, locale)}</span>
      <span className="docrow-actions">
        {uploaded ? (
          <>
            <button
              type="button"
              className="docrow-name"
              title="Podgląd"
              style={{ color: okColor }}
              onClick={() => onPreview(doc)}
            >
              ✓ {doc.name}
            </button>
            <button
              type="button"
              className="iconbtn"
              title="Pobierz"
              aria-label={`Pobierz ${doc.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isStoredDoc(doc)) void downloadStoredDocument(doc);
                else downloadDocumentFile(doc);
              }}
            >
              ↓
            </button>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--red)' }}>brak</span>
            {showUpload && onUploadClick ? (
              <button type="button" className="btn ghost" style={{ marginLeft: 7 }} onClick={onUploadClick}>
                Wgraj
              </button>
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}
