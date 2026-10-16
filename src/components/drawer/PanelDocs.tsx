/**
 * wyglad/P5 — panel transportu › „Dokumenty” (E31 pkt 5, img/e31-after „SG-03 · Dokumenty”).
 * Lista wymaganych dokumentów tego transportu ze stanem (jest / brak / po terminie z datą) i kto wgrywa;
 * „Wgraj” tylko przy tym, co ta firma może wgrać (SCX i HHL — zezwolenia i CMR; KSH nic, 19:11).
 * Polisy podpinają się same (G-21): przewoźnika i Polisa HHL — numer i ważność z „AUTO” albo „brak” (audyt-C C-07)
 * (KSH widzi polisę HHL, SCX swoją, HHL obie). „Inne pliki” (bez „+ Dodaj” do rodzaju „Inne”), „Pobierz wszystkie (ZIP)” z kodem w nazwie.
 * „Wgraj” otwiera okno „Wgraj dokument” z wybranym transportem. Zapis jak dziś (`attachDocumentFile`).
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { DocCategory, Document, Load, Locale } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { DocFileRow } from '../ui/DocFileRow';
import { downloadDocumentFile } from '../../lib/docsIo';
import { downloadStoredDocument } from '../../lib/docFiles';
import { isStoredDoc } from '../../data/registry';
import { downloadDocumentsZip } from '../../lib/zipDocs';
import { docStatusRows } from '../../lib/docRequirements';
import { cmrKind, reqVisible } from '../../lib/p5Docs';
import { getDocReqCache } from '../../lib/docReqCache';
import { docRequirementsStart, policiesOf } from '../../lib/p5Source';
import { lazyRetry } from '../../lib/lazyRetry';
import { t, tp } from '../../i18n/messages';
import { ft, ftp } from '../../i18n/p5';
import { up } from '../options/up';
import '../finance/finance.css';
import './panel.css';
import { fmtDate, formatCalendarDay } from '../../lib/time';

const UploadDocModal = lazy(lazyRetry(() => import('../docs/UploadDocModal').then((m) => ({ default: m.UploadDocModal }))));

const REQ: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR'];
/* rok zawsze — właściciel 16.10.2026 */
const dmy = (iso: string) => formatCalendarDay(iso.slice(0, 10));
const dm = (iso: string) => fmtDate(iso);

interface Props {
  load: Load;
  role: 'HHL' | 'KSH' | 'SCX';
  locale: Locale;
  phone: boolean;
  nowMs: number;
  docs: Document[];
  /** Polisa przewoźnika z bazy (produkcja): numer i ważność albo brak. */
  insAuto: { covered: boolean; policyNo: string | null; validUntil: string | null } | null;
  onPreview: (d: Document) => void;
  /** Dzisiejszy formularz zezwoleń transportu (produkcja). */
  permitForm?: ReactNode;
}

