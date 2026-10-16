/**
 * wyglad/P7-c — Harmonogram w układzie pliku KSH (E38 decyzja 1A: kolejność i nazwy kolumn z pliku, po prawej Status,
 * ETA Boden, Dokumenty, kwota; przewijanie w bok z przyklejonymi „Typ” i „Wysyłka”), „Widok skrócony” (8 kolumn E30)
 * i karty na telefonie (E30 pkt 8). Tylko wyświetlanie — wiersz otwiera panel transportu (E30 pkt 5); zestaw zmienia się
 * w oknie Awizacja (E32), nie w tabeli.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { activeDriver } from '../../lib/activeDriver';
import type { DocStatusRow, DocRequirement } from '../../lib/docRequirements';
import type { DisplayCurrency } from '../../lib/money/engine';
import type { Load, Locale, RoleId } from '../../types';
import { fmtNum, pctText } from '../../i18n/messages';
import { s7, s7p } from '../../i18n/sched7';
import { StatusMarkers, StatusPill } from '../ui/StatusPill';
import { clickableRow } from '../../lib/clickableRow';
import { formatLoadMoney, formatLoadRevMargin } from '../../lib/money/loadPln';
import { formatTableInZone, TZ_LOAD_PL, TZ_UNLOAD_SE } from '../../lib/time';
import { transportLabel } from '../../lib/transportName';
import {
  dmy, dayPl, docCell, etaText, hmIn, moneyKey, pair, SHORT_COLS, SHORT_EXTRAS,
  type FileColDef, type ShortExtraId,
} from '../../lib/schedLayout';

export type SchedRowCtx = {
  locale: Locale;
  role: RoleId;
  currency: DisplayCurrency;
  /** próg marży w % (E16); null — marża nigdy czerwona */
  marginMin: number | null;
  docRows: (loadId: string) => DocStatusRow[];
  reqs: readonly DocRequirement[];
  delayOf: (l: Load) => number | null;
  hoverLoadId: string | null;
  selectedLoadId: string | null;
  setHover: (id: string | null) => void;
  onOpen: (id: string) => void;
};

const dim = (n: number, locale: Locale) => fmtNum(locale, n, 2);
const dims = (l: Load, locale: Locale) => (l.dims.cargoClass === 'STANDARD' ? '—' : `${dim(l.dims.lengthM, locale)} × ${dim(l.dims.widthM, locale)} × ${dim(l.dims.heightM, locale)}`);
const loadHm = (l: Load) => hmIn(l.planDates?.loadFrom ?? l.awizacja?.loadWindowStart ?? null, TZ_LOAD_PL);
const delivHm = (l: Load) => hmIn(l.planDates?.deliveryTo ?? l.awizacja?.unloadWindowEnd ?? l.planDates?.deliveryFrom ?? l.awizacja?.unloadWindowStart ?? null, TZ_UNLOAD_SE);
const dash = <span className="s7-dash">–</span>;

/** „A → B” (przepięcie naczepy, E6), czerwony „?” — w pliku „...”. */
function Pair({ a, b, swap, mono, locale }: { a: string | null | undefined; b: string | null | undefined; swap: boolean; mono?: boolean; locale: Locale }) {
  const p = pair(a, b, swap);
  if (!p.a && !p.b && !p.missingB) return dash;
  return (
    <span className={mono ? 'mono' : undefined} data-content>
      {p.a ?? <Q locale={locale} />}
      {swap ? <> → {p.b ?? <Q locale={locale} />}</> : null}
    </span>
  );
}

function Q({ locale }: { locale: Locale }) {
  return <b className="s7-q" title={s7(locale, 's7_missing_part')}>?</b>;
}

