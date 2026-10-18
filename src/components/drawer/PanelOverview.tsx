/**
 * wyglad/P7-a — panel transportu › „Przegląd” (E32, img/e32-after; decyzje 08.10 12:14, 09.10 12:33 i 13:09).
 * Kolejność dla wszystkich firm: „Do zrobienia przy tym transporcie” (lista E7 z firmą i terminem, przycisk tylko dla firmy,
 * która to robi; KSH — linia stanu), mapa, Plan i ETA (dzień tygodnia, „godzina nie podana”, pochodzenie dat, blok ETA E15),
 * Awizacja albo Kierowcy i zestaw (E6: odcinki, „Zadzwoń”, wyróżniony odcinek; naczepa, link śledzenia, rejs; piloci przy
 * „PL + SE”), Ładunek i zestaw (z tabeli właściciela, D-83), Numery zleceń (E41), Dokumenty w skrócie (E31), PDF.
 * Znika: „Kontrola trasy”, „Przeszkody”, profil trasy (E17), czerwony baner zezwolenia, „potwierdził KSH” bez osoby.
 * Telefon: Do zrobienia na górze, mapa 150 px, sekcje zwinięte z linią stanu, „Zadzwoń” 44 px.
 * Zapis jak dziś (numer SCX, okno Awizacja, okno dat KSH); nowe dane — `p7Source.ts`.
 */
import { READY_PREP } from '../../lib/readyGaps';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Document, Load, LoadEvent, Locale, OrgKind, Risk, Sailing } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { t, fmtNum } from '../../i18n/messages';
import { pt, ptn, ptp } from '../../i18n/p7';
import { buildTodo, visibleTodoRisks, type TodoIssue } from '../../lib/p6Todo';
import { openTodoRisks } from '../../lib/todoRules';
import { sampleDecisionsOf } from '../../lib/p6Source';
import { issueTexts, type CardCtx } from '../risks/TodoCard';
import { awizDeadline, awizMissing, awizState, dayLong, dmHm, hourWindow, warsawDay } from '../../lib/p7Awiz';
import { activeLeg, driverPhoneView } from '../../lib/activeDriver';
import { canFixAwizOf, pilotsOf, saveSetOf, symbolSpecOf, type SetDims } from '../../lib/p7Source';
import { checkSet, setFieldValue, type SetKey } from '../../lib/p7bSet';
import { whoOf } from '../../lib/p6History';
import { visibleDriverPhone } from '../../lib/permissions';
import { editableOrderSide } from '../../lib/orderNumbers';
import { SITES } from '../../lib/status';
import { effArrival, effDeparture, fmtLocal, sailingStatusLabel } from '../../lib/sailings';
import { getDocReqCache } from '../../lib/docReqCache';
import { docStatusRows } from '../../lib/docRequirements';
import { cmrKind, reqVisible } from '../../lib/p5Docs';
import { docRequirementsStart, policiesOf } from '../../lib/p5Source';
import { trackingLinkOf } from '../../lib/p4cSource';
import { EtaBlock } from './EtaBlock';
import type { EtaWx } from '../../lib/e49Wx';
import { OptionsHowTo } from '../settings/OptionsHowTo';
import './p7.css';
import { formatCalendarDay } from '../../lib/time';
import { stageTileOf } from '../../lib/stageTiles';

type Role = 'HHL' | 'KSH' | 'SCX';

interface Props {
  load: Load;
  loads: readonly Load[];
  role: Role;
  locale: Locale;
  phone: boolean;
  nowIso: string;
  events: readonly LoadEvent[];
  docs: readonly Document[];
  risks: readonly Risk[];
  sailings: readonly Sailing[];
  insAuto: { covered: boolean; policyNo: string | null; validUntil: string | null } | null;
  deliveredAt: string | null;
  siteSince: string | null;
  delayMin: number | null;
  /** wyglad/E49: linie wiatru / postoju / objazdu w bloku ETA. */
  wx?: readonly EtaWx[];
  mapNode: ReactNode;
  ratingNode: ReactNode;
  onAwiz: () => void;
  onKshDates: () => void;
  onTab: (tab: 'docs' | 'pricing' | 'timeline') => void;
  onPdf: () => void;
}

const dim = (n: number | null | undefined, locale: Locale) => (n == null ? '—' : fmtNum(locale, n, 2));
const dmy = (iso: string) => formatCalendarDay(iso.slice(0, 10));
const ORG_SHORT: Record<OrgKind, string> = { HHL: 'HHL', SCX: 'SCX', KSH: 'KSH' };
/** Sprawy zezwolenia w danych demo bez klucza słownika („Brak zezwolenia SE”, „Zezwolenie nie obejmuje wymiarów zestawu”). */
const PERMIT_TODO = /^(Brak zezwolenia|Zezwolenie nie obejmuje)/;