export function PanelDocs({ load, role, locale, phone, nowMs, docs, insAuto, onPreview, permitForm }: Props) {
  const [upload, setUpload] = useState(false);
  const canUpload = role === 'HHL' || role === 'SCX';
  const policies = policiesOf();
  /* ten sam odczyt co strona Dokumenty (baza); w demo — wartości startowe; w produkcji bez odczytu — bez terminów */
  const cached = getDocReqCache();
  const prod = import.meta.env.VITE_AUTH_MODE === 'supabase';
  const reqs = cached?.reqs ?? docRequirementsStart();
  const rows = useMemo(
    () => (cached ? cached.status.filter((r) => r.loadId === load.id) : prod ? [] : docStatusRows([load], docs, reqs, nowMs)),
    [cached, prod, load, docs, reqs, nowMs],
  );
  const known = !!cached || !prod;
  const current = (c: DocCategory) => docs.filter((d) => d.category === c && (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);
  const others = docs.filter((d) => !REQ.includes(d.category) && d.category !== 'INSURANCE' && (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);

  const reqRow = (c: DocCategory) => {
    const req = reqs.find((r) => r.category === c);
    if (!req || !req.required) return null;
    const st = rows.find((r) => r.category === c);
    const have = current(c);
    const label = c === 'CMR' ? (known ? ft(locale, `p5_doc_r_CMR_${cmrKind(req)}`) : ft(locale, 'p5_doc_cat_CMR')) : ft(locale, `p5_doc_r_${c}`);
    const doc = have[0];
    const state = doc
      ? (
        <span className={doc.status === 'MISMATCH' ? 'pd-warn' : 'pd-ok'} data-pd-state="OK">
          {ft(locale, 'p5_pd_state_OK')}
          <button type="button" className="linkbtn pd-name" title={t(locale, 'a6_doc_preview')} onClick={() => onPreview(doc)}>{doc.name}</button>
        </span>
      )
      : st?.state === 'OVERDUE' && st.dueAt
        ? <span className="neg" data-pd-state="OVERDUE">{ftp(locale, 'p5_pd_state_OVERDUE', { date: dm(st.dueAt) })}</span>
        : st?.dueAt
          ? <span className="neg" data-pd-state="MISSING">{ftp(locale, 'p5_pd_state_MISSING_due', { date: dm(st.dueAt) })}</span>
          : <span className="neg" data-pd-state="MISSING">{ft(locale, 'p5_pd_state_MISSING')}</span>;
    return (
      <li key={c} className="pd-row" data-pd-req={c}>
        <div className="pd-tx"><b>{label}</b>{state}</div>
        <div className="pd-act">
          {doc ? (
            <button
              type="button"
              className="iconbtn"
              title={t(locale, 'a6_doc_download')}
              aria-label={tp(locale, 'a6_doc_download_name', { name: doc.name })}
              onClick={() => { if (isStoredDoc(doc)) void downloadStoredDocument(doc); else downloadDocumentFile(doc); }}
            >
              ↓
            </button>
          ) : null}
          {canUpload && !doc ? (
            <button type="button" className="btn ghost" data-pd-upload={c} onClick={() => setUpload(true)}>{ft(locale, 'p5_pd_upload')}</button>
          ) : !doc ? <span className="fin-tag plain">SCX</span> : null}
        </div>
      </li>
    );
  };

  const policyRow = (key: 'INSURANCE' | 'OCS') => {
    if (!reqVisible(key, role)) return null;
    const org = key === 'INSURANCE' ? 'SCX' : 'HHL';
    const p = policies?.find((x) => x.org === org) ?? null;
    /* polisa HHL bez danych z bazy — „—”, nie „brak” */
    const unknown = key === 'OCS' && policies == null;
    const prod = key === 'INSURANCE' && insAuto ? insAuto : null;
    const ok = p ? ftp(locale, 'p5_pd_policy_ok', { number: p.number, date: dmy(p.validTo) })
      : prod?.covered && prod.policyNo ? ftp(locale, 'p5_pd_policy_ok', { number: prod.policyNo, date: prod.validUntil ? dmy(prod.validUntil) : '—' }) : null;
    return (
      <li key={key} className="pd-row" data-pd-req={key}>
        <div className="pd-tx">
          <b>{ft(locale, `p5_doc_r_${key}`)}</b>
          {ok ? <span className="pd-ok" data-content>{ok}</span> : unknown ? <span className="fin-muted">—</span> : <span className="neg">{ft(locale, `p5_pd_policy_none_${key}`)}</span>}
        </div>
        <div className="pd-act">
          <span className={ok ? 'fin-tag go' : 'fin-tag plain'}>{ok ? up(ft(locale, 'p5_pd_auto')) : org}</span>
        </div>
      </li>
    );
  };

  return (
    <div className="pd" data-pd>
      <ul className="pd-list">
        {REQ.map(reqRow)}
        {policyRow('INSURANCE')}
        {policyRow('OCS')}
        <li className="pd-row" data-pd-other>
          <div className="pd-tx">
            <b>{ft(locale, 'p5_pd_other')}</b>
            {others.length ? null : <span className="fin-muted">{ft(locale, 'p5_doc_none')}</span>}
            {others.map((d) => <DocFileRow key={d.id} doc={d} onPreview={onPreview} />)}
          </div>
          {/* „+ Dodaj” wraca, gdy aplikacja dostanie rodzaj „Inne” (w bazie jest OTHER) — D-20261014-2005-01 S4 pkt 7 */}
        </li>
      </ul>
      <div className="pd-foot">
        <button
          type="button"
          className="btn ghost"
          data-pd-zip
          onClick={() => {
            void downloadDocumentsZip(docs, `${load.code}_dokumenty.zip`, () => load.code).then((r) => {
              useTowerStore.getState().pushToast(tp(locale, 'a6_dr_zip_toast', { code: load.code, n: String(r.count) }), 'MEDIUM', load.id);
            });
          }}
        >
          {ft(locale, 'p5_pd_zip')}
        </button>
      </div>
      <p className="fin-muted">{ft(locale, 'p5_pd_note')}</p>
      {permitForm}
      {upload && canUpload ? (
        <Suspense fallback={null}>
          <UploadDocModal
            locale={locale}
            role={role as 'HHL' | 'SCX'}
            phone={phone}
            loads={[load]}
            statusRows={rows}
            allowed={REQ}
            loadId={load.id}
            onClose={() => setUpload(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