function Phones({ l, locale }: { l: Load; locale: Locale }) {
  const r = l.resources;
  if (!(r.driverName || r.driverPhone || r.driverDeliveryName || r.driverDeliveryPhone)) return dash;
  /* wyglad/E6-tel (właściciel 16.10, 13:34 i 13:58): numer kierowcy, który teraz wykonuje transport — przy przepięciu od promu kierowca SE */
  const d = activeDriver(l);
  const leg = d.swap ? <small className="s7-ph-leg" data-tel-leg={d.leg}>{s7p(locale, 's7_ph_leg', { leg: d.leg })}</small> : null;
  if (d.dial) {
    const label = s7p(locale, d.swap ? 's7_call_leg' : 's7_call', { who: d.name || d.display || '', leg: d.leg });
    return (
      <span className="s7-ph">
        <a className="s7-ph-n mono" href={`tel:${d.dial}`} data-tel-active={d.leg} aria-label={label} title={label} onClick={(e) => e.stopPropagation()}>{d.display}</a>
        {leg}
      </span>
    );
  }
  return (
    <span className="s7-ph">
      {d.name ? <b className="s7-neg" title={d.swap ? s7p(locale, 's7_no_phone_leg', { leg: d.leg }) : undefined}>{s7(locale, 's7_no_phone_full')}</b> : <Q locale={locale} />}
      {leg}
    </span>
  );
}

function Status({ l, ctx }: { l: Load; ctx: SchedRowCtx }) {
  return (
    <span className="st-wrap s7-st">
      <StatusPill status={l.status} stage={l.stage} />
      <StatusMarkers load={l} delayMin={ctx.delayOf(l)} />
      {l.unloadedAt ? <small className="s7-sub">{dmy(l.unloadedAt, TZ_UNLOAD_SE)}</small> : null}
    </span>
  );
}

function Eta({ l, ctx }: { l: Load; ctx: SchedRowCtx }) {
  const k = etaText(l);
  if (k === 'done') return <span>{s7(ctx.locale, 's7_eta_done')}</span>;
  if (k === 'site') return <span>{s7(ctx.locale, 's7_eta_site')}</span>;
  if (k === 'none') return dash;
  return <span className="s7-num">{formatTableInZone(l.etaBoden, TZ_UNLOAD_SE)}</span>;
}

function Docs({ l, ctx, two }: { l: Load; ctx: SchedRowCtx; two?: boolean }) {
  const c = docCell(ctx.docRows(l.id), ctx.reqs);
  const L = ctx.locale;
  if (c.tone === 'none') return dash;
  if (c.tone === 'ok') return <span className="s7-ok" data-docs="ok">{s7(L, 's7_d_ok')}</span>;
  if (c.tone === 'due') {
    return <span className="s7-muted" data-docs="due">{s7p(L, 's7_d_due', { list: c.keys.map((k) => s7(L, k)).join(', '), date: dmy(c.due) })}</span>;
  }
  const text = c.keys.length === 1 ? s7p(L, 's7_d_bad_one', { doc: s7(L, c.keys[0]) }) : s7p(L, 's7_d_bad', { list: c.keys.map((k) => s7(L, k)).join(', ') });
  return (
    <span className="s7-docs" data-docs="bad">
      <b className="s7-neg">{text}</b>
      {two && c.whoKey ? <small className="s7-sub">{s7(L, c.whoKey)}</small> : null}
    </span>
  );
}

function Money({ l, ctx, two }: { l: Load; ctx: SchedRowCtx; two?: boolean }) {
  const { role, locale, currency } = ctx;
  const p = l.pricing;
  /* E16 (audyt-F F-04): PLN kursem NBP transportu — ta sama funkcja co panel „Ceny” (`loadPln.ts`), bez stałego 4,39 */
  if (role === 'KSH') return <span className="s7-num">{formatLoadMoney(p.revTotal, l, 'rev', locale, currency)}</span>;
  if (role === 'SCX') return <span className="s7-num">{formatLoadMoney(p.costTotal, l, 'cost', locale, currency)}</span>;
  const low = ctx.marginMin != null && p.marginPct * 100 < ctx.marginMin;
  const pct = pctText(locale, p.marginPct, 1);
  const rm = formatLoadRevMargin(l, locale, currency);
  const m = rm.margin;
  return (
    <span className={`s7-money${two ? ' is-two' : ''}`} data-money>
      <b className="s7-num">{rm.rev}</b>
      <small className={`s7-margin${low ? ' s7-neg' : ''}`}>{two ? s7p(locale, 's7_margin_short', { v: m, p: pct }) : ` · ${s7p(locale, 's7_margin', { v: m, p: pct })}`}</small>
    </span>
  );
}

