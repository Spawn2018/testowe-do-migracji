import { useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import type { DocCategory, Document } from '../types';
import { downloadDocumentsZip } from '../lib/zipDocs';
import { readFileAsDataUrl } from '../lib/docsIo';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import { docCategoryLabel } from '../lib/enumLabels';

const CATS: { key: DocCategory | 'DRAWING'; labelKey: string; who: string; whenKey: string }[] = [
  { key: 'PERMIT_PL', labelKey: 'doc_cat_permit_pl', who: 'Scandinavian Express', whenKey: 'docs_before_load' },
  { key: 'PERMIT_SE', labelKey: 'doc_cat_permit_se', who: 'Scandinavian Express', whenKey: 'docs_before_se' },
  { key: 'CMR', labelKey: 'doc_cat_cmr', who: 'Scandinavian Express', whenKey: 'docs_at_load' },
  { key: 'POD', labelKey: 'doc_cat_pod', who: 'Scandinavian Express', whenKey: 'docs_after_unload' },
  { key: 'LASHING_PHOTOS', labelKey: 'docs_lashing', who: 'Scandinavian Express', whenKey: 'docs_at_load' },
  { key: 'INSURANCE', labelKey: 'doc_cat_insurance', who: 'Scandinavian Express', whenKey: 'docs_insurance_when' },
  { key: 'DRAWING', labelKey: 'doc_cat_drawing', who: 'KSH', whenKey: 'docs_drawing_when' },
];

export function DocsView() {
  const documents = useTowerStore((s) => s.documents);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const uploadDocument = useTowerStore((s) => s.uploadDocument);
  const nLoads = loads.length;
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [filterCat, setFilterCat] = useState<DocCategory | 'ALL'>('ALL');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ loadId: string; category: DocCategory } | null>(null);

  const rows = useMemo(() => {
    return CATS.map((c) => {
      if (c.key === 'DRAWING') {
        return { ...c, n: nLoads };
      }
      const ok = loads.filter((l) =>
        documents.some((d) => d.loadId === l.id && d.category === c.key && d.status === 'UPLOADED'),
      ).length;
      return { ...c, n: ok };
    });
  }, [documents, loads, nLoads]);

  const fileRows = useMemo(() => {
    const list = documents.filter((d) => d.status === 'UPLOADED' || d.status === 'MISMATCH');
    const filtered = filterCat === 'ALL' ? list : list.filter((d) => d.category === filterCat);
    // Keep actionable permit mismatches visible in the first page of the vault.
    return [...filtered].sort((a, b) => Number(b.status === 'MISMATCH') - Number(a.status === 'MISMATCH')).slice(0, 40);
  }, [documents, filterCat]);

  const driverVault = useMemo(
    () => documents.filter((d) => d.source === 'driver' && d.status === 'UPLOADED'),
    [documents],
  );

  const defaultLoadId = loads[0]?.id;

  return (
    <div className="panel section-card page-sections" data-page="docs" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_docs')}</h2>
        <span className="sub">{t(locale, 'docs_cats_sub')}</span>
        <div className="spacer" />
        {role !== 'KSH' ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!defaultLoadId) return;
              setUploadTarget({ loadId: defaultLoadId, category: 'CMR' });
              fileRef.current?.click();
            }}
          >
            Wgraj dokument
          </button>
        ) : null}
        <button
          type="button"
          className="chipbtn"
          onClick={() => {
            void downloadDocumentsZip(documents, 'WATCH_TOWER_dokumenty_tydzien.zip').then((r) => {
              useTowerStore.getState().pushToast(`Paczka ZIP · ${r.count} plików`, 'MEDIUM');
            });
          }}
        >
          {t(locale, 'docs_week_pack')}
        </button>
      </header>
      <div className="panel-bd flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Kategoria</th>
                <th>Kto wgrywa</th>
                <th>{t(locale, 'docs_requirement')}</th>
                <th className="num">{t(locale, 'docs_completeness')}</th>
                <th>Stan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.n / Math.max(1, nLoads);
                const pill = pct >= 1 ? 'p-go' : pct > 0.8 ? 'p-amber' : 'p-red';
                return (
                  <tr
                    key={r.labelKey}
                    style={{ cursor: r.key === 'DRAWING' ? 'default' : 'pointer' }}
                    onClick={() => {
                      if (r.key !== 'DRAWING') setFilterCat(r.key);
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>{t(locale, r.labelKey)}</td>
                    <td>{r.who}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{t(locale, r.whenKey)}</td>
                    <td className="num">
                      {r.n} / {nLoads}
                    </td>
                    <td>
                      <span className={`pill ${pill}`}>{Math.round(pct * 100)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="filters" style={{ padding: '9px 13px' }}>
          <span className="sub">Pliki w vault</span>
          <div className="spacer" />
          <button
            type="button"
            className="chipbtn"
            aria-pressed={filterCat === 'ALL'}
            onClick={() => setFilterCat('ALL')}
          >
            Wszystkie
          </button>
          {filterCat !== 'ALL' ? (
            <button type="button" className="chipbtn" aria-pressed="true" onClick={() => setFilterCat('ALL')}>
              {docCategoryLabel(filterCat, locale)}
            </button>
          ) : null}
        </div>

        <div style={{ padding: '0 13px 9px' }}>
          {fileRows.length === 0 ? (
            <div className="note" style={{ border: 0 }}>
              {t(locale, 'docs_empty_cat')}
            </div>
          ) : (
            fileRows.map((d) => {
              const code = loads.find((l) => l.id === d.loadId)?.code ?? d.loadId;
              return (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  label={`${code} · ${docCategoryLabel(d.category, locale)}`}
                  onPreview={setPreviewDoc}
                />
              );
            })
          )}
        </div>

        {driverVault.length > 0 ? (
          <div className="note" data-vault="driver">
            Vault kierowcy (wgrane z aplikacji):
            <div style={{ marginTop: 6 }}>
              {driverVault.map((d) => (
                <DocFileRow key={d.id} doc={d} label={docCategoryLabel(d.category, locale)} onPreview={setPreviewDoc} />
              ))}
            </div>
          </div>
        ) : null}
        <div className="note">
          Polisa OCP Scandinavian Express wygasa 03.10.2026. Przypomnienie wychodzi 14 dni przed terminem,
          automatycznie.
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="sronly"
        aria-label="Wybierz plik dokumentu"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f || !uploadTarget) return;
          void readFileAsDataUrl(f)
            .then((r) => {
              uploadDocument(uploadTarget.loadId, uploadTarget.category, r.name, {
                dataUrl: r.dataUrl,
                mimeType: r.mimeType,
                bytes: r.bytes,
              });
            })
            .catch(() => {
              useTowerStore.getState().pushToast('Nie udało się odczytać pliku', 'HIGH');
            });
        }}
      />
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
