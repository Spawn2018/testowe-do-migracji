import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import type { RiskType } from '../types';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { DemoMark } from '../components/ui/DemoMark';
import { t } from '../i18n/messages';
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
import { formatSeaRiskLabel } from '../lib/voyageSea';
import { SE_ROUTE_ALTS } from '../lib/seRouteAlts';
import { AUTO_RISK_CODES, autoRiskLabel, type AutoRiskCode } from '../lib/sailings';

const ALT = [
  ['Gdańsk–Karlshamn', '+310 km do Boden', 'Polferries'],
  ['Gdynia–Karlskrona', '+265 km do Boden', 'Stena Line'],
  ['Świnoujście–Trelleborg', '+520 km do Boden', 'TT-Line'],
  ['Świnoujście–Ystad', '+495 km do Boden', 'Unity Line'],
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
  const [picked, setPicked] = useState(0);
  const [seSituations, setSeSituations] = useState<RoadSituation[]>([]);
  const [seMode, setSeMode] = useState<'live' | 'seed'>('seed');

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
  const sailRows = voyageSeaTableRows();
  const focusDayLabel = formatVoyageDayLabel(sailing.depLocal);
  const ferryLoads = loadsOnVoyage(loads, sailing).slice(0, 8);

  useEffect(() => {
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

  const roadSeRisks = risks.filter((r) => r.type === 'ROAD_SE');
  const fmRisks = risks.filter((r) => r.type === 'FORCE_MAJEURE');

  const sevPill = (sev: string) =>
    sev === 'CRITICAL' || sev === 'HIGH' ? 'p-red' : sev === 'MEDIUM' ? 'p-amber' : 'p-go';

  const kindLabel = (k: string) =>
    (
      ({
        roadworks: 'roboty',
        weather: t(locale, 'weather_ice'),
        accident: 'wypadek',
        restriction: 'ograniczenie',
        other: 'inne',
      }) as Record<string, string>
    )[k] ?? k;

  return (
    <div className="dash risk-page page-sections" data-page="risks">
      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>{t(locale, 'exceptions')}</h2>
          <span className="sub">{list.length} otwartych · sortowanie: waga × czas do skutku</span>
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
                tag: r.code && (AUTO_RISK_CODES as string[]).includes(r.code) ? autoRiskLabel(r.code as AutoRiskCode, locale) : undefined,
              }}
              onClick={() => {
                if (r.loadId) selectLoad(r.loadId);
              }}
            />
          ))}
        </ul>
      </div>

      <div className="panel section-card" style={{ margin: 12 }} data-panel="ferry">
        <header className="panel-hd">
          <h2>{t(locale, 'risk_ferry_baltic')}</h2>
          <span className="sub">{t(locale, 'risk_ferry_sub')}</span>
          <div className="spacer" />
          <span className="sub" style={{ color: 'var(--sea)' }}>
            {ferryLabel(sailing)} · MMSI {vessel.mmsi}
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
                        {k}
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
                          Przelicz
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4 className="sec" style={{ marginTop: 15 }}>
                Transporty na rejsie {focusDayLabel}
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

      <div
        className="panel section-card"
        style={{ margin: 12 }}
        data-panel="road-se"
        data-demo={isDemoSourceMode(seMode) ? 'trafikverket' : undefined}
      >
        <header className="panel-hd">
          <h2>{t(locale, 'risk_road_se_title')}</h2>
          <span className="sub">
            Nynashamn→Boden · {trafikverketSourceNote(seMode, showDemoMarks)} · {seSituations.length} {t(locale, 'risk_situations')}
          </span>
          {isDemoSourceMode(seMode) ? <DemoMark /> : null}
        </header>
        <div className="panel-bd">
          {isDemoSourceMode(seMode) && showDemoMarks ? (
            <div className="note" style={{ marginBottom: 12 }} data-content>
              Warunki drogowe SE są <b>demonstracyjne</b> (seed makiety). To nie jest żywy feed
              Trafikverket — brak klucza API. Ten sam wzorzec oznaczenia co stawki demo (D18).
            </div>
          ) : null}
          <div className="two">
            <div>
              <h4 className="sec">{t(locale, 'risk_situations_title')}</h4>
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  {seSituations.map((s) => (
                    <tr
                      key={s.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const linked =
                          risks.find((r) => r.situationId === s.id) ??
                          risks.find((r) => r.type === 'ROAD_SE' || r.type === 'FORCE_MAJEURE');
                        if (linked?.loadId) selectLoad(linked.loadId);
                      }}
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
                    <span data-content>{r.title}</span>
                  </span>
                  <span>{r.delayImpactHours != null ? `+${r.delayImpactHours} h` : r.meta}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--rule-2)', paddingTop: 10 }}>
            <h4 className="sec">{t(locale, 'risk_alt_se')}</h4>
            <div className="alt-list">
              {SE_ROUTE_ALTS.map((alt, i) => (
                <div className="alt-row" key={alt.id}>
                  <div>
                    <b data-content>{alt.title}</b>
                    <span data-content>{alt.detail}</span>
                  </div>
                  <button type="button" className="chipbtn" onClick={() => applySeRouteAlt(i)}>
                    {t(locale, 'risk_choose')}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
