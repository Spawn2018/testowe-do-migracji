import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import type { RiskType } from '../types';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { DecisionCentre } from '../components/DecisionCentre';
import { DemoMark } from '../components/ui/DemoMark';
import { riskText, t, tp } from '../i18n/messages';
import { ferryLabel, vesselById } from '../lib/ferry';
import { fetchSituations, type RoadSituation } from '../lib/trafikverket';
import {
  focusVoyage,
  formatVoyageDayLabel,
  loadsOnVoyage,
  voyageSeaTableRows,
} from '../lib/voyage';
import { isDemoSourceMode, trafikverketSourceNote } from '../lib/demoLabel';
import { severityLabel } from '../lib/enumLabels';
import { formatSeaRiskLabel, formatWaveM, formatWindMs } from '../lib/voyageSea';
import { fetchMarineCondition, type MarineConditionRow } from '../lib/marineWeatherDb';
import { fetchCorridorCondition, type CorridorConditionRow } from '../lib/corridorConditionsDb';
import { knotsToMs } from '../lib/marineUnits';
import { SE_ROUTE_ALTS } from '../lib/seRouteAlts';
import { AUTO_RISK_CODES, autoRiskLabel, effDeparture, fmtLocal, sailingStatusLabel, sailingStatusPill, type AutoRiskCode } from '../lib/sailings';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { getNowMs } from '../lib/frozenNow';
import { clickableRow } from '../lib/clickableRow';
import { seaRiskPillClass } from '../lib/voyageSea';

const ALT = [
  ['Gdańsk–Karlshamn', 310, 'Polferries'],
  ['Gdynia–Karlskrona', 265, 'Stena Line'],
  ['Świnoujście–Trelleborg', 520, 'TT-Line'],
  ['Świnoujście–Ystad', 495, 'Unity Line'],
] as const;

