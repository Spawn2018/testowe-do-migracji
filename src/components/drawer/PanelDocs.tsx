/**
 * wyglad/P5 — panel transportu › „Dokumenty” (E31 pkt 5, img/e31-after „SG-03 · Dokumenty”).
 * Lista wymaganych dokumentów tego transportu ze stanem (jest / brak / po terminie z datą) i kto wgrywa;
 * „Wgraj” tylko przy tym, co ta firma może wgrać (SCX i HHL — zezwolenia i CMR; KSH nic, 19:11).
 * Polisy podpinają się same (G-21): przewoźnika i Polisa HHL — numer i ważność z „AUTO” albo „brak” (audyt-C C-07)
 * (KSH widzi polisę HHL, SCX swoją, HHL obie). „Inne pliki” z „+ Dodaj” (HHL i SCX; rodzaj „Inne”, wiele plików — `otherDocsOn`),
 * „Pobierz wszystkie (ZIP)” z kodem w nazwie.
 * „Wgraj” otwiera okno „Wgraj dokument” z wybranym transportem. Zapis jak dziś (`attachDocumentFile`).
 */
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DocCategory, Document, Load, Locale } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { DocFileRow } from '../ui/DocFileRow';
import { downloadDocumentFile } from '../../lib/docsIo';
import { downloadStoredDocument } from '../../lib/docFiles';
import { isStoredDoc } from '../../data/registry';
import { downloadDocumentsZip } from '../../lib/zipDocs';
import { cmrAfterDelivery, cmrCounts, docStatusRows } from '../../lib/docRequirements';
import { reqVisible } from '../../lib/p5Docs';
import { useDocReqCache } from '../../lib/docReqCache';
import { docRequirementsStart, otherDocsOn, permitsOf, policiesOf } from '../../lib/p5Source';
import { firmPermitFor, firmPermitLoad, withoutRoutePermits } from '../../lib/permitKind';
import { lazyRetry } from '../../lib/lazyRetry';
import { isPreviewReadOnly } from '../../lib/prodFacade';
import { t, tp } from '../../i18n/messages';
import { ft, ftp } from '../../i18n/p5';
import '../finance/finance.css';
import './panel.css';
import { fmtDate, formatCalendarDay } from '../../lib/time';

const UploadDocModal = lazy(lazyRetry(() => import('../docs/UploadDocModal').then((m) => ({ default: m.UploadDocModal }))));

