/**
 * wyglad/P5 — Dokumenty (E31, img/e31-after; decyzje 08.10 12:14 i 09.10 13:09).
 * Komputer: nagłówek z „Wgraj dokument” i „Paczka tygodnia”, „Wymagania przy transporcie” (po terminie i w ciągu
 * 7 dni zamiast „0 / 94”, klik w liczbę pokazuje transporty), „Zezwolenia” (Firma / Trasa), „Pliki” z filtrami.
 * Terminy tylko do odczytu — zmienia je Administrator HHL w Opcjach › Zezwolenia i dokumenty (E12).
 * Polisy: KSH widzi polisę HHL, SCX swoją, HHL obie (pytanie 3); dodawane raz, podpinają się same (G-21).
 * KSH nic nie wgrywa (19:11). Telefon: duży przycisk „Wgraj dokument lub zrób zdjęcie”, braki jako karty (E8).
 * Dane: wymagania i stan z bazy (`doc_requirements`, `doc_requirements_status`) albo wartości startowe w demo;
 * zezwolenia i polisy z `p5Source` (podłącza wykonawca). Zapis pliku jak dziś (`attachDocumentFile`).
 */
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { ft, ftp } from '../i18n/p5';
import type { DocCategory, Document, Locale, RoleId } from '../types';
import { downloadDocumentsZip } from '../lib/zipDocs';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import { getNowMs } from '../lib/frozenNow';
import { DEFAULT_DOC_REQUIREMENTS, docStatusRows, type DocRequirement, type DocStatusRow } from '../lib/docRequirements';
import { defaultDocWeek, docsForWeek, weeksWithLoads } from '../lib/docWeek';
import { setDocReqCache } from '../lib/docReqCache';
import { useIsPhone } from '../lib/useIsPhone';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { transportLabel } from '../lib/transportName';
import { formatPlNumber } from '../lib/format';
import { fmtDate, fmtDateRange, fmtDateTime } from '../lib/time';
import { weekKeyLabel } from '../lib/p5Invoices';
import {
  cmrKind, codesText, filterFiles, reqCount, reqVisible, REQ_KEYS, responsibleOrg, seenBy, type FileFilter, type ReqKey,
} from '../lib/p5Docs';
import { permitsOf, policiesOf, type PolicyView } from '../lib/p5Source';
import { docLabel, UploadDocModal } from '../components/docs/UploadDocModal';
import { up } from '../components/options/up';
import '../components/finance/finance.css';
import '../components/docs/docs.css';

const InsurancePolicyForm =
  import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED
    ? lazy(() => import('../auth/InsurancePolicyForm'))
    : null;

/** Rodzaje do wgrania przy transporcie (polisy dodaje się raz — formularz polis, G-21). */
const UPLOAD_KINDS: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR'];
const FILE_KINDS: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR', 'INSURANCE', 'POD', 'LASHING_PHOTOS', 'DRAWING', 'INVOICE'];
const MAX_FILES = 60;

/* rok zawsze — właściciel 16.10.2026: „08.10.2026”, „08.10.2026, 12:00”, „01.10.2026–31.10.2026” */
const dmy = (iso: string) => fmtDate(iso);
const dm = (iso: string) => fmtDate(iso);
const atText = (iso: string | null) => (iso ? fmtDateTime(iso) : '—');
const m2 = (n: number) => formatPlNumber(n, 2);

interface ReqRow {
  key: ReqKey;
  label: string;
  who: string;
  due: string;
  over: DocStatusRow[] | null;
  soon: DocStatusRow[] | null;
  /** Polisa HHL bez wpisu — „brak” zamiast liczby. */
  missingPolicy: boolean;
  note: string;
  noteGood: boolean;
}

function policyNote(locale: Locale, p: PolicyView): string {
  return ftp(locale, p.approved ? 'p5_doc_n_policy' : 'p5_doc_n_policy_wait', { number: p.number, date: dmy(p.validTo) });
}