function Code({ l, locale }: { l: Load; locale: Locale }) {
  return (
    <>
      <span className="code" data-content>{l.code}</span>
      {l.renumberedFrom ? <span className="mtag s7-renum" title={s7p(locale, 's7_renum_tip', { code: l.renumberedFrom })}>{s7(locale, 's7_renum').toLocaleUpperCase('pl')}</span> : null}
    </>
  );
}

function fileCell(id: FileColDef['id'], l: Load, ctx: SchedRowCtx): ReactNode {
  const L = ctx.locale;
  const r = l.resources;
  switch (id) {
    case 'type': return <span data-content>{l.itemType}</span>;
    case 'code': return <Code l={l} locale={L} />;
    case 'dims': return <span className={l.dims.lengthM > 16.5 || l.dims.widthM > 2.55 ? 'over' : undefined}>{dims(l, L)}</span>;
    case 'elemWeight': return l.elementWeightT != null ? dim(l.elementWeightT, L) : dash;
    case 'qty': return l.qty ? String(l.qty) : dash;
    case 'weight': return l.dims.weightT ? dim(l.dims.weightT, L) : dash;
    case 'loadDate': return dmy(l.plannedLoadDate);
    case 'loadDay': return dayPl(l.plannedLoadDate);
    case 'loadTime': return loadHm(l);
    case 'driver': return <Pair a={r.driverName} b={r.driverDeliveryName} swap={!!r.trailerSwap} locale={L} />;
    case 'phone': return <Phones l={l} locale={L} />;
    case 'tractor': return <Pair a={r.tractorPlate} b={r.tractorDeliveryPlate} swap={!!r.trailerSwap} mono locale={L} />;
    case 'trailer': return r.trailerPlate ? <span className="mono" data-content>{r.trailerPlate}</span> : dash;
    case 'ordScx': return l.carrierOrderNo ? <span className="mono s7-ord" data-content>{l.carrierOrderNo}</span> : dash;
    case 'delivDate': return dmy(l.plannedDeliverDate);
    case 'delivDay': return dayPl(l.plannedDeliverDate);
    case 'delivTime': return delivHm(l);
    case 'ordHhl': return l.hhlOrderNo ? <span className="mono s7-ord" data-content>{l.hhlOrderNo}</span> : dash;
    case 'status': return <Status l={l} ctx={ctx} />;
    case 'eta': return <Eta l={l} ctx={ctx} />;
    case 'docs': return <Docs l={l} ctx={ctx} />;
    case 'money': return <Money l={l} ctx={ctx} />;
    default: return null;
  }
}

function rowProps(l: Load, ctx: SchedRowCtx) {
  return {
    'data-load': l.id,
    'data-code': l.code,
    'data-status': l.status,
    /* E25 (audyt-B B-03): „Rozładowany” = „Dostarczone” — ten sam wygląd wiersza */
    className: `${l.status === 'DELIVERED' || l.status === 'UNLOADING' ? 'done' : ''}${ctx.hoverLoadId === l.id || ctx.selectedLoadId === l.id ? ' hl' : ''}${l.status === 'CANCELLED' ? ' is-cancel' : ''}`,
    onMouseEnter: () => ctx.setHover(l.id),
    onMouseLeave: () => ctx.setHover(null),
    ...clickableRow(() => ctx.onOpen(l.id)),
  };
}

const SKEL = [70, 110, 90, 60, 120, 80, 100, 70];