const REQ: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR'];
/* D-20261020-1118-01: zezwolenie firmowe — jedno, podpina się samo; przy transporcie wgrywa się tylko CMR */
const REQ_FIRM: DocCategory[] = ['CMR'];
const OTHER: DocCategory[] = ['OTHER'];
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
  /* null = okno zamknięte; REQ — „Wgraj” przy wymaganym; OTHER — „+ Dodaj” przy „Inne pliki” */
  const [upload, setUpload] = useState<DocCategory[] | null>(null);
  const canUpload = role === 'HHL' || role === 'SCX';
  /* W38: w Podglądzie bez zapisu — przycisk ukryty jak inne zapisy */
  const canAddOther = canUpload && otherDocsOn() && !isPreviewReadOnly({ viewRole: role });
  const policies = policiesOf();
  /* D-20261020-1118-01: rodzaj zezwolenia z tabeli symboli (Firma — jedno zezwolenie, Trasa — PL i SE) */
  const firm = firmPermitLoad(load);
  const firmPermit = firm ? firmPermitFor(load, permitsOf([load])) : null;
  const reqCats = firm ? REQ_FIRM : REQ;
  /* wyglad/W-cele-przejsc (b): „Wgraj” ze sprawy w „Do zrobienia” — okno „Wgraj dokument” z tym transportem i rodzajem.
     Polisa (INSURANCE) nie wgrywa się tym oknem — wtedy sama zakładka z wierszem polisy. */
  const uploadReq = useTowerStore((s) => s.uploadReq);
  const [upCat, setUpCat] = useState<DocCategory | null>(null);
  useEffect(() => {
    if (!uploadReq || uploadReq.loadId !== load.id) return;
    useTowerStore.getState().setUploadReq(null);
    if (uploadReq.category === 'INSURANCE') {
      /* brak polisy SCX (0243 `policy`) — wiersz polisy na tej zakładce, bez okna wgrywania */
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('.drawer [data-pd-req="INSURANCE"]');
        if (!el) return;
        el.scrollIntoView({ block: 'center' });
        el.classList.add('is-go-target');
        window.setTimeout(() => el.classList.remove('is-go-target'), 2400);
      });
      return;
    }
    if (!canUpload) return;
    const cat = uploadReq.category && reqCats.includes(uploadReq.category) ? uploadReq.category : null;
    setUpCat(cat);
    setUpload(reqCats);
  }, [uploadReq, load.id, canUpload, reqCats]);
  /* ten sam odczyt co strona Dokumenty (baza); w demo — wartości startowe; w produkcji bez odczytu — bez terminów */
  const cached = useDocReqCache(`${docs.length}|${load.id}|${load.status}`);
  const prod = import.meta.env.VITE_AUTH_MODE === 'supabase';
  const reqs = cached?.reqs ?? docRequirementsStart();
  const rows = useMemo(
    /* CMR liczy się dopiero po „Dostarczone” (decyzja 18.10, 17:28) */
    () => withoutRoutePermits(cmrAfterDelivery(cached ? cached.status.filter((r) => r.loadId === load.id) : prod ? [] : docStatusRows([load], docs, reqs, nowMs), () => load.status), firm),
    [cached, prod, load, docs, reqs, nowMs, firm],
  );
  const known = !!cached || !prod;
  const current = (c: DocCategory) => docs.filter((d) => d.category === c && (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);
  const others = docs.filter((d) => !reqCats.includes(d.category) && !(firm && !firmPermit && REQ.includes(d.category)) && d.category !== 'INSURANCE' && (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);

  const reqRow = (c: DocCategory) => {
    const req = reqs.find((r) => r.category === c);
    if (!req || !req.required) return null;
    const st = rows.find((r) => r.category === c);
    const have = current(c);
    const label = c === 'CMR' ? (known ? ft(locale, 'p5_doc_r_CMR_SIGNED') : ft(locale, 'p5_doc_cat_CMR')) : ft(locale, `p5_doc_r_${c}`);
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
          : c === 'CMR' && !cmrCounts(load.status)
            ? <span className="fin-muted" data-pd-state="WAIT">{ft(locale, 'p5_pd_state_CMR_wait')}</span>
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
            <button type="button" className="btn ghost" data-pd-upload={c} onClick={() => setUpload(reqCats)}>{ft(locale, 'p5_pd_upload')}</button>
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
          <span className={ok ? 'fin-tag go' : 'fin-tag plain'}>{ok ? ft(locale, 'p5_pd_auto') : org}</span>
        </div>
      </li>
    );
  };

  /* D-20261020-1118-01: zezwolenie firmowe — numer i ważność z „Auto” (jak polisy); bez ważnego — wgrany plik zezwolenia
     tego transportu albo „brak” z „Wgraj” (nowe zezwolenie firmowe w oknie „Wgraj dokument”, rodzaj „Firma”) */
  const firmRow = () => {
    const ok = firmPermit ? ftp(locale, 'p5_pd_policy_ok', { number: firmPermit.number ?? '—', date: firmPermit.validTo ? dmy(firmPermit.validTo) : '—' }) : null;
    const file = ok ? null : current('PERMIT_PL')[0] ?? current('PERMIT_SE')[0] ?? null;
    return (
      <li key="PERMIT_FIRM" className="pd-row" data-pd-req="PERMIT_FIRM">
        <div className="pd-tx">
          <b>{ft(locale, 'p5_doc_r_PERMIT_FIRM')}</b>
          {ok ? <span className="pd-ok" data-content>{ok}</span>
            : file ? (
              <span className={file.status === 'MISMATCH' ? 'pd-warn' : 'pd-ok'} data-pd-state="OK">
                {ft(locale, 'p5_pd_state_OK')}
                <button type="button" className="linkbtn pd-name" title={t(locale, 'a6_doc_preview')} onClick={() => onPreview(file)}>{file.name}</button>
              </span>
            )
              : <span className="neg" data-pd-state="MISSING">{ft(locale, 'p5_pd_permit_firm_none')}</span>}
        </div>
        <div className="pd-act">
          {ok ? <span className="fin-tag go">{ft(locale, 'p5_pd_auto')}</span>
            : !file && canUpload ? <button type="button" className="btn ghost" data-pd-upload="PERMIT_FIRM" onClick={() => setUpload(REQ)}>{ft(locale, 'p5_pd_upload')}</button>
              : !file ? <span className="fin-tag plain">SCX</span> : null}
        </div>
      </li>
    );
  };

  return (
    <div className="pd" data-pd data-pd-permit={firm ? 'FIRMA' : 'TRASA'}>
      <ul className="pd-list">
        {firm ? firmRow() : null}
        {reqCats.map(reqRow)}
        {policyRow('INSURANCE')}
        {policyRow('OCS')}
        <li className="pd-row" data-pd-other>
          <div className="pd-tx">
            <b>{ft(locale, 'p5_pd_other')}</b>
            {others.length ? null : <span className="fin-muted">{ft(locale, 'p5_doc_none')}</span>}
            {/* rodzaj „Inne” bez etykiety — nagłówek wiersza już mówi „Inne pliki”; inne rodzaje z nazwą (POD, rysunek…) */}
            {others.map((d) => <DocFileRow key={d.id} doc={d} label={d.category === 'OTHER' ? '' : undefined} onPreview={onPreview} />)}
          </div>
          {canAddOther ? (
            <div className="pd-act">
              <button
                type="button"
                className="btn ghost"
                data-pd-other-add
                aria-label={ftp(locale, 'p5_pd_other_aria', { code: load.code })}
                onClick={() => setUpload(OTHER)}
              >
                {ft(locale, 'p5_pd_other_add')}
              </button>
            </div>
          ) : null}
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
      {/* zezwolenia przy transporcie (dodaj, podłącz, zgodność) — tylko przy zezwoleniu „Trasa” */}
      {firm ? null : permitForm}
      {upload && canUpload ? (
        <Suspense fallback={null}>
          <UploadDocModal
            locale={locale}
            role={role as 'HHL' | 'SCX'}
            phone={phone}
            loads={[load]}
            statusRows={rows}
            allowed={upload}
            loadId={load.id}
            category={upCat}
            onClose={() => { setUpload(null); setUpCat(null); }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