export function RisksView() {
  const risks = useTowerStore((s) => s.risks);
  const loads = useTowerStore((s) => s.loads);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const applyPlanB = useTowerStore((s) => s.applyPlanB);
  const applySeRouteAlt = useTowerStore((s) => s.applySeRouteAlt);
  const role = useTowerStore((s) => s.role);
  const riskFilter = useTowerStore((s) => s.riskFilter);
  const locale = useTowerStore((s) => s.locale);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const sailings = useTowerStore((s) => s.sailings);
  const [picked, setPicked] = useState(0);
  const [seSituations, setSeSituations] = useState<RoadSituation[]>([]);
  const [seMode, setSeMode] = useState<'live' | 'seed'>('seed');
  const [marine, setMarine] = useState<MarineConditionRow | null>(null);
  const [corridor, setCorridor] = useState<CorridorConditionRow | null>(null);

  const list = useMemo(() => {
    let r = risks;
    if (role === 'KSH') r = r.filter((x) => x.type !== 'OPS' || x.owner === 'HHL');
    if (role === 'SCX')
      r = r.filter(
        (x) =>
          x.owner === 'SCX' ||
          x.type === 'FERRY' ||
          x.type === 'ROAD_SE' ||
          x.type === 'FORCE_MAJEURE',
      );
    if (riskFilter && riskFilter !== 'ALL') {
      r = r.filter((x) => x.type === (riskFilter as RiskType) || x.id === riskFilter);
    }
    return r;
  }, [risks, role, riskFilter]);

  const ferryRisk = risks.find((r) => r.type === 'FERRY' && r.ferryPlanB);
  const sailing = focusVoyage();
  const vessel = vesselById(sailing.vessel);
  const sailRows = voyageSeaTableRows(undefined, undefined, locale);
  const focusDayLabel = formatVoyageDayLabel(sailing.depLocal);
  const ferryLoads = loadsOnVoyage(loads, sailing).slice(0, 8);
  const dbSailings = useMemo(() => {
    const now = getNowMs() - 3 * 3600_000;
    return sailings.filter((x) => x.route === 'GDN-NYN' && Date.parse(effDeparture(x)) >= now)
      .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b))).slice(0, 6);
  }, [sailings]);

  useEffect(() => {
    // Demo: seed Trafikverket w UI. Produkcja: corridor_conditions z II-6 (road-se).
    if (PROD_BUILD) {
      let cancelled = false;
      fetchCorridorCondition().then((row) => {
        if (!cancelled) setCorridor(row);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!shows('roadSituationsSe')) return;
    let cancelled = false;
    fetchSituations().then((r) => {
      if (cancelled) return;
      setSeSituations(r.items);
      setSeMode(r.mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // II-8: produkcja — pogoda morska z marine_conditions (FMI+DMI+SMHI)
    if (!PROD_BUILD) return;
    let cancelled = false;
    fetchMarineCondition().then((row) => {
      if (!cancelled) setMarine(row);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const roadSeHasSource = PROD_BUILD ? corridor != null : shows('roadSituationsSe');
  const roadSeRisks = risks.filter((r) => r.type === 'ROAD_SE');
  const fmRisks = risks.filter((r) => r.type === 'FORCE_MAJEURE');

  const sevPill = (sev: string) =>
    sev === 'CRITICAL' || sev === 'HIGH' ? 'p-red' : sev === 'MEDIUM' ? 'p-amber' : 'p-go';

  const kindLabel = (k: string) =>
    (
      ({
        roadworks: t(locale, 'a6_kind_roadworks'),
        weather: t(locale, 'weather_ice'),
        accident: t(locale, 'a6_kind_accident'),
        restriction: t(locale, 'a6_kind_restriction'),
        other: t(locale, 'a6_kind_other'),
      }) as Record<string, string>
    )[k] ?? k;

  return (
    <div className="dash risk-page page-sections" data-page="risks">
      {PROD_BUILD ? <DecisionCentre /> : null}
      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>{t(locale, 'exceptions')}</h2>
          <span className="sub">{tp(locale, 'a6_risk_open_sort', { n: String(list.length) })}</span>
        </header>
        <ul className="exq">
          {list.map((r) => (
            <ExceptionRow
              key={r.id}
              item={{
                id: r.id,
                severity: r.severity,
                title: r.title,
                owner: r.owner,
                meta: r.meta,
                nextAction: r.nextAction,
                ageHours: r.ageHours,
                loadId: r.loadId,
                code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
                titleKey: r.titleKey,
                titleParams: r.titleParams,
                metaKey: r.metaKey,
                metaParams: r.metaParams,
                tag: r.code && (AUTO_RISK_CODES as string[]).includes(r.code) ? autoRiskLabel(r.code as AutoRiskCode, locale) : undefined,
              }}
              onClick={() => {
                if (r.loadId) selectLoad(r.loadId);
              }}
            />
          ))}
        </ul>
      </div>

      {!shows('seaWeather') || !shows('ferryAlternatives') ? (
        /* I-2e: produkcja — rozkład z tabeli `sailings`; pogoda morska i przeprawy alternatywne: brak źródła danych */
        <div className="panel section-card" style={{ margin: 12 }} data-panel="ferry" data-source="db">
          <header className="panel-hd">
            <h2>{t(locale, 'risk_ferry_baltic')}</h2>
            <span className="sub">{t(locale, 'i2_ferry_db_sub')}</span>
          </header>
          <div className="panel-bd">
            <div className="two">
              <div>
                <h4 className="sec">{t(locale, 'risk_voyage_gdn_nyn')}</h4>
                {dbSailings.length === 0 ? (
                  <div className="note" style={{ border: 0 }}>{t(locale, 'i2_no_sailing')}</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <tbody>
                      {dbSailings.map((x) => (
                        <tr key={x.id}>
                          <td><span className="mono">{fmtLocal(effDeparture(x))}</span></td>
                          <td>{x.vessel}</td>
                          <td className="num">{loads.filter((l) => l.sailingId === x.id).length}</td>
                          <td style={{ textAlign: 'right' }}><span className={`pill ${sailingStatusPill(x.status)}`}>{sailingStatusLabel(x.status, locale)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {marine && (marine.maxWaveM != null || marine.maxGustKn != null) ? (
                  <div data-source="marine" style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                      <span className="num">
                        {marine.maxWaveM != null ? formatWaveM(marine.maxWaveM, locale) : '—'}
                      </span>
                      <span className="num">
                        {marine.maxGustKn != null
                          ? formatWindMs(knotsToMs(marine.maxGustKn), locale)
                          : '—'}
                      </span>
                      <span className={`pill ${seaRiskPillClass(marine.risk)}`}>
                        {formatSeaRiskLabel(marine.risk, locale)}
                      </span>
                    </div>
                    <div className="note" style={{ marginTop: 6, border: 0 }}>
                      {tp(locale, 'i2_sea_wave_gust', {
                        wave: marine.maxWaveM != null ? formatWaveM(marine.maxWaveM, locale) : '—',
                        gust: marine.maxGustKn != null ? `${Math.round(marine.maxGustKn)} kn` : '—',
                        wave_thr: String(marine.waveThrM),
                        gust_thr: String(marine.gustThrKn),
                      })}
                    </div>
                    <div className="sub" data-attribution="marine" style={{ marginTop: 4 }}>
                      {tp(locale, 'i2_sea_source', { attr: marine.attribution })}
                      {marine.observedAt
                        ? ` · ${tp(locale, 'i2_sea_observed', { at: fmtLocal(marine.observedAt) })}`
                        : null}
                    </div>
                  </div>
                ) : (
                  <div className="note" data-no-source="sea" style={{ marginTop: 8 }}>{t(locale, 'i2_sea_no_source')}</div>
                )}
              </div>
              <div>
                <h4 className="sec">{t(locale, 'risk_alt_for_day').replace(/\s*$/, '')}</h4>
                <div className="note" data-no-source="ferry-alt">{t(locale, 'i2_alt_no_source')}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="panel section-card" style={{ margin: 12 }} data-panel="ferry">
        <header className="panel-hd">
          <h2>{t(locale, 'risk_ferry_baltic')}</h2>
          <span className="sub">{t(locale, 'risk_ferry_sub')}</span>
          <div className="spacer" />
          <span className="sub" style={{ color: 'var(--sea)' }}>
            {ferryLabel(sailing)} · {tp(locale, 'a6_risk_mmsi', { mmsi: String(vessel.mmsi) })}
          </span>
        </header>
        <div className="panel-bd">
          <div className="two">
            <div>
              <h4 className="sec">{t(locale, 'risk_voyage_gdn_nyn')}</h4>
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  {sailRows.map((row) => (
                    <tr key={row.sailing.id} style={row.focused ? { background: 'var(--surface-2)' } : undefined}>
                      <td>
                        <span className="mono">{row.dayLabel}</span>
                      </td>
                      <td>{row.vesselName}</td>
                      <td className="num">{row.wave}</td>
                      <td className="num">{row.wind}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`pill ${row.pillClass}`}>{formatSeaRiskLabel(row.riskLabel, locale)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>{t(locale, 'risk_sea_forecast')}</div>
            </div>
            <div>
              <h4 className="sec">{t(locale, 'risk_alt_for_day')} {focusDayLabel}</h4>
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  {ALT.map(([r, k, o], i) => (
                    <tr key={r}>
                      <td style={{ fontWeight: 600 }} data-content>{r}</td>
                      <td data-content>{o}</td>
                      <td className="num" style={{ color: 'var(--ink-3)' }} data-content>
                        {tp(locale, 'a6_risk_alt_km', { km: String(k) })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="chipbtn"
                          aria-pressed={picked === i}
                          onClick={() => {
                            setPicked(i);
                            if (ferryRisk) applyPlanB(ferryRisk.id, i);
                          }}
                        >
                          {t(locale, 'risk_recalc')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4 className="sec" style={{ marginTop: 15 }}>
                {t(locale, 'risk_loads_on_voyage')} {focusDayLabel}
              </h4>
              {ferryLoads.map((l) => (
                <div
                  key={l.id}
                  className="mrow"
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectLoad(l.id)}
                >
                  <span className="lbl">
                    <span className="code" data-content>{l.code}</span> <span data-content>{l.itemType}</span>
                  </span>
                  <span>{l.ferry.bookingRef || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      <div
        className="panel section-card"
        style={{ margin: 12 }}
        data-panel="road-se"
        data-demo={shows('roadSituationsSe') && isDemoSourceMode(seMode) ? 'trafikverket' : undefined}
      >
        <header className="panel-hd">
          <h2>{t(locale, 'risk_road_se_title')}</h2>
          <span className="sub">
            {roadSeHasSource
              ? PROD_BUILD && corridor
                ? <>{t(locale, 'a6_risk_route_se')} · Trafikverket · ×{corridor.slowdownMult.toFixed(2)}{corridor.reason ? ` · ${corridor.reason}` : ''}</>
                : <>{t(locale, 'a6_risk_route_se')} · {trafikverketSourceNote(seMode, showDemoMarks, locale)} · {seSituations.length} {t(locale, 'risk_situations')}</>
              : <>{t(locale, 'a6_risk_route_se')} · {t(locale, 'i2_no_source')}</>}
          </span>
          {shows('roadSituationsSe') && isDemoSourceMode(seMode) ? <DemoMark /> : null}
        </header>
        <div className="panel-bd">
          {shows('roadSituationsSe') && isDemoSourceMode(seMode) && showDemoMarks ? (
            <div className="note" style={{ marginBottom: 12 }} data-content>
              {t(locale, 'a6_risk_demo_a')} <b>{t(locale, 'a6_risk_demo_b')}</b> {t(locale, 'a6_risk_demo_c')}
            </div>
          ) : null}
          {PROD_BUILD && corridor ? (
            <div className="note" style={{ marginBottom: 12 }} data-content data-corridor="SE_E4">
              {corridor.zrodlo ?? 'Trafikverket'}
              {corridor.conditions != null ? ` · RC ${corridor.conditions}` : ''}
              {corridor.weather != null ? ` · WX ${corridor.weather}` : ''}
              {corridor.adverseConditions || corridor.adverseWeather
                ? ` · ${t(locale, 'risk_situations')}: ${(corridor.adverseConditions ?? 0) + (corridor.adverseWeather ?? 0)}`
                : ` · ${t(locale, 'risk_situations')}: 0`}
              {' · '}
              {new Date(corridor.observedAt).toLocaleString(
                locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL',
              )}
            </div>
          ) : null}
          <div className="two">
            <div>
              <h4 className="sec">{t(locale, 'risk_situations_title')}</h4>
              {!roadSeHasSource ? <div className="note" data-no-source="road-se">{t(locale, 'i2_road_se_no_source')}</div> : null}
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  {PROD_BUILD
                    ? roadSeRisks.map((r) => (
                        <tr
                          key={r.id}
                          style={{ cursor: r.loadId ? 'pointer' : undefined }}
                          {...(r.loadId ? clickableRow(() => selectLoad(r.loadId!)) : {})}
                        >
                          <td style={{ fontWeight: 600 }} data-content>E4</td>
                          <td data-content>{riskText(locale, r.title, r.titleKey, r.titleParams)}</td>
                          <td className="num">{r.delayImpactHours != null ? `+${r.delayImpactHours} h` : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`pill ${sevPill(r.severity)}`}>
                              {severityLabel(r.severity, locale)}
                            </span>
                          </td>
                        </tr>
                      ))
                    : seSituations.map((s) => (
                    <tr
                      key={s.id}
                      style={{ cursor: 'pointer' }}
                      {...clickableRow(() => {
                        const linked =
                          risks.find((r) => r.situationId === s.id) ??
                          risks.find((r) => r.type === 'ROAD_SE' || r.type === 'FORCE_MAJEURE');
                        if (linked?.loadId) selectLoad(linked.loadId);
                      })}
                    >
                      <td style={{ fontWeight: 600 }} data-content>{s.road}</td>
                      <td data-content>{s.title.replace(/^E4\s*/, '')}</td>
                      <td className="num">+{s.delayMin} min</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`pill ${sevPill(s.severity)}`}>
                          {kindLabel(s.kind)} · {severityLabel(s.severity, locale)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="sec">{t(locale, 'risk_se_fm')}</h4>
              {[...roadSeRisks, ...fmRisks].map((r) => (
                <div
                  key={r.id}
                  className="mrow"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (r.loadId) selectLoad(r.loadId);
                  }}
                >
                  <span className="lbl">
                    <span className="code" data-content>{r.type === 'FORCE_MAJEURE' ? 'FM' : 'SE'}</span>{' '}
                    <span data-content>{riskText(locale, r.title, r.titleKey, r.titleParams)}</span>
                  </span>
                  <span>{r.delayImpactHours != null ? `+${r.delayImpactHours} h` : riskText(locale, r.meta, r.metaKey, r.metaParams)}</span>
                </div>
              ))}
            </div>
          </div>

          {shows('seRouteAlternatives') ? (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--rule-2)', paddingTop: 10 }}>
            <h4 className="sec">{t(locale, 'risk_alt_se')}</h4>
            <div className="alt-list">
              {SE_ROUTE_ALTS.map((alt, i) => (
                <div className="alt-row" key={alt.id}>
                  <div>
                    <b data-content>{t(locale, `a6_alt_${alt.id}_title`)}</b>
                    <span data-content>{t(locale, `a6_alt_${alt.id}_detail`)}</span>
                  </div>
                  <button type="button" className="chipbtn" onClick={() => applySeRouteAlt(i)}>
                    {t(locale, 'risk_choose')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