/** Układ pliku (E38 1A): przyklejone „Typ” i „Wysyłka”; kolumny Watch Tower oddzielone kreską. */
export function FileTable({ cols, list, ctx, skeleton }: { cols: FileColDef[]; list: Load[]; ctx: SchedRowCtx; skeleton: boolean }) {
  const L = ctx.locale;
  const firstWt = cols.find((c) => c.group === 'wt')?.id;
  const sum = cols.reduce((a, c) => a + c.w, 0);
  /* „Wysyłka” przykleja się za faktyczną szerokością „Typ” (gdy tabela jest węższa niż ekran, kolumny się rozszerzają) */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const th = wrap?.querySelector<HTMLElement>('th[data-col="type"]');
    if (!wrap || !th) return undefined;
    const set = () => wrap.style.setProperty('--s7-left', `${th.getBoundingClientRect().width}px`);
    set();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set);
    ro?.observe(th);
    return () => ro?.disconnect();
  }, [cols]);
  const cls = (c: FileColDef) => [c.num ? 'num' : '', c.id === 'type' ? 's7-stick s7-stick-1' : '', c.id === 'code' ? 's7-stick s7-stick-2' : '', c.group === 'wt' ? 's7-wt' : '', c.id === firstWt ? 's7-wt1' : ''].filter(Boolean).join(' ');
  return (
    <div ref={wrapRef} className="tablewrap sched-table-wrap s7-wrap" data-sched-layout="file" style={{ ['--s7-left' as string]: `${cols[0]?.w ?? 0}px` }}>
      <table className="sched-table s7-table s7-file" style={{ width: sum }}>
        <colgroup>{cols.map((c) => <col key={c.id} style={{ width: c.w }} />)}</colgroup>
        <thead>
          <tr>
            {cols.map((c) => <th key={c.id} data-col={c.id} className={cls(c)} scope="col">{s7(L, c.id === 'money' ? moneyKey(ctx.role) : c.key)}</th>)}
          </tr>
        </thead>
        <tbody>
          {skeleton ? Array.from({ length: 12 }, (_, r) => (
            <tr key={`skel-${r}`} className="skel" data-sched-skel>
              {cols.map((c, i) => <td key={c.id} className={cls(c)}><i style={{ width: Math.min(c.w - 16, SKEL[i % SKEL.length]) }} /></td>)}
            </tr>
          )) : list.map((l) => (
            <tr key={l.id} {...rowProps(l, ctx)}>
              {cols.map((c) => <td key={c.id} data-col={c.id} className={cls(c)}>{fileCell(c.id, l, ctx)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortCell(id: string, l: Load, ctx: SchedRowCtx): ReactNode {
  const L = ctx.locale;
  const r = l.resources;
  const swap = !!r.trailerSwap;
  switch (id) {
    case 'transport': {
      const label = transportLabel(l, ctx.role, 'schedule');
      const rest = label.startsWith(l.code) ? label.slice(l.code.length) : '';
      return (
        <span className="s7-tr">
          <span className="code" data-content>{l.code}</span>{rest ? <span className="mono s7-trno" data-content>{rest}</span> : null}
          {ctx.role === 'HHL' && !l.hhlOrderNo ? <span className="mtag s7-tag-bad" data-no-hhl>{s7(L, 's7_no_hhl').toLocaleUpperCase('pl')}</span> : null}
          {l.renumberedFrom ? <span className="mtag s7-renum" title={s7p(L, 's7_renum_tip', { code: l.renumberedFrom })}>{s7(L, 's7_renum').toLocaleUpperCase('pl')}</span> : null}
        </span>
      );
    }
    case 'cargo':
      return (
        <span className="s7-two">
          <span data-content>{l.itemType}{l.qty ? ` · ${s7p(L, 's7_pcs', { n: l.qty })}` : ''}</span>
          <small className="s7-sub">{l.dims.cargoClass === 'STANDARD' ? null : <><span className="s7-nw">{dims(l, L)} m</span> · </>}<span className="s7-nw">{dim(l.dims.weightT, L)} t</span></small>
        </span>
      );
    case 'dates': return <span className="s7-num">{dmy(l.plannedLoadDate)} → {dmy(l.plannedDeliverDate)}</span>;
    case 'status': return <Status l={l} ctx={ctx} />;
    case 'crew': {
      if (!(r.driverName || r.driverDeliveryName || r.tractorPlate)) {
        return <span className="s7-two"><b className="s7-neg">{s7(L, 's7_no_crew')}</b><small className="s7-sub">{s7(L, 's7_crew_by')}</small></span>;
      }
      return (
        <span className="s7-two">
          <span><Pair a={r.driverName} b={r.driverDeliveryName} swap={swap} locale={L} /></span>
          <small className="s7-sub mono">
            <Pair a={r.tractorPlate} b={r.tractorDeliveryPlate} swap={swap} mono locale={L} />{r.trailerPlate ? ` · ${r.trailerPlate}` : ''}
          </small>
        </span>
      );
    }
    case 'eta': return <Eta l={l} ctx={ctx} />;
    case 'docs': return <Docs l={l} ctx={ctx} two />;
    case 'money': return <Money l={l} ctx={ctx} two />;
    case 'ordHhl': return l.hhlOrderNo ? <span className="mono" data-content>{l.hhlOrderNo}</span> : dash;
    case 'ordScx': return l.carrierOrderNo ? <span className="mono" data-content>{l.carrierOrderNo}</span> : dash;
    case 'phone': return <Phones l={l} locale={L} />;
    case 'tractor': return <Pair a={r.tractorPlate} b={r.tractorDeliveryPlate} swap={swap} mono locale={L} />;
    case 'trailer': return r.trailerPlate ? <span className="mono" data-content>{r.trailerPlate}</span> : dash;
    case 'sailing': return l.ferry?.vessel ? <span data-content>{l.ferry.vessel}{l.ferry.departureAt ? ` · ${formatTableInZone(l.ferry.departureAt, TZ_LOAD_PL)}` : ''}</span> : dash;
    case 'cost': return <span className="s7-num">{formatLoadMoney(l.pricing.costTotal, l, 'cost', L, ctx.currency)}</span>;
    default: return null;
  }
}

/**
 * audyt-B B-02 (E20, E30 pkt 1): szerokości kolumn w px, gdy „Kolumny” dodały kolumny — 9 kolumn jak w 1154 px
 * (te same proporcje co bez dodatków) i 110–180 px dla każdej dodanej. Tabela przewija się w bok, „Transport” przyklejony.
 */
const SHORT_W: Readonly<Record<string, number>> = {
  transport: 150, cargo: 150, dates: 115, status: 115, crew: 150, phone: 138, eta: 92, docs: 115, money: 127,
  ordHhl: 130, ordScx: 130, tractor: 110, trailer: 110, sailing: 180, cost: 120,
};

/** „Widok skrócony” — 8 kolumn E30 (mieści się w 1154 px), dodatkowe kolumny z „Kolumny” przed kwotą. */
export function ShortTable({ extras, list, ctx, skeleton }: { extras: ShortExtraId[]; list: Load[]; ctx: SchedRowCtx; skeleton: boolean }) {
  const L = ctx.locale;
  const base = SHORT_COLS.filter((c) => c.id !== 'money');
  const cols: { id: string; key: string; num?: boolean }[] = [
    ...base,
    ...SHORT_EXTRAS.filter((x) => extras.includes(x.id)),
    SHORT_COLS.find((c) => c.id === 'money')!,
  ];
  /* bez dodatków — procenty, bez przewijania (E30); z dodatkami — px, przewijanie w bok i przyklejony „Transport” (E20) */
  const wide = cols.length > SHORT_COLS.length;
  const sum = cols.reduce((a, c) => a + (SHORT_W[c.id] ?? 120), 0);
  return (
    <div className="tablewrap sched-table-wrap s7-wrap" data-sched-layout="short" data-sched-wide={wide ? '' : undefined}>
      <table className={`sched-table s7-table s7-short${wide ? ' is-wide' : ''}`} style={wide ? { width: sum } : undefined}>
        {wide ? <colgroup>{cols.map((c) => <col key={c.id} style={{ width: SHORT_W[c.id] ?? 120 }} />)}</colgroup> : null}
        <thead>
          <tr>
            {cols.map((c) => <th key={c.id} data-col={c.id} className={c.num ? 'num' : undefined} scope="col">{s7(L, c.id === 'money' ? moneyKey(ctx.role) : c.key)}</th>)}
          </tr>
        </thead>
        <tbody>
          {skeleton ? Array.from({ length: 10 }, (_, r) => (
            <tr key={`skel-${r}`} className="skel" data-sched-skel>{cols.map((c, i) => <td key={c.id}><i style={{ width: SKEL[i % SKEL.length] }} /></td>)}</tr>
          )) : list.map((l) => (
            <tr key={l.id} {...rowProps(l, ctx)}>
              {cols.map((c) => <td key={c.id} data-col={c.id === 'transport' ? 'code' : c.id} className={c.num ? 'num' : undefined}>{shortCell(c.id, l, ctx)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Telefon (E30 pkt 8): karta — nazwa, status i oznaczenia, ładunek, daty, kierowca; dotknięcie otwiera panel. */
export function SchedCards({ list, ctx }: { list: Load[]; ctx: SchedRowCtx }) {
  const L = ctx.locale;
  return (
    <div className="sched-cards s7-cards" data-sched-cards>
      {list.map((l) => {
        const d = activeDriver(l);
        const open = () => ctx.onOpen(l.id);
        return (
          <div key={`card-${l.id}`} role="button" tabIndex={0} className={`sched-card s7-card${ctx.hoverLoadId === l.id || ctx.selectedLoadId === l.id ? ' hl' : ''}`}
            data-load={l.id} data-code={l.code} data-status={l.status} onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
            <div className="r1">
              <span className="code" data-content>{transportLabel(l, ctx.role, 'schedule')}</span>
              <StatusPill status={l.status} stage={l.stage} />
              <StatusMarkers load={l} delayMin={ctx.delayOf(l)} />
              {ctx.role === 'HHL' && !l.hhlOrderNo ? <span className="mtag s7-tag-bad">{s7(L, 's7_no_hhl').toLocaleUpperCase('pl')}</span> : null}
            </div>
            <div className="meta" data-content>
              {l.itemType}{l.qty ? ` · ${s7p(L, 's7_pcs', { n: l.qty })}` : ''} · {dim(l.dims.weightT, L)} t · {dayPl(l.plannedLoadDate)} {dmy(l.plannedLoadDate)} → {dayPl(l.plannedDeliverDate)} {dmy(l.plannedDeliverDate)}
            </div>
            {/* wyglad/E6-tel (16.10, 13:58): na telefonie kierowca, który teraz wykonuje transport, i „Zadzwoń” do niego */}
            <div className="s7-card-drv">
              <span className="meta" data-content data-card-driver={d.swap ? d.leg : 'one'}>
                {d.name ?? s7(L, 's7_card_driver_none')}
                {d.swap ? <small className="s7-ph-leg">{` · ${s7p(L, 's7_ph_leg', { leg: d.leg })}`}</small> : null}
              </span>
              {d.dial ? (
                <a className="btn s7-card-call" href={`tel:${d.dial}`} data-card-call={d.leg}
                  aria-label={s7p(L, d.swap ? 's7_call_leg' : 's7_call', { who: d.name || d.display || '', leg: d.leg })}
                  onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>☎ {s7(L, 's7_call_btn')}</a>
              ) : d.name ? <b className="s7-neg">{s7(L, 's7_no_phone_full')}</b> : null}
            </div>
            {/* właściciel 16.10, 14:09: pojazd, który teraz wiezie ładunek — ciągnik odcinka (automat jak „Zadzwoń”) i naczepa */}
            <div className="meta s7-card-veh" data-content data-card-vehicle={d.swap ? d.leg : 'one'}>
              {s7(L, 's7_card_tractor')} <b className="mono">{d.tractor ?? '–'}</b>{' · '}{s7(L, 's7_card_trailer')} <b className="mono">{(l.resources.trailerPlate ?? '').trim() || '–'}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}