/** Sekcja: na komputerze otwarta z nagłówkiem; na telefonie zwinięta z linią stanu (E32 „Telefon”). */
function Sec({ id, phone, title, extra, status, right, children }: {
  id: string; phone: boolean; title: string; extra?: ReactNode; status?: ReactNode; right?: ReactNode; children: ReactNode;
}) {
  if (phone) {
    return (
      <details className="po-sec po-fold" data-po={id}>
        <summary>
          <span className="po-fold-t"><b>{title}</b>{status ? <span className="po-fold-s">{status}</span> : null}</span>
          {right ? <span className="po-fold-r">{right}</span> : null}
          <span className="po-fold-i" aria-hidden="true">▾</span>
        </summary>
        <div className="po-fold-b">{children}</div>
      </details>
    );
  }
  return (
    <section className="po-sec" data-po={id}>
      <div className="po-sec-hd">
        <h3 className="po-h">{title}{extra ? <span className="po-h-x">{extra}</span> : null}</h3>
        {right ? <span className="po-sec-r">{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * P11 (e32, e41): własny numer zlecenia — wpisany jako tekst z „Edytuj”, brak jako czerwone „brak” z „Dodaj”;
 * pole z „Zapisz” i „Anuluj” dopiero po kliknięciu (Escape zamyka i wraca do przycisku).
 */
function OrderNoField({ value, onSave, locale }: { value?: string | null; onSave: (v: string | null) => void; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const input = useRef<HTMLInputElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) btn.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (!open) {
    return (
      <span className="po-order-v">
        {value ? <b className="mono">{value}</b> : <span className="po-miss">{pt(locale, 'p7_num_missing')}</span>}
        <button ref={btn} type="button" className="btn ghost po-inline" data-order-edit onClick={() => { setDraft(value ?? ''); setOpen(true); }}>
          {pt(locale, value ? 'p7_num_edit' : 'p7_num_add')}
        </button>
      </span>
    );
  }
  return (
    <form
      className="po-order-f"
      onSubmit={(e) => {
        e.preventDefault();
        if ((draft.trim() || null) !== (value ?? null)) onSave(draft.trim() || null);
        setOpen(false);
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
    >
      <input ref={input} className="input mono" value={draft} placeholder={t(locale, 'a6_dr_not_filled')} onChange={(e) => setDraft(e.target.value)} aria-label={t(locale, 'a6_dr_order_no')} />
      <button type="submit" className="btn ghost">{t(locale, 'a6_dr_save')}</button>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{pt(locale, 'p7_num_cancel')}</button>
    </form>
  );
}

const noop = () => undefined;

/**
 * wyglad/P7-b — „Zmień” przy „Zestaw z ładunkiem” (E32 pkt 7, img/e32-after: „21,69 × 2,45 × 3,75 m [Zmień]”; E9 D-83:
 * zmienia HHL Administrator i HHL Operacje). Formularz w miejscu: 3 pola w metrach, „Zapisz”, „Anuluj”, a przy własnych
 * wymiarach — „Przywróć z tabeli”. Escape zamyka i wraca do „Zmień”. Zapis — `saveSetOf` (wykonawca, P7).
 */
function SetField({ loadId, value, own, sym, save, locale, children }: {
  loadId: string;
  value: SetDims | null;
  own: boolean;
  sym: string | null;
  save: ((loadId: string, set: SetDims | null) => Promise<{ ok: boolean; error?: string }>) | null;
  locale: Locale;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<SetKey, string>>({ l: '', w: '', h: '' });
  const [err, setErr] = useState<{ text: string; bad: SetKey[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const errId = `po-set-err-${loadId}`;
  useEffect(() => {
    if (open) first.current?.focus();
    else if (wasOpen.current) btn.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const start = () => {
    setVals({ l: setFieldValue(value?.l), w: setFieldValue(value?.w), h: setFieldValue(value?.h) });
    setErr(null); setNote(null); setOpen(true);
  };
  const run = (set: SetDims | null) => {
    if (!save || busy) return;
    setBusy(true);
    void save(loadId, set).then((r) => {
      setBusy(false);
      if (r.ok) { setOpen(false); setNote(pt(locale, 'p7_set_saved')); } else setErr({ text: pt(locale, 'p7_set_fail'), bad: [] });
    }, () => { setBusy(false); setErr({ text: pt(locale, 'p7_set_fail'), bad: [] }); });
  };
  const submit = () => {
    const c = checkSet(vals.l, vals.w, vals.h);
    if (c.ok) { run(c.set); return; }
    setErr({ text: pt(locale, c.error === 'fmt' ? 'p7_set_err_fmt' : 'p7_set_err_range'), bad: c.bad });
  };
  const status = <span className="po-sub po-ok" role="status">{note ?? ''}</span>;
  if (!open || !save) {
    return (
      <>
        <span className="po-set-v">
          {children}
          {save ? (
            <button ref={btn} type="button" className="btn ghost po-set-btn" data-po-set-edit aria-label={pt(locale, 'p7_set_edit_aria')} onClick={start}>
              {pt(locale, 'p7_set_edit')}
            </button>
          ) : null}
        </span>
        {status}
      </>
    );
  }
  const field = (id: SetKey) => {
    const bad = !!err && err.bad.includes(id);
    return (
      <label className="po-set-f">
        <span>{pt(locale, `p7_set_${id}`)}</span>
        <span className="po-set-in">
          <input
            ref={id === 'l' ? first : undefined}
            className="input mono"
            inputMode="decimal"
            autoComplete="off"
            value={vals[id]}
            aria-invalid={bad || undefined}
            aria-describedby={err ? errId : undefined}
            onChange={(e) => { const v = e.target.value; setVals((x) => ({ ...x, [id]: v })); setErr(null); }}
          />
          <span aria-hidden="true">m</span>
        </span>
      </label>
    );
  };
  return (
    <form
      className="po-set-form"
      data-po-set-form
      aria-busy={busy || undefined}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      /* Escape zamyka tylko formularz — nie cały panel transportu (App.tsx nasłuchuje Escape na oknie) */
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); } }}
    >
      <fieldset>
        <legend className="sr-only">{pt(locale, 'p7_set_legend')}</legend>
        <div className="po-set-fs">
          {field('l')}
          {field('w')}
          {field('h')}
        </div>
        {err ? <p className="po-set-err" id={errId} role="alert">{err.text}</p> : null}
        <div className="po-set-acts">
          <button type="submit" className="btn" aria-disabled={busy || undefined}>{pt(locale, 'p7_set_save')}</button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{pt(locale, 'p7_set_cancel')}</button>
          {own && sym ? <button type="button" className="btn ghost" data-po-set-reset aria-disabled={busy || undefined} onClick={() => run(null)}>{ptp(locale, 'p7_set_reset', { sym })}</button> : null}
        </div>
      </fieldset>
    </form>
  );
}

export function PanelOverview(p: Props) {
  const { load, loads, role, locale, phone, nowIso, events, docs, risks, sailings } = p;
  const setOrderNo = useTowerStore((s) => s.setOrderNo);
  const spec = symbolSpecOf(load);
  const pilotsReq = !!spec?.pilots;
  const pilots = pilotsReq ? pilotsOf(load) : null;
  const r = load.resources;
  const missing = awizMissing(r, pilotsReq, pilots);
  const awiz = awizState(r, missing);
  const deadline = awizDeadline(load.plannedLoadDate, nowIso, load.planDates?.loadFrom ?? null);
  const today = warsawDay(nowIso) === (load.plannedLoadDate ?? '').slice(0, 10);
  const orderSide = editableOrderSide(role);
  const curSailing = sailings.find((x) => x.id === load.sailingId);

  /* ---------- Numery i dokumenty (E32 pkt 8, E41, E31) — przed „Do zrobienia”: ten sam stan zezwoleń i polisy ---------- */
  const hhlNo = (load.hhlOrderNo ?? '').trim();
  const scxNo = (load.carrierOrderNo ?? '').trim();
  const cached = getDocReqCache();
  const prod = import.meta.env.VITE_AUTH_MODE === 'supabase';
  const reqs = cached?.reqs ?? docRequirementsStart();
  const rows = cached ? cached.status.filter((x) => x.loadId === load.id) : prod ? [] : docStatusRows([load], [...docs], reqs, Date.parse(nowIso));
  const doc = (c: string) => docs.find((d) => d.category === c && (d.status === 'UPLOADED' || d.status === 'MISMATCH') && !d.superseded);
  const row = (c: string) => rows.find((x) => x.category === c);
  /* E31 (G-01c, L30): „Firma” — jedno zezwolenie firmowe wystarcza; „Trasa” — PL i SE przy transporcie */
  const permitFirm = spec?.permit === 'FIRMA';
  const permitState: 'mismatch' | 'ok' | 'missing' = load.permitFits === false || docs.some((d) => d.category.startsWith('PERMIT') && d.status === 'MISMATCH')
    ? 'mismatch' : (permitFirm ? !!(doc('PERMIT_PL') ?? doc('PERMIT_SE')) : !!(doc('PERMIT_PL') && doc('PERMIT_SE'))) ? 'ok' : 'missing';
  const permitRows = [row('PERMIT_PL'), row('PERMIT_SE')].filter((x): x is NonNullable<typeof x> => !!x && x.state !== 'OK');
  const permitRow = permitRows.find((x) => x.state === 'OVERDUE')
    ?? [...permitRows].sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))[0];
  const permitText = permitState === 'mismatch' ? pt(locale, 'p7_doc_mismatch')
    : permitState === 'ok' ? pt(locale, 'p7_doc_ok')
      : permitRow?.state === 'OVERDUE' ? pt(locale, 'p7_doc_over')
        : permitRow?.dueAt ? ptp(locale, 'p7_doc_due', { date: dmHm(permitRow.dueAt) }) : pt(locale, 'p7_doc_missing');
  const cmrDoc = doc('CMR');
  const cmrRow = row('CMR');
  const cmrSigned = cmrKind(reqs.find((x) => x.category === 'CMR')) === 'SIGNED';
  const cmrState: 'ok' | 'over' | 'wait' = cmrDoc ? 'ok' : cmrRow?.state === 'OVERDUE' ? 'over' : 'wait';
  const cmrText = cmrState === 'ok' ? pt(locale, 'p7_doc_ok') : cmrState === 'over' ? pt(locale, 'p7_doc_over')
    : cmrRow?.dueAt ? ptp(locale, 'p7_doc_due', { date: dmHm(cmrRow.dueAt) }) : pt(locale, cmrSigned ? 'p7_doc_cmr_after_unload' : 'p7_doc_cmr_after');
  const policies = policiesOf();
  const policyRow = (key: 'INSURANCE' | 'OCS') => {
    if (!reqVisible(key, role)) return null;
    const org = key === 'INSURANCE' ? 'SCX' : 'HHL';
    const pv = policies?.find((x) => x.org === org) ?? null;
    const fromDb = key === 'INSURANCE' && p.insAuto?.covered && p.insAuto.policyNo ? p.insAuto : null;
    const ok = pv ? ptp(locale, 'p7_doc_policy', { number: pv.number, date: dmy(pv.validTo) })
      : fromDb ? ptp(locale, 'p7_doc_policy', { number: fromDb.policyNo!, date: fromDb.validUntil ? dmy(fromDb.validUntil) : '—' }) : null;
    /* ta sama reguła co zakładka Dokumenty (PanelDocs): polisa HHL bez danych z bazy — „—”, nie „brak”; SCX — dopóki nie wczytano */
    const unknown = !ok && policies == null && (key === 'OCS' || !p.insAuto);
    return { key, ok, unknown };
  };
  /* E32 (img/e32-after „Dokumenty”): w skrócie tylko polisa przewoźnika; polisa HHL — w zakładce Dokumenty (E31) */
  const pols = [policyRow('INSURANCE')].filter((x): x is NonNullable<ReturnType<typeof policyRow>> => !!x);
  const docMiss = (permitState !== 'ok' ? 1 : 0) + (cmrState === 'over' ? 1 : 0) + pols.filter((x) => !x.ok && !x.unknown).length;


  /* ---------- Do zrobienia przy tym transporcie (E32 pkt 2; lista E7) ---------- */
  /* bez useMemo: zależy też od stanu zezwolenia liczonego wyżej przy każdym rysowaniu; jeden transport — koszt pomijalny */
  const card = (() => {
    if (role === 'KSH') return null;
    /* właściciel 18.10, 11:35: bez spraw już zrobionych (dane wpisane w panelu, transport dostarczony) — `todoRules.todoDoneOnLoad` */
    const own = visibleTodoRisks(role, openTodoRisks(risks.filter((x) => x.loadId === load.id), loads))
      /* demo: „Brak zezwolenia” / „niezgodne z zestawem” znika, gdy sekcja „Dokumenty” pokazuje zezwolenie „jest”.
         Produkcja: alarm braku dokumentu (`rk_res_docs`) zamyka baza — dopiero przy zezwoleniach zarejestrowanych
         w `load_permits` (0143 `l3_scan`), nie przy samym wgranym pliku; widok go nie chowa (F7 #300 B1) */
      .filter((x) => !(!prod && permitState === 'ok' && (x.titleKey === 'rk_seed_permit' || PERMIT_TODO.test(x.title))));
    /* „Brak awizacji” znika, gdy awizacja jest kompletna (ten sam stan co sekcja „Kierowcy i zestaw”) */
    const decs = sampleDecisionsOf(loads, nowIso, role).filter((d) => d.loadId === load.id && !(d.typeCode === 'NO_AWIZACJA' && awiz === 'ok'));
    return buildTodo({ risks: own, decisions: decs, nowIso }).find((c) => c.loadId === load.id) ?? null;
  })();
  const ctx: CardCtx | null = role === 'KSH' ? null : {
    role, locale, phone, nowIso, loadOf: (id) => loads.find((x) => x.id === id), assignOn: false, assignee: () => null, me: null,
    peopleOf: () => null, historyOf: () => null, onTake: noop, onGive: noop, onTakeover: noop, confirmId: null, onConfirm: noop,
    onCancelConfirm: noop, onGo: noop, onFee: noop, checkHandlers: () => ({}), decisions: null, mayResolve: () => false, onResolved: noop,
    /* wyglad/E49: „Objazd czy postój?” rozstrzyga SCX na stronie Ryzyka — w panelu tylko podgląd */
    detourHandlers: () => ({ canDecide: false, busy: false, onDecide: null }),
  };
  /* E32 pkt 2, E9 krok 5: numer HHL wpisuje HHL w „Numerach zleceń”, bez okna Awizacja i bez kompletnej awizacji */
  const goHhlNo = () => {
    const fold = document.querySelector<HTMLDetailsElement>('.drawer details[data-po="numbers"]');
    if (fold) fold.open = true;
    const el = document.querySelector<HTMLInputElement>('.drawer [data-order="hhl"] input');
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  };
  const action = (i: TodoIssue): ReactNode => {
    if (i.owner !== role) return <span className="po-chip">{ORG_SHORT[i.owner]}</span>;
    if (i.go === 'AWIZACJA') {
      if (role === 'SCX') return <button type="button" className="btn ghost" data-po-act="awiz" onClick={p.onAwiz}>{pt(locale, 'p7_todo_awiz')}</button>;
      if (role === 'HHL' && i.risk?.titleKey?.startsWith('rk_order_no_hhl') && !(load.hhlOrderNo ?? '').trim()) return <button type="button" className="btn" data-po-act="hhl-no" onClick={goHhlNo}>{pt(locale, 'p7_todo_add')}</button>;
    }
    if (i.go === 'DOCS') return <button type="button" className="btn ghost" data-po-act="docs" onClick={() => p.onTab('docs')}>{pt(locale, 'p7_todo_upload')}</button>;
    if (i.go === 'PRICING' || i.go === 'FEE') return <button type="button" className="btn ghost" data-po-act="pricing" onClick={() => p.onTab('pricing')}>{pt(locale, 'p7_todo_prices')}</button>;
    return <span className="po-chip">{ORG_SHORT[i.owner]}</span>;
  };
  const sub = (i: TodoIssue): string => {
    const parts: string[] = [ORG_SHORT[i.owner]];
    if (i.go === 'AWIZACJA' && deadline && deadline.phase !== 'early') parts.push(ptp(locale, deadline.phase === 'urgent' ? 'p7_todo_urgent' : 'p7_todo_due', { date: dmHm(deadline.urgentAt) }));
    else if (i.overdue) parts.push(pt(locale, 'p7_todo_over'));
    else if (i.dueAt) parts.push(ptp(locale, 'p7_todo_due', { date: dmHm(i.dueAt) }));
    return parts.join(' · ');
  };
  const red = !!card && (card.overdue || card.severity === 'CRITICAL' || card.severity === 'HIGH');
  const todoItems = card && ctx ? (
    <ul className="po-todo-l">
      {card.issues.map((i) => {
        const tx = issueTexts(i, ctx);
        return (
          <li key={i.id} className="po-todo-i" data-po-issue={i.go}>
            <div className="po-todo-tx">
              <b data-content>{tx.name}</b>
              <span>{sub(i)}</span>
            </div>
            <div className="po-todo-a">{action(i)}</div>
          </li>
        );
      })}
    </ul>
  ) : null;
  /* właściciel 18.10, 11:35 i 11:46: na telefonie zwija się tylko „Do zrobienia” (jak sekcje niżej) — zwinięte, w linii stanu
     pierwsza sprawa i liczba pozostałych; czerwony lub bursztynowy pasek zostaje. Komputer bez zmian. */
  const first = card && ctx ? issueTexts(card.issues[0], ctx).name : '';
  const todoBox = card && ctx ? (
    phone ? (
      <details className={`po-todo po-fold${red ? ' is-red' : ''}`} data-po="todo" data-po-todo={card.issues.length}>
        <summary>
          <span className="po-fold-t">
            <b>{ptp(locale, 'p7_todo_h_phone', { n: card.issues.length })}</b>
            <span className="po-todo-s" data-content>
              {first}{card.issues.length > 1 ? ` · ${ptn(locale, 'p7_todo_more', card.issues.length - 1)}` : ''}
            </span>
          </span>
          {today ? <span className="po-today">{pt(locale, 'p7_todo_today')}</span> : null}
          <span className="po-fold-i" aria-hidden="true">▾</span>
        </summary>
        {todoItems}
      </details>
    ) : (
      <section className={`po-todo${red ? ' is-red' : ''}`} data-po-todo={card.issues.length} aria-label={ptp(locale, 'p7_todo_h', { n: card.issues.length })}>
        <div className="po-todo-hd">
          <b>{ptp(locale, 'p7_todo_h', { n: card.issues.length })}</b>
          {today ? <span className="po-today">{pt(locale, 'p7_todo_today')}</span> : null}
        </div>
        {todoItems}
      </section>
    )
  ) : null;
  const kshLine = role === 'KSH' ? (
    <p className={`po-kshline is-${awiz}`} data-po-ksh-line={awiz}>
      {awiz === 'ok' ? pt(locale, 'p7_ksh_line_awiz_ok')
        : awiz === 'part' ? ptp(locale, 'p7_ksh_line_awiz_part', { what: missing.map((m) => pt(locale, `p7_miss_${m}`)).join(', ') })
          : pt(locale, 'p7_ksh_line_awiz_none')}
    </p>
  ) : null;

  /* ---------- Plan i ETA (E32 pkt 4) ---------- */
  const pd = load.planDates;
  const loadHours = hourWindow(pd?.loadFrom ?? load.awizacja.loadWindowStart, pd?.loadTo ?? load.awizacja.loadWindowEnd);
  const delHours = hourWindow(pd?.deliveryFrom ?? load.awizacja.unloadWindowStart, pd?.deliveryTo ?? load.awizacja.unloadWindowEnd);
  const origin = useMemo(() => {
    const sorted = [...events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const ch = sorted.find((e) => e.type === 'PLAN_DATES_CHANGED' && e.actor && !/^(system|import)$/i.test(e.actor));
    if (ch) return ptp(locale, 'p7_dates_changed', { who: whoOf(ch.actor, locale), at: dmHm(ch.at) });
    const imp = sorted.find((e) => e.type === 'SCHEDULE_IMPORTED')?.at ?? pd?.confirmedAt ?? null;
    return imp ? ptp(locale, 'p7_dates_import', { at: dmHm(imp) }) : pt(locale, 'p7_dates_import_plain');
  }, [events, pd?.confirmedAt, locale]);
  const dateVal = (day: string | null | undefined, hours: string | null) => (
    /* „czw. 16.10.2026, 08:00–12:00” — zakres godzin w jednym dniu (właściciel 16.10.2026) */
    day ? <><b>{dayLong(day)}</b>{hours ? `, ${hours}` : ` · ${pt(locale, 'p7_no_hour')}`}</> : <span className="po-miss">{pt(locale, 'p7_no_date')}</span>
  );
  const etaShort = !load.etaBoden || load.etaPreLoad ? '–' : dmHm(load.etaBoden);
  /* P11 (e32): na placu — „Na placu od …” (wjazd do strefy, a bez niego początek czekania przed placem — jak dopisek na mapie) */
  const siteSincePh = stageTileOf(load) === 'SITE' ? p.siteSince ?? load.etaDetail?.waitSince ?? null : null;

  /* ---------- Awizacja / Kierowcy i zestaw (E32 pkt 5–7, E6) ---------- */
  const phoneOk = !!visibleDriverPhone(role, load);
  /* wyglad/E6-tel (16.10, 13:34): przy przepięciu wyróżniony (i pierwszy) kierowca, który teraz wykonuje transport — ten sam wybór co „☎” w Harmonogramie */
  const segNow: 'PL' | 'SE' | null = load.resources.trailerSwap ? activeLeg(load) : null;
  const hasDriver = !!(r.driverName ?? '').trim();
  const swap = !!r.trailerSwap;
  /* dwa odcinki tylko przy przepięciu naczepy (E6: bez przepięcia jeden kierowca „odbiór i dostawa”) */
  const twoSeg = swap;
  const driverCard = (seg: 'one' | 'PL' | 'SE', name: string | null | undefined, tel: string | null | undefined, tractor: string | null | undefined, country?: 'PL' | 'SE') => {
    /* audyt-B B-12: jedyny kierowca (bez przepięcia) to ten, który teraz wiezie ładunek — pełny „Zadzwoń”;
       dopisek „· teraz” tylko przy dwóch odcinkach (wskazuje jeden z nich) */
    const now = seg === 'one' || (seg === 'PL' && segNow === 'PL') || (seg === 'SE' && segNow === 'SE');
    const label = pt(locale, seg === 'one' ? 'p7_seg_one' : seg === 'PL' ? 'p7_seg_pl' : 'p7_seg_se');
    /* audyt-B B-12 / F-06: numer jak w Harmonogramie („+48 000 000 004”) — ta sama funkcja co activeDriver().display */
    const ph = driverPhoneView(tel, country);
    return (
      <div className={`po-drv${now ? ' is-now' : ''}`} data-po-driver={seg}>
        <div className="po-drv-tx">
          <span className="po-drv-l">{label}{now && seg !== 'one' ? ` · ${pt(locale, 'p7_seg_now')}` : ''}</span>
          <span className="po-drv-v">
            <b data-content>{(name ?? '').trim() || '—'}</b>
            {phoneOk && ph.dial ? <span className="mono" data-content data-po-tel>{` · ${ph.display}`}</span> : null}
            {(tractor ?? '').trim() ? <>{` · ${pt(locale, 'p7_tractor_w')} `}<b className="mono" data-content>{tractor}</b></> : null}
          </span>
        </div>
        {phoneOk && ph.dial ? (
          <a className={`btn ${now ? '' : 'ghost'} po-call`} href={`tel:${ph.dial}`} aria-label={ptp(locale, 'p7_call_aria', { name: (name ?? '').trim() || '—' })}>☎ {pt(locale, 'p7_call')}</a>
        ) : null}
      </div>
    );
  };
  const sailingText = curSailing
    ? `${load.ferry.vessel ?? curSailing.vessel} · ${fmtLocal(effDeparture(curSailing))} → ${fmtLocal(effArrival(curSailing))}${curSailing.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(curSailing.status, locale)}` : ''}`
    : null;
  /* F7 (A9): statek z rezerwacji bez wybranego rejsu — to nie jest przypisany rejs; „rejs” jest w brakach do „Gotowy” */
  const bookedVessel = curSailing ? null : (load.ferry.vessel ?? '').trim() || null;
  /* F7 runda 2: „rejs niewybrany” tylko w przygotowaniu (jak braki do „Gotowy”); na promie i później — sama nazwa statku */
  const sailMissing = !curSailing && READY_PREP.includes(load.status);
  /* „wpisany/brak” (E32 pkt 5) — ten sam stan co pole w oknie Awizacja (E44: zapisany link z serwera albo w zasobach) */
  const linkSet = !!(r.trackingRef ?? '').trim() || !!trackingLinkOf(load, loads, nowIso);
  const fixAwiz = canFixAwizOf(role);
  const awizBtn = role === 'SCX'
    ? <button type="button" className="btn" data-awiz-open onClick={p.onAwiz}>{pt(locale, awiz === 'none' ? 'p7_awiz_btn_add' : 'p7_awiz_btn_edit')}</button>
    : fixAwiz ? <button type="button" className="btn ghost" data-awiz-fix onClick={p.onAwiz}>{pt(locale, 'p7_awiz_btn_fix')}</button> : null;
  const awizChip = awiz === 'ok'
    ? (sailMissing ? <span className="po-pill amber" data-awiz-nosail>{pt(locale, 'p7_awiz_ok_nosail')}</span> : <span className="po-pill go">{pt(locale, 'p7_awiz_ok')}</span>)
    : awiz === 'part' ? <span className="po-pill amber">{ptp(locale, 'p7_awiz_part', { n: missing.length })}</span>
      : <span className="po-pill red">{pt(locale, 'p7_awiz_none')}</span>;
  const pilotVal = (side: 'pl' | 'se') => {
    const x = pilots?.[side];
    const filled = [x?.plate, x?.name].map((v) => (v ?? '').trim()).filter(Boolean);
    return filled.length === 2
      ? <span data-content><b className="mono">{x!.plate}</b>{` · ${x!.name}`}</span>
      : <span className="po-miss">{pt(locale, 'p7_pilot_none')}</span>;
  };

  const setL = r.setLengthM ?? spec?.set.l ?? null;
  const setW = r.setWidthM ?? spec?.set.w ?? null;
  const setH = r.setHeightM ?? spec?.set.h ?? null;
  /* audyt-B B-13: wymiary równe wierszowi tabeli symboli to zestaw „z tabeli” (jak okno Awizacja), nie „wpisane przy transporcie” */
  const sameAsTable = !!spec && [[r.setLengthM, spec.set.l], [r.setWidthM, spec.set.w], [r.setHeightM, spec.set.h]]
    .every(([a, b]) => a == null || Math.abs((a as number) - (b as number)) < 0.005);
  const setOwn = r.setLengthM != null && !sameAsTable;
  const setSrc = setOwn ? pt(locale, 'p7_set_own') : spec ? ptp(locale, 'p7_set_src', { sym: spec.symbol }) : pt(locale, 'p7_set_none');
  const cargo = [spec?.kind, spec?.symbol ?? load.itemType, ptp(locale, 'p7_qty', { n: load.qty }), `${dim(load.dims.weightT, locale)} t`].filter(Boolean).join(' · ');

  return (
    <div className="po" data-overview>
      {todoBox}
      {kshLine}

      <div className={`po-map${phone ? ' is-phone' : ''}`} data-load-map>{p.mapNode}</div>

      <Sec
        id="plan"
        phone={phone}
        title={phone ? pt(locale, 'p7_ph_plan') : pt(locale, 'p7_plan_h')}
        /* P11 (e32): telefon — daty z rokiem bez dnia tygodnia, w drugiej linii ETA albo „Na placu od …” (bez poszarpanego zawijania) */
        status={phone ? (
          <>
            {` · ${ptp(locale, 'p7_plan_line', { a: dmy(load.plannedLoadDate), b: dmy(load.plannedDeliverDate) })}`}
            <span className="po-fold-s2" data-plan-eta>
              {siteSincePh ? ptp(locale, 'p7_ph_site', { v: dmHm(siteSincePh) }) : ptp(locale, 'p7_ph_eta', { v: etaShort })}
            </span>
          </>
        ) : null}
      >
        <dl className="po-kv">
          <dt>{pt(locale, 'p7_plan_load')}</dt>
          <dd data-load-when>{dateVal(load.plannedLoadDate, loadHours)}<span className="po-sub">{SITES.loading.name}</span></dd>
          <dt>{pt(locale, 'p7_plan_deliver')}</dt>
          <dd data-deliver-when>{dateVal(load.plannedDeliverDate, delHours)}<span className="po-sub">{pt(locale, 'p7_place_deliver')}</span></dd>
          <dt>{pt(locale, 'p7_plan_dates')}</dt>
          <dd data-dates-origin>
            <span data-content>{origin}</span>
            <span className="po-sub">{pt(locale, 'p7_dates_ksh_can')}</span>
            {role === 'KSH' ? (
              <span className="po-ksh-act" data-ksh-actions>
                <button type="button" className="btn" data-ksh-edit onClick={p.onKshDates}>{pt(locale, 'p7_dates_edit')}</button>
              </span>
            ) : null}
          </dd>
        </dl>
        {/* E15 pkt 8 (img/e15-after): blok ETA — w „Planie i ETA” (E32 pkt 4) */}
        <EtaBlock load={load} locale={locale} phone={phone} nowIso={nowIso} deliveredAt={p.deliveredAt} siteSince={p.siteSince} delayMin={p.delayMin} wx={p.wx} />
        <div data-eta-howto className="etab-howto">
          <OptionsHowTo locale={locale} k="a6_dr_eta_howto" summaryKey="a6_sch_howto_btn" />
        </div>
      </Sec>

      <Sec
        id="awiz"
        phone={phone}
        title={hasDriver ? pt(locale, 'p7_drivers_h') : pt(locale, 'p7_awiz_h')}
        extra={hasDriver ? (swap ? ` · ${pt(locale, 'p7_swap')}` : null) : <>{` · ${pt(locale, 'p7_awiz_fills')} `}{awizChip}</>}
        status={phone ? <> {awiz === 'none' ? <span className="po-miss">{pt(locale, 'p7_awiz_none')}</span> : awiz === 'part' ? <span className="po-warn">{ptp(locale, 'p7_awiz_part', { n: missing.length })}</span> : sailMissing ? <span className="po-warn" data-awiz-nosail>{pt(locale, 'p7_awiz_ok_nosail')}</span> : <span className="po-ok">{pt(locale, 'p7_awiz_ok')}</span>}</> : null}
        right={!phone && hasDriver ? awizChip : null}
      >
        {hasDriver ? (
          <div className="po-drvs">
            {twoSeg ? (
              <>
                {segNow === 'SE' ? (
                  <>
                    {driverCard('SE', r.driverDeliveryName, r.driverDeliveryPhone, r.tractorDeliveryPlate, r.driverDeliveryPhoneCountry)}
                    {driverCard('PL', r.driverName, r.driverPhone, r.tractorPlate, r.driverPhoneCountry)}
                  </>
                ) : (
                  <>
                    {driverCard('PL', r.driverName, r.driverPhone, r.tractorPlate, r.driverPhoneCountry)}
                    {driverCard('SE', r.driverDeliveryName, r.driverDeliveryPhone, r.tractorDeliveryPlate, r.driverDeliveryPhoneCountry)}
                  </>
                )}
              </>
            ) : driverCard('one', r.driverName, r.driverPhone, r.tractorPlate, r.driverPhoneCountry)}
          </div>
        ) : null}
        <dl className="po-kv" data-awiz-state={awiz}>
          {!hasDriver ? (
            <>
              <dt>{pt(locale, 'p7_row_driver')}</dt>
              <dd><span className="po-miss">—</span></dd>
              <dt>{pt(locale, 'p7_row_tractor_trailer')}</dt>
              <dd>
                {(r.tractorPlate ?? '').trim() ? <b className="mono" data-content>{r.tractorPlate}</b> : <span className="po-miss">—</span>}
                {' · '}
                {(r.trailerPlate ?? '').trim() ? <b className="mono" data-content>{r.trailerPlate}</b> : <span className="po-miss">—</span>}
              </dd>
            </>
          ) : (
            <>
              <dt>{pt(locale, 'p7_row_trailer')}</dt>
              <dd>{(r.trailerPlate ?? '').trim() ? <b className="mono" data-content>{r.trailerPlate}</b> : <span className="po-miss">{pt(locale, 'p7_awiz_none')}</span>}</dd>
            </>
          )}
          <dt>{pt(locale, 'p7_row_link')}</dt>
          <dd>{linkSet ? <span className="po-ok">{pt(locale, 'p7_link_set')}</span> : <span className="po-miss">{awiz === 'none' ? '—' : pt(locale, 'p7_link_none')}</span>}</dd>
          <dt>{pt(locale, 'p7_row_sailing')}</dt>
          <dd data-ferry-row>{sailingText ? <span data-content>{sailingText}</span> : bookedVessel && sailMissing ? (
            <><span data-content>{bookedVessel}</span>{' · '}<span className="po-miss" data-sail-unpicked>{pt(locale, 'p7_sail_unpicked')}</span></>
          ) : bookedVessel ? <span data-content>{bookedVessel}</span>
            : <span className="po-muted">{pt(locale, awiz === 'none' ? 'p7_sail_pick' : 'p7_sail_none')}</span>}</dd>
          {pilotsReq ? (
            <>
              <dt>{pt(locale, 'p7_pilot_pl')}</dt>
              <dd data-po-pilot="pl">{pilotVal('pl')}</dd>
              <dt>{pt(locale, 'p7_pilot_se')}</dt>
              <dd data-po-pilot="se">{pilotVal('se')}</dd>
            </>
          ) : null}
        </dl>
        {awizBtn ? <div className="po-act" data-awiz-actions>{awizBtn}</div> : null}
      </Sec>

      <Sec
        id="cargo"
        phone={phone}
        title={pt(locale, 'p7_cargo_h')}
        status={phone ? ` · ${[spec?.symbol ?? load.itemType, setL != null ? `${dim(setL, locale)} m` : null].filter(Boolean).join(' · ')}` : null}
      >
        <dl className="po-kv">
          <dt>{pt(locale, 'p7_cargo')}</dt>
          <dd data-content>{cargo}</dd>
          <dt>{pt(locale, 'p7_cargo_dims')}</dt>
          <dd>{load.dims.cargoClass === 'STANDARD' ? <span data-cargo="none">—</span> : <>{dim(load.dims.lengthM, locale)} × {dim(load.dims.widthM, locale)} × {dim(load.dims.heightM, locale)} m</>}</dd>
          <dt>{pt(locale, 'p7_set')}</dt>
          <dd data-po-set>
            <SetField
              key={load.id}
              loadId={load.id}
              value={setL != null && setW != null && setH != null ? { l: setL, w: setW, h: setH } : null}
              own={setOwn}
              sym={spec?.symbol ?? null}
              save={saveSetOf(role)}
              locale={locale}
            >
              {setL != null ? <b>{dim(setL, locale)} × {dim(setW, locale)} × {dim(setH, locale)} m</b> : <span className="po-miss">—</span>}
            </SetField>
            <span className="po-sub">{setSrc}</span>
          </dd>
          {spec ? (
            <>
              <dt>{pt(locale, 'p7_permit')}</dt>
              <dd data-po-permit-kind={spec.permit}><span className="po-pill sea">{pt(locale, `p7_permit_${spec.permit}`)}</span> {pt(locale, `p7_permit_${spec.permit}_sub`)}</dd>
            </>
          ) : null}
        </dl>
      </Sec>

      {role !== 'KSH' ? (
        <Sec
          id="numbers"
          phone={phone}
          title={pt(locale, 'p7_num_h')}
          status={phone ? <> {!hhlNo && !scxNo ? <span className="po-miss">{pt(locale, 'p7_ph_num_both')}</span> : !hhlNo || !scxNo ? <span className="po-miss">{ptp(locale, 'p7_ph_num_one', { which: !hhlNo ? 'HHL' : 'SCX' })}</span> : <span className="po-ok">{pt(locale, 'p7_ph_num_ok')}</span>}</> : null}
        >
          <dl className="po-kv">
            <dt>HHL</dt>
            <dd data-order="hhl">
              {orderSide === 'HHL' ? (
                <OrderNoField key={`hhl-${load.id}`} value={load.hhlOrderNo} onSave={(v) => setOrderNo(load.id, 'HHL', v)} locale={locale} />
              ) : hhlNo ? <b className="mono">{hhlNo}</b> : <><span className="po-miss">{pt(locale, 'p7_num_missing')}</span><span className="po-muted">{` · ${pt(locale, 'p7_num_by_hhl')}`}</span></>}
            </dd>
            <dt>SCX</dt>
            <dd data-order="scx">
              {orderSide === 'CARRIER' ? (
                <OrderNoField key={`scx-${load.id}`} value={load.carrierOrderNo} onSave={(v) => setOrderNo(load.id, 'CARRIER', v)} locale={locale} />
              ) : scxNo ? <b className="mono">{scxNo}</b> : <><span className="po-miss">{pt(locale, 'p7_num_missing')}</span><span className="po-muted">{` · ${pt(locale, 'p7_num_by_scx')}`}</span></>}
            </dd>
          </dl>
        </Sec>
      ) : null}

      <Sec
        id="docs"
        phone={phone}
        title={pt(locale, 'p7_docs_h')}
        status={phone ? <> {docMiss ? <span className="po-miss">{ptn(locale, 'p7_docs_n', docMiss)}</span> : <span className="po-ok">{pt(locale, 'p7_docs_ok')}</span>}</> : null}
        right={!phone ? <button type="button" className="linkbtn po-go" data-po-go="docs" onClick={() => p.onTab('docs')}>{pt(locale, 'p7_docs_go')} →</button> : null}
      >
        <dl className="po-kv">
          <dt>{pt(locale, permitFirm ? 'p7_doc_permit_firm' : 'p7_doc_permit')}</dt>
          <dd data-permit={permitState}><span className={permitState === 'ok' ? 'po-ok' : 'po-miss'}>{permitText}</span></dd>
          <dt>{pt(locale, cmrSigned ? 'p7_doc_cmr_signed' : 'p7_doc_cmr')}</dt>
          <dd data-po-cmr={cmrState}><span className={cmrState === 'ok' ? 'po-ok' : cmrState === 'over' ? 'po-miss' : ''}>{cmrText}</span></dd>
          {pols.map((x) => (
            <Fragment key={x.key}>
              <dt>{pt(locale, `p7_doc_policy_${x.key}`)}</dt>
              <dd data-po-policy={x.key}>{x.ok ? <span className="po-ok" data-content>{x.ok}</span> : x.unknown ? <span className="po-muted">{pt(locale, 'p7_doc_policy_unknown')}</span> : <span className="po-miss">{pt(locale, 'p7_doc_policy_none')}</span>}</dd>
            </Fragment>
          ))}
        </dl>
        {phone ? <button type="button" className="btn ghost po-go-ph" data-po-go="docs" onClick={() => p.onTab('docs')}>{pt(locale, 'p7_docs_go')} →</button> : null}
      </Sec>

      <div className="po-pdf">
        <button type="button" className="btn ghost" data-action="export-load-pdf-map" onClick={p.onPdf}>{t(locale, 'h7_pdf_btn')}</button>
      </div>
      {p.ratingNode}
    </div>
  );
}
