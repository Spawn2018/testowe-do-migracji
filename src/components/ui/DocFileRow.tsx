/** Punkt 5 — wiersz pliku w stylu .mrow + .iconbtn ↓ (Claude v2: zwykły tekst ✓ nazwa). */
import type { Document, Locale } from '../../types';
import { downloadDocumentFile } from '../../lib/docsIo';
import { downloadStoredDocument } from '../../lib/docFiles';
import { isStoredDoc } from '../../data/registry';
import { docCategoryLabel } from '../../lib/enumLabels';
import { useTowerStore } from '../../store/useTowerStore';
import { t, tp } from '../../i18n/messages';

type Props = {
  doc: Document;
  label?: string;
  onPreview: (doc: Document) => void;
  onUploadClick?: () => void;
  showUpload?: boolean;
  /** 8A (17.10): aplikacja kierowcy podaje własny język (PL, EN, SV); panel — zawsze „pl” ze store */
  locale?: Locale;
};

export function DocFileRow({ doc, label, onPreview, onUploadClick, showUpload, locale: driverLocale }: Props) {
  const storeLocale = useTowerStore((s) => s.locale);
  const locale = driverLocale ?? storeLocale;
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
              title={t(locale, 'a6_doc_preview')}
              style={{ color: okColor }}
              onClick={() => onPreview(doc)}
            >
              ✓ {doc.name}
            </button>
            {(doc.version ?? 1) > 1 ? (
              <span className="pill" data-doc-version={doc.version}>{t(locale, 'iii6_ver').replace('{n}', String(doc.version))}</span>
            ) : null}
            <button
              type="button"
              className="iconbtn"
              title={t(locale, 'a6_doc_download')}
              aria-label={tp(locale, 'a6_doc_download_name', { name: doc.name })}
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
            <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_doc_missing')}</span>
            {showUpload && onUploadClick ? (
              <button type="button" className="btn ghost" style={{ marginLeft: 7 }} onClick={onUploadClick}>
                {t(locale, 'a6_doc_upload')}
              </button>
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}
