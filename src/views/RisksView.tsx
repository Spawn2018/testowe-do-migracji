import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import type { RiskType } from '../types';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { t } from '../i18n/messages';
import { ferryLabel, vesselById } from '../lib/ferry';
import { fetchSituations, type RoadSituation } from '../lib/trafikverket';
import {
  focusVoyage,
  formatVoyageDayLabel,
  loadsOnVoyage,
  voyageSeaTableRows,
} from '../lib/voyage';

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
  const role = useTowerStore((s) => s.role);
  const riskFilter = useTowerStore((s) => s.riskFilter);
  const locale = useTowerStore((s) => s.locale);
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
        weather: 'pogoda/lód',
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
              }}
              onClick={() => {
                if (r.loadId) selectLoad(r.loadId);
              }}
            />
          ))}
        </ul>
      </div>

      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>Prom i Bałtyk</h2>
          <span className="sub">jedno odejście dziennie · spóźnienie kosztuje dobę</span>
          <div className="spacer" />
          <span className="sub" style={{ color: 'var(--sea)' }}>
            {ferryLabel(sailing)} · MMSI {vessel.mmsi}
          </span>
        </header>
        <div className="panel-bd">
          <div className="two">
            <div>
              <h4 className="sec">Rejs Gdańsk → Nynäshamn</h4>
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
                        <span className={`pill ${row.pillClass}`}>{row.riskLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                Prognoza falowania i wiatru z modelu meteorologicznego, próbkowana w pięciu punktach kursu.
                Progi są ustawiane przez Ciebie. System nie przewiduje decyzji armatora — sygnalizuje warunki
                i porównuje je z komunikatem o kursowaniu promów.
              </div>
            </div>
            <div>
              <h4 className="sec">Alternatywy dla rejsu {focusDayLabel}</h4>
              <table style={{ width: '100%', fontSize: 13 }}>
                <tbody>
                  {ALT.map(([r, k, o], i) => (
                    <tr key={r}>
                      <td style={{ fontWeight: 600 }}>{r}</td>
                      <td>{o}</td>
                      <td className="num" style={{ color: 'var(--ink-3)' }}>
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
                    <span className="code">{l.code}</span> {l.itemType}
                  </span>
                  <span>{l.ferry.bookingRef || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>Warunki drogowe SE · E4</h2>
          <span className="sub">
            Nynäshamn→Boden · Trafikverket {seMode} · {seSituations.length} sytuacji
          </span>
        </header>
        <div className="panel-bd">
          <div className="two">
            <div>
              <h4 className="sec">Sytuacje na korytarzu</h4>
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
                      <td style={{ fontWeight: 600 }}>{s.road}</td>
                      <td>{s.title.replace(/^E4\s*/, '')}</td>
                      <td className="num">+{s.delayMin} min</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`pill ${sevPill(s.severity)}`}>
                          {kindLabel(s.kind)} · {s.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="sec">Ryzyka ROAD_SE / siła wyższa</h4>
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
                    <span className="code">{r.type === 'FORCE_MAJEURE' ? 'FM' : 'SE'}</span>{' '}
                    {r.title}
                  </span>
                  <span>{r.delayImpactHours != null ? `+${r.delayImpactHours} h` : r.meta}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--rule-2)', paddingTop: 10 }}>
            <h4 className="sec">Alternatywy trasy SE (zagrożenia drogowe)</h4>
            <div className="alt-list">
              <div className="alt-row">
                <div>
                  <b>E4 → E18 via Västerås / Uppsala</b>
                  <span>Omija roboty E4 Gävle–Söderhamn · +45–70 min · zalecane przy HIGH</span>
                </div>
                <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().pushToast('Alternatywa SE: E4→E18', 'MEDIUM')}>Wybierz</button>
              </div>
              <div className="alt-row">
                <div>
                  <b>E4 → Rv 83 / Rv 84 (Ljusdal – Ånge)</b>
                  <span>Objazd śnieżycy środkowego Norrland · +90–120 min · zima</span>
                </div>
                <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().pushToast('Alternatywa SE: Rv83/84', 'MEDIUM')}>Wybierz</button>
              </div>
              <div className="alt-row">
                <div>
                  <b>Kolej + ostatnia mila (Boden rail terminal)</b>
                  <span>Gdy FORCE_MAJEURE na E4 północ · przeładunek SE · +1–2 doby</span>
                </div>
                <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().pushToast('Alternatywa SE: kolej Boden', 'MEDIUM')}>Wybierz</button>
              </div>
              <div className="alt-row">
                <div>
                  <b>Pauza w Gävle / Sundsvall + nowy slot Boden</b>
                  <span>Gdy okno Stegra nie dotrzymane · unikaj nocnego podejścia placu</span>
                </div>
                <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().pushToast('Alternatywa SE: pauza + slot', 'MEDIUM')}>Wybierz</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