export function DocsView() {
  const documents = useTowerStore((s) => s.documents);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role) as RoleId;
  const phone = useIsPhone();
  const nowMs = getNowMs();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [upload, setUpload] = useState(false);
  const [open, setOpen] = useState<{ key: ReqKey; kind: 'over' | 'soon' } | null>(null);
  const [filter, setFilter] = useState<FileFilter>({ week: '', loadId: '', category: '' });
  const [packOpen, setPackOpen] = useState(false);
  const packRef = useRef<HTMLDivElement>(null);
  /* III-6: wymagalność i stan z bazy (produkcja) albo wartości startowe (demo) — odczyt bez zmian */
  const [reqs, setReqs] = useState<DocRequirement[]>(DEFAULT_DOC_REQUIREMENTS);
  const [serverStatus, setServerStatus] = useState<DocStatusRow[] | null>(null);
  const [insuranceCover, setInsuranceCover] = useState<{ covered: number; total: number } | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let alive = true;
    void import('../data/docRequirementsServer')
      .then((m) => m.loadDocRequirements())
      .then((r) => {
        if (!alive) return;
        if (r.reqs.length) setReqs(r.reqs);
        setServerStatus(r.status);
        setDocReqCache(r.reqs.length ? r.reqs : DEFAULT_DOC_REQUIREMENTS, r.status);
        if (r.projectId) {
          void import('../data/insuranceCoverServer')
            .then((ic) => ic.loadInsuranceCover(r.projectId))
            .then((rows) => {
              if (!alive) return;
              setInsuranceCover({ covered: rows.filter((x) => x.covered).length, total: rows.length });
            })
            .catch(() => { if (alive) setInsuranceCover(null); });
        }
      })
      .catch(() => { /* brak odczytu → wartości startowe, stan liczony lokalnie */ });
    return () => { alive = false; };
  }, [documents.length]);
  useEffect(() => {
    if (!packOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !packRef.current?.contains(e.target as Node)) setPackOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', close); };
  }, [packOpen]);

  const statusRows = useMemo(() => serverStatus ?? docStatusRows(loads, documents, reqs, nowMs), [serverStatus, loads, documents, reqs, nowMs]);
  const byId = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const nameOf = (id: string) => { const l = byId.get(id); return l ? transportLabel(l, role) : id; };
  const policies = policiesOf();
  const permits = useMemo(() => permitsOf(loads), [loads]);
  const canUpload = role === 'HHL' || role === 'SCX';

  const rows: ReqRow[] = useMemo(() => {
    const out: ReqRow[] = [];
    for (const key of REQ_KEYS) {
      if (!reqVisible(key, role)) continue;
      if (key === 'INSURANCE' || key === 'OCS') {
        const org = key === 'INSURANCE' ? 'SCX' : 'HHL';
        const pol = policies?.find((p) => p.org === org) ?? null;
        const covered = key === 'INSURANCE' && insuranceCover ? insuranceCover : null;
        out.push({
          key,
          label: ft(locale, `p5_doc_r_${key}`),
          who: ft(locale, `p5_doc_who_${key}`),
          due: ft(locale, 'p5_doc_due_policy'),
          over: null,
          soon: null,
          /* „brak” tylko przy danych z bazy — bez nich nic nie twierdzimy o polisie HHL */
          missingPolicy: key === 'OCS' && policies != null && !pol,
          note: pol ? policyNote(locale, pol) : covered ? ftp(locale, 'p5_doc_n_cover', covered) : key === 'OCS' ? ft(locale, 'p5_doc_n_OCS') : '',
          noteGood: !!pol && pol.approved,
        });
        continue;
      }
      const req = reqs.find((r) => r.category === key) ?? null;
      if (!req || !req.required) continue;
      const cnt = reqCount(statusRows, key, nowMs);
      const cmr = key === 'CMR' ? cmrKind(req) : null;
      const label = cmr ? ft(locale, `p5_doc_r_CMR_${cmr}`) : ft(locale, `p5_doc_r_${key}`);
      const due = cmr === 'SIGNED'
        ? ftp(locale, 'p5_doc_due_CMR_SIGNED', { h: req.offsetHours })
        : t(locale, `iii6_a_${req.anchor}`).replace('{h}', String(req.offsetHours));
      let note = '';
      /* „Firma” podpina się sama — opis dopiero, gdy zezwolenia „Firma / Trasa” są w danych */
      if (key === 'PERMIT_PL' && permits) note = ft(locale, 'p5_doc_n_PERMIT_PL');
      if (key === 'PERMIT_SE') note = ftp(locale, 'p5_doc_n_PERMIT_SE', { n: loads.filter((l) => l.ferry?.departureAt).length, all: loads.length });
      if (cmr) {
        note = ft(locale, `p5_doc_n_CMR_${cmr}`);
        if (cmr === 'SIGNED' && cnt.overdue.length) note += `; ${codesText(cnt.overdue.map((r) => byId.get(r.loadId)?.code ?? r.loadId))}`;
      }
      out.push({ key, label, who: responsibleOrg(req.responsible), due, over: cnt.overdue, soon: cnt.soon, missingPolicy: false, note, noteGood: false });
    }
    return out;
  }, [role, reqs, statusRows, nowMs, locale, loads, byId, policies, insuranceCover, permits]);

  /* paczka tygodnia: tylko dokumenty, które widzi ta firma (RLS i `visibleTo`), od najnowszego tygodnia */
  const weeks = useMemo(() => weeksWithLoads(loads).reverse(), [loads]);
  const [packWeek, setPackWeek] = useState('');
  /* domyślnie bieżący tydzień (jak dziś: `defaultDocWeek`), lista od najnowszego */
  const curWeek = weeks.includes(packWeek) ? packWeek : defaultDocWeek([...weeks].reverse(), new Date(nowMs));
  const downloadWeek = (week: string) => {
    setPackWeek(week);
    setPackOpen(false);
    void downloadDocumentsZip(docsForWeek(documents, loads, week), `WATCH_TOWER_dokumenty_${week}.zip`, (id) => byId.get(id)?.code ?? id).then((r) => {
      useTowerStore.getState().pushToast(tp(locale, 'a6_docs_zip_toast', { n: r.count }), 'MEDIUM');
    });
  };
  const weekShort = (w: string) => `t${weekKeyLabel(w)}`;

  const files = useMemo(() => filterFiles(documents, loads, filter), [documents, loads, filter]);
  const fileLoads = useMemo(() => {
    const ids = new Set(documents.filter((d) => d.loadId && (d.status === 'UPLOADED' || d.status === 'MISMATCH')).map((d) => d.loadId));
    return loads.filter((l) => ids.has(l.id));
  }, [documents, loads]);
  const driverVault = useMemo(() => documents.filter((d) => d.source === 'driver' && d.status === 'UPLOADED'), [documents]);

  const toggle = (key: ReqKey, kind: 'over' | 'soon') => setOpen((o) => (o && o.key === key && o.kind === kind ? null : { key, kind }));
  const countBtn = (r: ReqRow, kind: 'over' | 'soon') => {
    const list = kind === 'over' ? r.over : r.soon;
    if (!list) return <span className="fin-muted">—</span>;
    if (!list.length) return <span>0</span>;
    const on = open?.key === r.key && open.kind === kind;
    return (
      <button
        type="button"
        className={kind === 'over' ? 'doc-count neg' : 'doc-count'}
        aria-expanded={on}
        aria-label={`${ftp(locale, kind === 'over' ? 'p5_doc_list_over' : 'p5_doc_list_soon', { n: list.length })} — ${r.label}`}
        onClick={() => toggle(r.key, kind)}
      >
        {list.length}
      </button>
    );
  };
  const openList = (r: ReqRow) => {
    if (!open || open.key !== r.key) return null;
    const list = open.kind === 'over' ? r.over : r.soon;
    if (!list?.length) return null;
    return (
      <div className="doc-list" data-docreq-list={r.key}>
        <b>{ftp(locale, open.kind === 'over' ? 'p5_doc_list_over' : 'p5_doc_list_soon', { n: list.length })}</b>
        <ul>
          {list.map((x) => (
            <li key={x.loadId} data-content>
              <span className="code">{nameOf(x.loadId)}</span>
              {x.dueAt ? <span className="fin-muted"> · {dm(x.dueAt)}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const packMenu = weeks.length ? (
    <div className="doc-pack" ref={packRef}>
      <button
        type="button"
        className="btn ghost doc-pack-btn"
        data-docs-pack=""
        aria-haspopup="true"
        aria-expanded={packOpen}
        title={ft(locale, 'p5_doc_pack_hint')}
        onClick={() => setPackOpen((o) => !o)}
      >
        {ftp(locale, 'p5_doc_pack', { label: weekShort(curWeek) })} ▾
      </button>
      {packOpen ? (
        <div className="doc-pack-menu" role="group" aria-label={ft(locale, 'p5_doc_pack_h')}>
          <span className="fin-muted">{ft(locale, 'p5_doc_pack_hint')}</span>
          {weeks.map((w) => (
            <button key={w} type="button" data-docs-week={w} aria-current={w === curWeek ? 'true' : undefined} onClick={() => downloadWeek(w)}>
              {weekShort(w)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  const reqTable = (
    <div className="fin-scroll">
      <table className="fin-table doc-req">
        <thead>
          <tr>
            <th>{up(ft(locale, 'p5_doc_col_doc'))}</th>
            <th>{up(ft(locale, 'p5_doc_col_who'))}</th>
            <th>{up(ft(locale, 'p5_doc_col_due'))}</th>
            <th className="num">{up(ft(locale, 'p5_doc_col_over'))}</th>
            <th className="num">{up(ft(locale, 'p5_doc_col_soon'))}</th>
            <th>{up(ft(locale, 'p5_doc_col_note'))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.key}>
              <tr data-docreq={r.key}>
                <td><b>{r.label}</b></td>
                <td>{r.who}</td>
                <td data-docreq-text="">{r.due}</td>
                <td className="num" data-docreq-overdue={r.over ? r.over.length : undefined}>{r.missingPolicy ? <span className="neg" data-docreq-missing>{ft(locale, 'p5_doc_none')}</span> : countBtn(r, 'over')}</td>
                <td className="num" data-docreq-soon={r.soon ? r.soon.length : undefined}>{countBtn(r, 'soon')}</td>
                <td className={r.noteGood ? 'doc-note good' : 'doc-note'} data-content>{r.note}</td>
              </tr>
              {open?.key === r.key ? (
                <tr className="fin-detail-row"><td colSpan={6}>{openList(r)}</td></tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  const reqCards = (
    <div className="fin-cards doc-cards" data-docreq-cards="">
      {rows.map((r) => {
        const over = r.over?.length ?? 0;
        const soon = r.soon?.length ?? 0;
        const isPolicy = r.key === 'INSURANCE' || r.key === 'OCS';
        const kind: 'over' | 'soon' | null = isPolicy ? null : over ? 'over' : soon ? 'soon' : null;
        const tag = isPolicy ? (
          r.missingPolicy ? <span className="fin-tag red">{up(ft(locale, 'p5_doc_tag_none'))}</span>
            : r.noteGood ? <span className="fin-tag go">{up(ft(locale, 'p5_doc_tag_ok'))}</span> : null
        ) : kind === 'over' ? (
          <span className="fin-tag red" data-docreq-card-overdue={over}>{up(ftp(locale, 'p5_doc_tag_over', { n: over }))}</span>
        ) : kind === 'soon' ? (
          <span className="fin-tag warn">{up(ftp(locale, 'p5_doc_tag_soon', { n: soon }))}</span>
        ) : null;
        return (
          <article key={r.key} className="fin-card doc-card" data-docreq-card={r.key}>
            {/* telefon: liczba rozwija listę transportów — cały nagłówek karty jest przyciskiem (cel ≥ 44 px) */}
            {kind ? (
              <button type="button" className="doc-card-btn doc-card-hd" aria-expanded={open?.key === r.key && open.kind === kind} onClick={() => toggle(r.key, kind)}>
                <b>{r.label}</b>{tag}
              </button>
            ) : (
              <header className="doc-card-hd"><b>{r.label}</b>{tag}</header>
            )}
            <p className="fin-muted" data-content>{[r.due, r.note].filter(Boolean).join(' · ')}</p>
            {openList(r)}
          </article>
        );
      })}
    </div>
  );

  const permitBlock = permits && role !== 'KSH' ? (
    <section className="doc-sec" aria-labelledby="doc-perm-h" data-doc-permits>
      <header className="doc-sec-hd">
        <h3 id="doc-perm-h">{ft(locale, 'p5_doc_perm_h')}</h3>
        <div className="spacer" />
        {canUpload ? <button type="button" className="btn ghost" data-doc-permit-add onClick={() => setUpload(true)}>{ft(locale, 'p5_doc_perm_add')}</button> : null}
      </header>
      {phone ? (
        <div className="fin-cards doc-cards">
          {permits.map((p) => (
            <article key={p.id} className="fin-card doc-card" data-doc-permit={p.id}>
              <header className="doc-card-hd"><b data-content>{p.country} · {p.number ?? ft(locale, 'p5_doc_perm_at_load')}</b><span className={p.scope === 'FIRMA' ? 'fin-tag sea' : 'fin-tag warn'}>{up(ft(locale, `p5_doc_perm_${p.scope}`))}</span></header>
              <p className="fin-muted" data-content>
                {[p.appliesTo, p.limits ? `${m2(p.limits.l)} × ${m2(p.limits.w)} × ${m2(p.limits.h)} m` : null, p.validFrom && p.validTo ? fmtDateRange(p.validFrom, p.validTo) : null,
                  ftp(locale, p.scope === 'FIRMA' ? 'p5_doc_perm_auto' : 'p5_doc_perm_manual', { n: p.loads })].filter(Boolean).join(' · ')}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="fin-scroll">
          <table className="fin-table">
            <thead>
              <tr>
                <th>{up(ft(locale, 'p5_doc_perm_c_kind'))}</th>
                <th>{up(ft(locale, 'p5_doc_perm_c_country'))}</th>
                <th>{up(ft(locale, 'p5_doc_perm_c_no'))}</th>
                <th>{up(ft(locale, 'p5_doc_perm_c_valid'))}</th>
                <th>{up(ft(locale, 'p5_doc_perm_c_limits'))}</th>
                <th>{up(ft(locale, 'p5_doc_perm_c_for'))}</th>
                <th className="num">{up(ft(locale, 'p5_doc_perm_c_loads'))}</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((p) => (
                <tr key={p.id} data-doc-permit={p.id}>
                  <td><span className={p.scope === 'FIRMA' ? 'fin-tag sea' : 'fin-tag warn'}>{up(ft(locale, `p5_doc_perm_${p.scope}`))}</span></td>
                  <td>{p.country.replace('+', ' + ')}</td>
                  <td data-content>{p.number ?? <span className="fin-muted">{ft(locale, 'p5_doc_perm_at_load')}</span>}</td>
                  <td>{p.validFrom && p.validTo ? fmtDateRange(p.validFrom, p.validTo) : '—'}</td>
                  <td>{p.limits ? `${m2(p.limits.l)} × ${m2(p.limits.w)} × ${m2(p.limits.h)} m` : '—'}{p.pilot ? ` · ${ftp(locale, 'p5_doc_perm_pilot', { p: p.pilot })}` : ''}</td>
                  <td data-content>{p.appliesTo}</td>
                  <td className="num">{ftp(locale, p.scope === 'FIRMA' ? 'p5_doc_perm_auto' : 'p5_doc_perm_manual', { n: p.loads })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fin-muted doc-pad">{ft(locale, 'p5_doc_perm_note')}</p>
    </section>
  ) : null;

  const filesBlock = (
    <section className="doc-sec" aria-labelledby="doc-files-h" data-doc-files>
      <header className="doc-sec-hd">
        <h3 id="doc-files-h">{ft(locale, 'p5_doc_files_h')}</h3>
        <div className="spacer" />
        <div className="doc-filters">
          <select className="input" aria-label={ft(locale, 'p5_doc_f_week_l')} value={filter.week} data-doc-f="week" onChange={(e) => setFilter((f) => ({ ...f, week: e.target.value }))}>
            <option value="">{ft(locale, 'p5_doc_f_week')}</option>
            {weeks.map((w) => <option key={w} value={w}>{weekShort(w)}</option>)}
          </select>
          <select className="input" aria-label={ft(locale, 'p5_doc_f_load_l')} value={filter.loadId} data-doc-f="load" onChange={(e) => setFilter((f) => ({ ...f, loadId: e.target.value }))}>
            <option value="">{ft(locale, 'p5_doc_f_load')}</option>
            {fileLoads.map((l) => <option key={l.id} value={l.id}>{transportLabel(l, role)}</option>)}
          </select>
          <select className="input" aria-label={ft(locale, 'p5_doc_f_cat_l')} value={filter.category} data-doc-f="cat" onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value as DocCategory | '' }))}>
            <option value="">{ft(locale, 'p5_doc_f_cat')}</option>
            {FILE_KINDS.map((c) => <option key={c} value={c}>{docLabel(locale, c)}</option>)}
          </select>
        </div>
      </header>
      {files.length === 0 ? (
        <p className="fin-muted doc-pad">{ft(locale, 'p5_doc_files_empty')}</p>
      ) : phone ? (
        <div className="doc-pad doc-file-rows">
          {files.slice(0, MAX_FILES).map((d) => (
            <DocFileRow key={d.id} doc={d} label={`${d.loadId ? nameOf(d.loadId) : ft(locale, 'p5_doc_whole')} · ${docLabel(locale, d.category)}`} onPreview={setPreviewDoc} />
          ))}
        </div>
      ) : (
        <div className="fin-scroll">
          <table className="fin-table doc-files">
            <thead>
              <tr>
                <th>{up(ft(locale, 'p5_doc_fc_file'))}</th>
                <th>{up(ft(locale, 'p5_doc_fc_for'))}</th>
                <th>{up(ft(locale, 'p5_doc_fc_cat'))}</th>
                <th>{up(ft(locale, 'p5_doc_fc_at'))}</th>
                <th>{up(ft(locale, 'p5_doc_fc_seen'))}</th>
              </tr>
            </thead>
            <tbody>
              {files.slice(0, MAX_FILES).map((d) => (
                <tr key={d.id} data-doc-file={d.id} className={d.status === 'MISMATCH' ? 'is-warn' : undefined}>
                  <td data-content>
                    <button type="button" className="linkbtn" onClick={() => setPreviewDoc(d)}>{d.name}</button>
                  </td>
                  <td data-content>{d.loadId ? nameOf(d.loadId) : ft(locale, 'p5_doc_whole')}</td>
                  <td>{docLabel(locale, d.category)}</td>
                  <td>{atText(d.uploadedAt)}</td>
                  <td>{seenBy(d.visibleTo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {files.length > MAX_FILES ? <p className="fin-muted doc-pad">{ftp(locale, 'p5_doc_files_more', { n: MAX_FILES, all: files.length })}</p> : null}
      <p className="fin-muted doc-pad">{ft(locale, 'p5_doc_files_note')}</p>
    </section>
  );

  return (
    <div className="fin-page doc-page" data-page="docs">
      <section className="panel fin-panel" aria-labelledby="doc-title">
        <header className="fin-head doc-head">
          <h2 id="doc-title">{t(locale, 'nav_docs')}</h2>
          {phone ? <span className="fin-cur">{role}</span> : <span className="sub">{ft(locale, 'p5_doc_sub')}</span>}
          {phone ? null : (
            <div className="doc-head-acts">
              {canUpload ? <button type="button" className="btn" data-doc-upload onClick={() => setUpload(true)}>{ft(locale, 'p5_doc_upload')}</button> : null}
              {packMenu}
            </div>
          )}
        </header>
        {phone && canUpload ? (
          <div className="doc-pad">
            <button type="button" className="btn doc-upload-big" data-doc-upload onClick={() => setUpload(true)}>{ft(locale, 'p5_doc_upload_phone')}</button>
          </div>
        ) : null}
        <section className="doc-sec" aria-labelledby="doc-req-h">
          <header className="doc-sec-hd"><h3 id="doc-req-h">{ft(locale, 'p5_doc_req_h')}</h3></header>
          {phone ? reqCards : reqTable}
          <p className="fin-muted doc-pad" data-docreq-note="">{ft(locale, 'p5_doc_req_note')}</p>
        </section>
        {permitBlock}
        {filesBlock}
        {phone && packMenu ? <div className="doc-pad doc-pack-phone">{packMenu}</div> : null}
        {driverVault.length > 0 ? (
          <div className="note" data-vault="driver">
            {t(locale, 'a6_docs_driver_vault')}
            <div style={{ marginTop: 6 }}>
              {driverVault.map((d) => (
                <DocFileRow key={d.id} doc={d} label={docLabel(locale, d.category)} onPreview={setPreviewDoc} />
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {/* polisy dodaje się raz (G-21): formularz z bazy — SCX wpisuje, HHL zatwierdza */}
      {InsurancePolicyForm && canUpload ? (
        <section className="panel fin-panel" aria-labelledby="doc-pol-h">
          <header className="panel-hd fin-hd2"><h3 id="doc-pol-h">{ft(locale, 'p5_doc_policies_h')}</h3></header>
          <Suspense fallback={null}><InsurancePolicyForm /></Suspense>
        </section>
      ) : null}
      {upload && canUpload ? (
        <UploadDocModal
          locale={locale}
          role={role as 'HHL' | 'SCX'}
          phone={phone}
          loads={loads}
          statusRows={statusRows}
          allowed={UPLOAD_KINDS}
          onClose={() => setUpload(false)}
        />
      ) : null}
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
