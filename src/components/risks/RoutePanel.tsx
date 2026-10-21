/**
 * wyglad/P6 — „Sytuacja na trasie” (E7 pkt 4, 6, 7; PLAN 8.4 / E7-5; E2), img/e7-desk prawa kolumna, img/e7-phone „Na trasie”.
 * Bez dzwonka. Promy dziś — wiersz na rejs, najnowszy pomiar, transporty na pokładzie; druga przeprawa przy odwołaniu
 * albo sztormie; Drogi PL (HERE, E2); Drogi SE — najpierw bardzo duży i duży wpływ, po polsku, z miejscem;
 * System — tylko HHL, sprawy techniczne w Opcje › System › Stan systemu.
 * Dane jak dotąd: `sailings`, `marine_conditions`, `corridor_conditions` (produkcja), seed Trafikverket (demo).
 */
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Load, Locale, Risk, Sailing } from '../../types';
import type { MarineConditionRow } from '../../lib/marineWeatherDb';
import type { CorridorConditionRow } from '../../lib/corridorConditionsDb';
import type { RoadSituation } from '../../lib/trafikverket';
import { altProposal, ferryAlert, ferryRowsFromDb, impactOf, LINE_PORTS, roadCounts, roadRowsFromCorridor, sortRoads, type FerryRowView, type RoadRowView } from '../../lib/p6Route';
import { altSailingsOf, sampleFerryRowsOf, roadPlOf } from '../../lib/p6Source';
import { routeRisks } from '../../lib/todoRules';
import { effDeparture, sailingStatusLabel } from '../../lib/sailings';
import { focusVoyage, loadsOnVoyage } from '../../lib/voyage';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { DemoMark } from '../ui/DemoMark';
import { riskText, t } from '../../i18n/messages';
import { rt, rtn, rtp } from '../../i18n/p6';
import { lazyRetry } from '../../lib/lazyRetry';
import { useTowerStore } from '../../store/useTowerStore';
import { ferryRowSailing } from '../../lib/goTarget';
import { navForRole } from '../../lib/permissions';

const PROD = import.meta.env.VITE_AUTH_MODE === 'supabase';
/* komunikat armatora zapisuje w bazie — tylko produkcja (paczka demo bez klienta Supabase, I-2) */
const NoticeForm = import.meta.env.VITE_AUTH_MODE === 'supabase'
  ? lazy(lazyRetry(() => import('../OperatorNoticeForm').then((m) => ({ default: m.OperatorNoticeForm }))))
  : null;
const hm = (iso: string) => formatListDateTime(iso).replace(/^.*, /, '');
const FIRST_ROADS = 4;

export type RoutePart = 'ferry' | 'roads' | 'system';

interface Props {
  role: 'HHL' | 'KSH' | 'SCX';
  locale: Locale;
  phone: boolean;
  nowIso: string;
  loads: readonly Load[];
  risks: readonly Risk[];
  sailings: readonly Sailing[];
  marine: readonly MarineConditionRow[];
  corridor: CorridorConditionRow | null;
  /** demo: seed Trafikverket */
  seSituations: readonly RoadSituation[];
  seDemo: boolean;
  showDemoMarks: boolean;
  parts?: RoutePart[];
  /** nagłówek „Sytuacja na trasie” (komputer) */
  withHead?: boolean;
}

