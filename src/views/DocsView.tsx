import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { pctText, t, tp } from '../i18n/messages';
import type { DocCategory, Document } from '../types';
import { downloadDocumentsZip } from '../lib/zipDocs';
import { attachDocumentFile } from '../lib/docFiles';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import { docCategoryLabel } from '../lib/enumLabels';
import { getNowMs } from '../lib/frozenNow';
import { shows } from '../lib/prodFacade';
import { DEFAULT_DOC_REQUIREMENTS, docStatusRows, docSummary, type DocRequirement, type DocStatusRow } from '../lib/docRequirements';
import { defaultDocWeek, docsForWeek, weeksWithLoads } from '../lib/docWeek';
import { clickableRow } from '../lib/clickableRow';
import { useIsPhone } from '../lib/useIsPhone';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';

const InsurancePolicyForm =
  import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED
    ? lazy(() => import('../auth/InsurancePolicyForm'))
    : null;

const CATS: { key: DocCategory; labelKey: string; who: string; whenKey: string }[] = [
  { key: 'PERMIT_PL', labelKey: 'doc_cat_permit_pl', who: 'Scandinavian Express', whenKey: 'docs_before_load' },
  { key: 'PERMIT_SE', labelKey: 'doc_cat_permit_se', who: 'Scandinavian Express', whenKey: 'docs_before_se' },
  { key: 'CMR', labelKey: 'doc_cat_cmr', who: 'Scandinavian Express', whenKey: 'docs_at_load' },
  /* UI-12: POD i zdjęcia mocowania usunięte z UI — CMR wgrywa dyspozytor SCX lub HHL */
  { key: 'INSURANCE', labelKey: 'doc_cat_insurance', who: 'Scandinavian Express', whenKey: 'docs_insurance_when' },
  { key: 'DRAWING', labelKey: 'doc_cat_drawing', who: 'KSH', whenKey: 'docs_drawing_when' },
];

export function DocsView() {
  const documents = useTowerStore((s) => s.documents);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const phone = useIsPhone();
  const nLoads = loads.length;
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [filterCat, setFilterCat] = useState<DocCategory | 'ALL'>('ALL');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ loadId: string; category: DocCategory } | null>(null);
  // III-6: wymagalność i terminy z bazy (produkcja) albo wartości startowe (demo)
  const [reqs, setReqs] = useState<DocRequirement[]>(DEFAULT_DOC_REQUIREMENTS);
  const [serverStatus, setServerStatus] = useState<DocStatusRow[] | null>(null);
  const [insuranceCover, setInsuranceCover] = useState<{ covered: number; total: number } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<DocCategory | null>(null);
  const [editReq, setEditReq] = useState<DocRequirement | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let alive = true;
    void import('../data/docRequirementsServer')
      .then((m) => m.loadDocRequirements())
      .then((r) => {
        if (!alive) return;
        setProjectId(r.projectId);
        if (r.reqs.length) setReqs(r.reqs);
        setServerStatus(r.status);
        if (r.projectId) {
          void import('../data/insuranceCoverServer')
            .then((ic) => ic.loadInsuranceCover(r.projectId!))
            .then((rows) => {
              if (!alive) return;
              setInsuranceCover({ covered: rows.filter((x) => x.covered).length, total: rows.length });
            })
            .catch(() => { if (alive) setInsuranceCover(null); });
        }
      })
      .catch(() => { /* brak odczytu → wartości startowe, stan liczony lokalnie */ });
    return () => { alive = false; };
  }, [documents.length, reloadTick]);
  const summary = useMemo(
    () => docSummary(serverStatus ?? docStatusRows(loads, documents, reqs, getNowMs())),
    [serverStatus, loads, documents, reqs],
  );
  const saveReq = async (r: DocRequirement) => {
    const st = useTowerStore.getState();
    try {
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        if (!projectId) throw new Error('—');
        const m = await import('../data/docRequirementsServer');
        await m.saveDocRequirement(projectId, r);
        setReloadTick((x) => x + 1);
      }
      setReqs((xs) => xs.map((x) => (x.category === r.category ? r : x)));
      setEditCat(null);
      st.pushToast(t(locale, 'iii6_saved'), 'MEDIUM');
    } catch (e) {
      st.pushToast(t(locale, 'iii6_err').replace('{msg}', e instanceof Error ? e.message : String(e)), 'HIGH');
    }
  };

  const rows = useMemo(() => {
    return CATS.map((c) => {
      const req = reqs.find((r) => r.category === c.key) ?? null;
      const sum = summary.get(c.key);
      // 3.2 / 0182: polisa ORG — kompletność z APPROVED insurance_policies (auto-podpięcie), nie z pliku per transport
      if (c.key === 'INSURANCE' && insuranceCover) {
        return { ...c, req, n: insuranceCover.covered, total: insuranceCover.total, overdue: 0 };
      }
      // dokument organizacyjny albo brak stanu z bazy: transporty z dokumentem tej kategorii
      const legacyOk = loads.filter((l) =>
        documents.some((d) => d.loadId === l.id && d.category === c.key && d.status === 'UPLOADED'),
      ).length;
      const perLoad = req !== null && req.required && req.anchor !== 'ORG';
      return { ...c, req, n: perLoad ? sum?.ok ?? 0 : legacyOk, total: perLoad ? sum?.total ?? nLoads : nLoads, overdue: perLoad ? sum?.overdue ?? 0 : 0 };
    });
  }, [documents, loads, reqs, summary, nLoads, insuranceCover]);

  const fileRows = useMemo(() => {
    const list = documents.filter((d) => (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);
    const filtered = filterCat === 'ALL' ? list : list.filter((d) => d.category === filterCat);
    // Keep actionable permit mismatches visible in the first page of the vault.
    return [...filtered].sort((a, b) => Number(b.status === 'MISMATCH') - Number(a.status === 'MISMATCH')).slice(0, 40);
  }, [documents, filterCat]);

  const driverVault = useMemo(
    () => documents.filter((d) => d.source === 'driver' && d.status === 'UPLOADED'),
    [documents],
  );

  const defaultLoadId = loads[0]?.id;
  // I-2k: paczka tygodnia — tylko dokumenty transportów z wybranego tygodnia ISO
  const weeks = useMemo(() => weeksWithLoads(loads), [loads]);
  const [packWeek, setPackWeek] = useState('');
  const week = weeks.includes(packWeek) ? packWeek : defaultDocWeek(weeks);

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
            {t(locale, 'a6_docs_upload')}
          </button>
        ) : null}
        {weeks.length ? (
          <select className="input" value={week} data-docs-week="" aria-label={t(locale, 'bill_col_week')} onChange={(e) => setPackWeek(e.target.value)}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {phone ? tp(locale, 'p22_docs_week_label', { n: Number(w.split('-W')[1] ?? 0), w }) : w}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className={phone ? 'btn ghost' : 'chipbtn'}
          data-docs-pack=""
          disabled={!week}
          onClick={() => {
            if (!week) return;
            void downloadDocumentsZip(docsForWeek(documents, loads, week), `WATCH_TOWER_dokumenty_${week}.zip`, (id) => loads.find((l) => l.id === id)?.code ?? id).then((r) => {
              useTowerStore.getState().pushToast(tp(locale, 'a6_docs_zip_toast', { n: r.count }), 'MEDIUM');
            });
          }}
        >
          {phone ? t(locale, 'p22_docs_pack_short') : t(locale, 'docs_week_pack')}
        </button>
      </header>
      <div className="panel-bd flush">
        {phone ? (
          /* wyglad/P2-2 W4 (E8 pkt 2, img/e8-after „Dokumenty”): karta kategorii w trzech rzędach. */
          <div className="mcards" data-docreq-cards="">
            {rows.map((r) => {
              const pct = r.n / Math.max(1, r.total);
              const req = r.req;
              const optional = req !== null && !req.required;
              const editing = editCat === r.key && editReq !== null;
              const reqText = !req
                ? t(locale, r.key === 'INSURANCE' && !shows('policyExpiryNote') ? 'i2_docs_insurance_when' : r.whenKey)
                : !req.required
                  ? t(locale, 'iii6_optional')
                  : t(locale, `iii6_a_${req.anchor}`).replace('{h}', String(req.offsetHours));
              const who = req ? t(locale, `iii6_r_${req.responsible}`) : r.who;
              return (
                <article
                  key={r.labelKey}
                  className="mcard docreq-card"
                  data-docreq-card={r.key}
                  {...clickableRow(() => {
                    setFilterCat(r.key);
                  })}
                >
                  <header className="mcard-hd">
                    <b>{t(locale, r.labelKey)}</b>
                    {optional ? (
                      <span className="mtag">{t(locale, 'iii6_optional')}</span>
                    ) : r.overdue > 0 ? (
                      <span className="mtag red" data-docreq-card-overdue={r.overdue}>{tp(locale, 'p22_docs_overdue_n', { n: r.overdue })}</span>
                    ) : pct >= 1 ? (
                      <span className="mtag go">{t(locale, 'p22_docs_complete_badge')}</span>
                    ) : null}
                  </header>
                  {editing && editReq ? (
                    <div className="mcard-edit" onClick={(e) => e.stopPropagation()}>
                      <label>
                        <input type="checkbox" data-docreq-card-required="" checked={editReq.required}
                          onChange={(e) => setEditReq({ ...editReq, required: e.target.checked })} /> {t(locale, 'iii6_required')}
                      </label>
                      {editReq.anchor !== 'ORG' ? (
                        <input className="input" type="number" min={0} max={720} data-docreq-card-hours=""
                          aria-label={t(locale, 'iii6_hours')} value={editReq.offsetHours}
                          onChange={(e) => setEditReq({ ...editReq, offsetHours: Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0))) })} />
                      ) : null}
                    </div>
                  ) : (
                    <div className="mcard-line">{who} · {reqText}</div>
                  )}
                  <div className="mcard-foot">
                    <span className="mcard-count">
                      {optional ? '—' : (
                        <>
                          {t(locale, 'p22_docs_komplet')} <b>{tp(locale, 'p22_n_of_total', { n: r.n, total: r.total })}</b>
                        </>
                      )}
                    </span>
                    {role === 'HHL' ? (
                      <span className="mcard-actions" onClick={(e) => e.stopPropagation()}>
                        {editing && editReq ? (
                          <>
                            <button type="button" className="btn" data-action="docreq-card-save" onClick={() => void saveReq(editReq)}>{t(locale, 'iii6_save')}</button>
                            <button type="button" className="btn ghost" onClick={() => setEditCat(null)}>{t(locale, 'iii6_cancel')}</button>
                          </>
                        ) : req ? (
                          <button type="button" className="btn ghost" data-action="docreq-card-edit" onClick={() => { setEditCat(r.key); setEditReq(req); }}>
                            {t(locale, 'iii6_edit')}
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t(locale, 'a6_docs_th_cat')}</th>
                <th>{t(locale, 'a6_docs_th_who')}</th>
                <th>{t(locale, 'iii6_th_req')}</th>
                <th className="num">{t(locale, 'docs_completeness')}</th>
                <th className="num">{t(locale, 'iii6_th_overdue')}</th>
                <th>{t(locale, 'a6_docs_th_state')}</th>
                {role === 'HHL' ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.n / Math.max(1, r.total);
                const pill = pct >= 1 ? 'p-go' : pct > 0.8 ? 'p-amber' : 'p-red';
                const req = r.req;
                const editing = editCat === r.key && editReq !== null;
                const reqText = !req
                  ? t(locale, r.key === 'INSURANCE' && !shows('policyExpiryNote') ? 'i2_docs_insurance_when' : r.whenKey)
                  : !req.required
                    ? t(locale, 'iii6_optional')
                    : t(locale, `iii6_a_${req.anchor}`).replace('{h}', String(req.offsetHours));
                return (
                  <tr
                    key={r.labelKey}
                    data-docreq={r.key}
                    style={{ cursor: 'pointer' }}
                    {...clickableRow(() => {
                      setFilterCat(r.key);
                    })}
                  >
                    <td style={{ fontWeight: 600 }}>{t(locale, r.labelKey)}</td>
                    <td>{req ? t(locale, `iii6_r_${req.responsible}`) : r.who}</td>
                    <td style={{ color: 'var(--ink-3)' }} data-docreq-text="">
                      {editing && editReq ? (
                        <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <label>
                            <input type="checkbox" data-docreq-required="" checked={editReq.required}
                              onChange={(e) => setEditReq({ ...editReq, required: e.target.checked })} /> {t(locale, 'iii6_required')}
                          </label>
                          {editReq.anchor !== 'ORG' ? (
                            <input className="input" type="number" min={0} max={720} style={{ width: 70 }} data-docreq-hours=""
                              aria-label={t(locale, 'iii6_hours')} value={editReq.offsetHours}
                              onChange={(e) => setEditReq({ ...editReq, offsetHours: Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0))) })} />
                          ) : null}
                        </span>
                      ) : reqText}
                    </td>
                    <td className="num">
                      {req && !req.required ? '—' : `${r.n} / ${r.total}`}
                    </td>
                    <td className="num" data-docreq-overdue={r.overdue}>
                      {r.overdue > 0 ? <span className="pill p-red">{r.overdue}</span> : '0'}
                    </td>
                    <td>
                      {req && !req.required ? <span className="pill">{t(locale, 'iii6_optional')}</span>
                        : <span className={`pill ${pill}`}>{pctText(locale, pct, 0, `${Math.round(pct * 100)}%`)}</span>}
                    </td>
                    {role === 'HHL' ? (
                      <td onClick={(e) => e.stopPropagation()}>
                        {editing && editReq ? (
                          <>
                            <button type="button" className="btn" data-action="docreq-save" onClick={() => void saveReq(editReq)}>{t(locale, 'iii6_save')}</button>{' '}
                            <button type="button" className="btn ghost" onClick={() => setEditCat(null)}>{t(locale, 'iii6_cancel')}</button>
                          </>
                        ) : req ? (
                          <button type="button" className="btn ghost" data-action="docreq-edit" onClick={() => { setEditCat(r.key); setEditReq(req); }}>
                            {t(locale, 'iii6_edit')}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        <div className="note" data-docreq-proposal="" style={{ border: 0 }}>{t(locale, 'iii6_proposal')}</div>

        <div className="filters" style={{ padding: '9px 13px' }}>
          <span className="sub">{t(locale, 'a6_docs_vault')}</span>
          <div className="spacer" />
          <button
            type="button"
            className="chipbtn"
            aria-pressed={filterCat === 'ALL'}
            onClick={() => setFilterCat('ALL')}
          >
            {t(locale, 'sched_all')}
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
            {t(locale, 'a6_docs_driver_vault')}
            <div style={{ marginTop: 6 }}>
              {driverVault.map((d) => (
                <DocFileRow key={d.id} doc={d} label={docCategoryLabel(d.category, locale)} onPreview={setPreviewDoc} />
              ))}
            </div>
          </div>
        ) : null}
        {/* D-30: formularz + notka z bazy (produkcja); demo — stała notka makiety */}
        {InsurancePolicyForm && (role === 'HHL' || role === 'SCX') ? (
          <Suspense fallback={null}><InsurancePolicyForm /></Suspense>
        ) : null}
        {shows('policyExpiryNote') && !InsurancePolicyForm ? (
          <div className="note">
            {t(locale, 'a6_docs_ocp_note')}
          </div>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="sronly"
        aria-label={t(locale, 'a6_docs_pick')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f || !uploadTarget) return;
          // BK4: tryb Supabase → Storage; demo → pamięć sesji.
          void attachDocumentFile(f, uploadTarget.loadId, uploadTarget.category);
        }}
      />
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