function FerryRow({ r, locale, phone, onOpen }: { r: FerryRowView; locale: Locale; phone: boolean; onOpen?: () => void }) {
  const a = ferryAlert(r);
  const ports = LINE_PORTS[r.line];
  const time = hm(r.depIso);
  const alertText = a === 'CANCELLED' ? rt(locale, 'p6_ferry_CANCELLED')
    : a === 'STORM' ? rt(locale, 'p6_ferry_STORM')
      : a === 'DELAYED' ? rtp(locale, 'p6_ferry_DELAYED', { time: r.delayedIso ? hm(r.delayedIso) : '—' })
        : a === 'ELEVATED' ? rt(locale, 'p6_ferry_ELEVATED') : rt(locale, 'p6_ferry_OK');
  const tone = a === 'CANCELLED' || a === 'STORM' ? 'is-red' : a === 'DELAYED' || a === 'ELEVATED' ? 'is-amber' : 'is-go';
  const s = r.sea;
  const gust = s?.gustKn != null ? rtn(locale, 'p6_kn', Math.round(s.gustKn)) : '—';
  const seaText = !s ? rt(locale, 'p6_sea_none')
    : phone ? rtp(locale, 'p6_sea_s', { gust })
      : `${rtp(locale, 'p6_sea', {
        wave: s.waveM != null ? formatPlNumber(s.waveM, 1) : '—', gust,
        tw: s.thrWaveM != null ? formatPlNumber(s.thrWaveM, 1) : '—', tg: s.thrGustKn != null ? formatPlNumber(s.thrGustKn, 0) : '—',
      })}${s.at ? ` · ${hm(s.at)}` : ''}`;
  return (
    <li
      className={onOpen ? 'rk-ferry is-link' : 'rk-ferry'}
      data-ferry-row={r.line}
      /* W-cele-przejsc (d), E7 pkt 4: klik — rejs w Harmonogramie › Rejsy (historia rejsu: status, opóźnienia, transporty) */
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      title={onOpen ? rt(locale, 'p6_ferry_open') : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
    >
      <span className="rk-box">{ports.from}</span>
      <span className="rk-ferry-tx">
        <b>{phone
          ? rtp(locale, 'p6_ferry_row_s', { vessel: r.vessel, time })
          : rtp(locale, 'p6_ferry_row', { vessel: r.vessel, time, from: rt(locale, `p6_port_${ports.from}`), to: rt(locale, `p6_port_${ports.to}`) })}</b>
        {/* data-content: „węzły” — test waluty D-EUR-T czyta „zł” w środku słowa (\b bez polskich liter) */}
        <span className="rk-ferry-s" data-content>
          <span className={`rk-alert ${tone}`}>{alertText}</span>
          {' · '}{seaText}
          {r.onBoard > 0 ? ` · ${rtn(locale, 'p6_onboard', r.onBoard)}` : ''}
        </span>
      </span>
    </li>
  );
}

export function RoutePanel({
  role, locale, phone, nowIso, loads, risks, sailings, marine, corridor, seSituations, seDemo, showDemoMarks,
  parts = ['ferry', 'roads', 'system'], withHead = true,
}: Props) {
  const navigate = useNavigate();
  const setView = useTowerStore((s) => s.setView);
  const setSailingFocus = useTowerStore((s) => s.setSailingFocus);
  const [allRoads, setAllRoads] = useState(false);
  const openFerry = (r: FerryRowView) => {
    /* rola bez Harmonogramu — nie zostawiamy celu w sklepie */
    if (!navForRole(role).includes('sched')) { setSailingFocus(null); return; }
    /* '*' — rejs spoza rozkładu: sama zakładka Rejsy */
    setSailingFocus(ferryRowSailing(r, sailings) ?? '*');
    setView('sched');
  };
  const nowMs = Date.parse(nowIso);

  /* promy */
  const rows: FerryRowView[] = PROD
    ? ferryRowsFromDb(sailings, marine, loads, nowMs)
    /* przegląd 18.10 (P16, F7 #307 P2): „na pokładzie” = transporty w etapie Prom (jak pasek etapów i Mapa) — także opóźnione na statku */
    : sampleFerryRowsOf(nowIso, loadsOnVoyage(loads, focusVoyage()).filter((l) => l.stage === 'FERRY').length);
  const dayOf = (iso: string) => formatListDateTime(iso).split(', ')[0];
  const today = dayOf(nowIso);
  const allToday = rows.length > 0 && rows.every((r) => dayOf(r.depIso) === today);
  const onBoard = rows.reduce((s, r) => s + r.onBoard, 0);
  const alt = altProposal(rows, altSailingsOf(sailings, nowIso), nowMs);

  /* drogi SE */
  const seRows: RoadRowView[] | null = PROD
    ? (corridor ? roadRowsFromCorridor(corridor.situations) : null)
    : sortRoads(seSituations.map((s) => ({
      id: s.id, road: s.road, title: s.title.replace(new RegExp(`^${s.road}\\s*`), ''), impact: impactOf(s.severity),
      when: null, note: s.detail || null, original: null,
    })));
  const roadsShown = seRows ? (allRoads ? seRows : seRows.slice(0, FIRST_ROADS)) : [];
  const plRows = roadPlOf();
  /* sytuacje na trasie bez transportu (dawna lista ryzyk): ostrzeżenia rejsów, pogoda, drogi PL, zakazy, sprawy techniczne */
  const rr = routeRisks(risks);
  const sysCount = rr.system.length;
  const attribution = [...new Set(marine.map((m) => m.attribution).filter(Boolean))].join(' · ');
  const seaAt = marine.map((m) => m.observedAt).filter(Boolean).sort().pop() ?? null;
  const riskList = (list: Risk[], box: string | null, info = false) => (
    <ul className="rk-roads rk-risks">
      {list.map((r) => {
        const meta = riskText(locale, r.meta, r.metaKey, r.metaParams);
        const tone = r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'is-red' : r.severity === 'MEDIUM' ? 'is-amber' : 'is-plain';
        return (
          <li key={r.id} className="rk-road" data-risk-id={r.id}>
            {box ? <span className="rk-box">{box}</span> : <span className="rk-info-ic" aria-hidden="true">ⓘ</span>}
            <span className="rk-road-tx">
              <span className={info ? 'rk-road-t rk-info' : 'rk-road-t'}>{riskText(locale, r.title, r.titleKey, r.titleParams)}</span>
              {!info && (meta || r.detail) ? (
                <span className="rk-road-s">
                  <span className={`rk-alert ${tone}`}>{(r.severity === 'CRITICAL' || r.severity === 'HIGH' ? rt(locale, 'p6_imp_HIGH') : rt(locale, 'p6_imp_MEDIUM'))}</span>
                  {meta ? ` · ${meta}` : ''}
                </span>
              ) : null}
              {!info && r.detail && !phone ? <span className="rk-road-n">{r.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );

  const roadList = (list: RoadRowView[]) => (
    <ul className="rk-roads">
      {list.map((r) => (
        <li key={r.id} className="rk-road" data-road={r.road}>
          <span className="rk-box">{r.road}</span>
          <span className="rk-road-tx">
            <span className="rk-road-t">{r.title}</span>
            <span className="rk-road-s">
              <span className={`rk-alert ${r.impact === 'VERY_HIGH' ? 'is-red' : r.impact === 'HIGH' ? 'is-amber' : 'is-plain'}`}>
                {rt(locale, `p6_imp_${r.impact}`)}
              </span>
              {r.when ? ` · ${r.when}` : ''}
              {r.original && !r.pending ? ` · ${rt(locale, 'p6_road_translated')}` : ''}
            </span>
            {r.pending && !phone ? <span className="rk-road-n" data-road-note="pending">{rt(locale, 'p6_road_pending')}</span>
              : r.note && !phone ? <span className="rk-road-n" data-road-note="pl">{r.note}</span> : null}
            {r.original && !phone ? (
              <details className="rk-orig">
                <summary>{rt(locale, 'p6_road_original')}</summary>
                <span data-original="road">{r.original}</span>
              </details>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );

  const sections: ReactNode[] = [];
  if (parts.includes('ferry')) {
    sections.push(
      <section key="ferry" className="rk-sec-box" data-panel="ferry" data-source={PROD ? 'db' : undefined} aria-labelledby="rk-ferry-h">
        <div className="rk-sec-hd">
          <h3 id="rk-ferry-h">{rt(locale, allToday || rows.length === 0 ? 'p6_ferries' : 'p6_ferries_next')}</h3>
          {rows.length && !phone ? <span className="rk-sec-sub">{rtn(locale, 'p6_onboard', onBoard)}</span> : null}
        </div>
        {rows.length ? (
          <ul className="rk-ferries">{rows.map((r) => <FerryRow key={r.id} r={r} locale={locale} phone={phone} onOpen={() => openFerry(r)} />)}</ul>
        ) : <p className="rk-muted">{rt(locale, PROD && sailings.length === 0 ? 'p6_ferries_nodata' : 'p6_ferries_none')}</p>}
        {rr.ferry.length ? (
          <div className="rk-sub" data-ferry-warn>
            <h4 className="rk-sec">{rt(locale, 'p6_ferry_warn')}</h4>
            {riskList(rr.ferry, null)}
          </div>
        ) : null}
        {alt ? (
          <div className="rk-alt" data-ferry-alt={PROD ? 'db' : 'demo'}>
            <h4 className="rk-sec">{rt(locale, 'p6_alt_h')}</h4>
            {alt.kind === 'BOTH' ? <p className="rk-muted">{rt(locale, 'p6_alt_both')}</p> : (
              <>
                <p className="rk-alt-why">
                  {alt.reason === 'CANCELLED'
                    ? rtp(locale, 'p6_alt_why_CANCELLED', { vessel: alt.vessel })
                    : rtp(locale, 'p6_alt_why_STORM', { from: rt(locale, `p6_line_${alt.from}`) })}
                </p>
                <p className="rk-alt-why"><b>{rtp(locale, 'p6_alt_list', { line: rt(locale, `p6_line_${alt.to}`) })}</b></p>
                {alt.kind === 'NODATA' ? <p className="rk-muted">{rt(locale, 'p6_alt_nodata')}</p> : (
                  <ul className="rk-alt-list" data-ferry-line={alt.to.toLowerCase()}>
                    {alt.sailings.map((s) => (
                      <li key={s.id}>
                        <b>{formatListDateTime(effDeparture(s))}</b> · {s.vessel || '—'}
                        {s.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(s.status, locale)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="rk-muted">{rt(locale, 'p6_alt_note')}</p>
              </>
            )}
          </div>
        ) : null}
        {!phone ? <p className="rk-muted">{rt(locale, 'p6_ferries_note')}</p> : null}
        {PROD && attribution ? (
          <p className="rk-muted" data-attribution="marine">{rtp(locale, 'p6_sea_attr', { attr: attribution, at: seaAt ? formatListDateTime(seaAt) : '—' })}</p>
        ) : null}
        {NoticeForm && role !== 'KSH' ? (
          <details className="rk-notice">
            <summary>{rt(locale, 'p6_notice')}</summary>
            <Suspense fallback={null}><NoticeForm /></Suspense>
          </details>
        ) : null}
      </section>,
    );
  }
  if (parts.includes('ferry') && rr.weather.length) {
    sections.push(
      <section key="wx" className="rk-sec-box" data-panel="weather" aria-labelledby="rk-wx-h">
        <div className="rk-sec-hd"><h3 id="rk-wx-h">{rt(locale, 'p6_weather')}</h3></div>
        {riskList(rr.weather, null)}
      </section>,
    );
  }
  if (parts.includes('roads')) {
    sections.push(
      <section key="pl" className="rk-sec-box" data-panel="road-pl" aria-labelledby="rk-pl-h">
        <div className="rk-sec-hd">
          <h3 id="rk-pl-h">{rt(locale, 'p6_road_pl')}</h3>
          <span className="rk-sec-sub">{rt(locale, 'p6_road_pl_src')}</span>
        </div>
        {plRows && plRows.length ? roadList(sortRoads(plRows))
          : rr.roadPl.length ? riskList(rr.roadPl, 'PL')
            : <p className="rk-muted">{rt(locale, 'p6_road_pl_none')}</p>}
      </section>,
      <section
        key="se"
        className="rk-sec-box"
        data-panel="road-se"
        data-roads="E4 E22"
        data-demo={seDemo ? 'trafikverket' : undefined}
        aria-labelledby="rk-se-h"
      >
        <div className="rk-sec-hd">
          <h3 id="rk-se-h">{rt(locale, 'p6_road_se')}</h3>
          {seRows ? (
            <span className="rk-sec-sub">
              {rtp(locale, 'p6_road_counts', { list: roadCounts(seRows) || '0' })}
              {PROD && corridor ? ` · ${formatListDateTime(corridor.observedAt)}` : ''}
            </span>
          ) : null}
          {seDemo ? <DemoMark /> : null}
        </div>
        {seDemo && showDemoMarks ? (
          <div className="note rk-demo-note" data-content>
            {t(locale, 'a6_risk_demo_a')} <b>{t(locale, 'a6_risk_demo_b')}</b> {t(locale, 'a6_risk_demo_c')}
          </div>
        ) : null}
        {seRows == null ? <p className="rk-muted" data-no-source="road-se">{rt(locale, 'p6_road_nosrc')}</p>
          : seRows.length === 0 ? <p className="rk-muted" data-empty="road-se-situations">{rt(locale, 'p6_road_none')}</p>
            : roadList(roadsShown)}
        {seRows && seRows.length > FIRST_ROADS ? (
          <button type="button" className="linkbtn rk-more" aria-expanded={allRoads} onClick={() => setAllRoads((v) => !v)}>
            {allRoads ? rt(locale, 'p6_road_less') : rtp(locale, 'p6_road_all', { n: seRows.length })}
          </button>
        ) : null}
        {PROD && corridor && (corridor.slowdownMult !== 1 || corridor.reason) ? (
          <p className="rk-muted" data-corridor="SE_E4">
            {rtp(locale, 'p6_road_slow', { mult: formatPlNumber(corridor.slowdownMult, 2), reason: corridor.reason ? ` · ${corridor.reason}` : '' })}
          </p>
        ) : null}
        {!phone ? <p className="rk-muted">{rt(locale, 'p6_road_note')}</p> : null}
      </section>,
    );
    if (rr.bans.length) {
      sections.push(
        <section key="bans" className="rk-sec-box" data-panel="bans" aria-labelledby="rk-bans-h">
          <div className="rk-sec-hd">
            <h3 id="rk-bans-h">{rt(locale, 'p6_bans')}</h3>
            <span className="rk-sec-sub">{rt(locale, 'p6_bans_note')}</span>
          </div>
          {riskList(rr.bans, null, true)}
        </section>,
      );
    }
  }
  if (parts.includes('system') && role === 'HHL') {
    sections.push(
      <section key="sys" className="rk-sec-box" data-panel="system" aria-labelledby="rk-sys-h">
        <div className="rk-sec-hd">
          <h3 id="rk-sys-h">{rt(locale, 'p6_sys')}</h3>
          <span className="rk-sec-sub">{rt(locale, 'p6_sys_hhl')}</span>
        </div>
        <p className="rk-muted">{sysCount ? rtn(locale, 'p6_sys_n', sysCount) : rt(locale, 'p6_sys_none')}</p>
        {sysCount ? riskList(rr.system, null) : null}
        <button type="button" className="btn ghost rk-sys-go" onClick={() => navigate('/opcje/stan-systemu')}>{rt(locale, 'p6_sys_go')}</button>
      </section>,
    );
  }

  if (!withHead) return <div className="panel rk-panel rk-route"><div className="rk-route-parts">{sections}</div></div>;
  return (
    <section className="panel rk-panel rk-route" data-rk-route aria-labelledby="rk-route-h">
      <header className="rk-head">
        <h2 id="rk-route-h">{rt(locale, 'p6_route')}</h2>
        <span className="rk-head-note">{rt(locale, 'p6_route_nobell')}</span>
      </header>
      <div className="rk-route-parts">{sections}</div>
    </section>
  );
}
