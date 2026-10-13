import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { Cockpit } from '../components/dash/Cockpit';
import { DeliveryProgress, progressWeeksFromDb, progressWeeksLabel } from '../components/chart/DeliveryProgress';
import { CorridorMap } from '../components/map/LazyCorridorMap';
import { hasKey, INTL_LOCALE, navLabel, t, tp } from '../i18n/messages';
import { isTechnicalRoadNotice } from '../lib/format';
import { canSeeMargin, ROLE_META } from '../lib/permissions';
import { getNow } from '../lib/frozenNow';
import { computeCorridorKpis } from '../lib/corridorKpis';
import { focusVoyage, seaForSailing } from '../lib/voyage';
import { vesselById } from '../lib/ferry';
import { effDeparture, nearestCrossingSailings } from '../lib/sailings';
import { buildCockpit, invoicedSets, todoQueue, type CockpitTile } from '../lib/cockpitE9';
import { getAuthProfile } from '../auth/profile';
import { formatSeaRiskLabel } from '../lib/voyageSea';
import { formatAppMoney } from '../lib/money/demoFx';
import { aggregateTier } from '../lib/money/loadMoney';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { riskAsException, sortExceptions } from '../lib/prodDash';

export function DashboardView() {
  // I-2l: czas wykrycia odchylenia z bazy (kpi_detection_lag) — wyłącznie build produkcyjny, moduł leniwy
  const [detectLag, setDetectLag] = useState<{ samples: number; medianMin: number | null } | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
      let cancelled = false;
      void import('../lib/detectLag')
        .then((m) => m.fetchDetectionLag())
        .then((r) => { if (!cancelled) setDetectLag(r); }, () => { if (!cancelled) setDetectLag({ samples: 0, medianMin: null }); });
      return () => { cancelled = true; };
    }
    return undefined;
  }, []);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const loads = useTowerStore((s) => s.loads);
  const exceptions = useTowerStore((s) => s.exceptions);
  const risks = useTowerStore((s) => s.risks);
  const documents = useTowerStore((s) => s.documents);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const navigateTo = useTowerStore((s) => s.navigateTo);
  const setView = useTowerStore((s) => s.setView);

  const bills = useTowerStore((s) => s.bills);
  const invoices = useTowerStore((s) => s.invoices);
  const sailings = useTowerStore((s) => s.sailings);

  /* „Brak dokumentów” — filtr strony Dokumenty po kliknięciu kafelka zezwoleń */
  const { docsMissing } = useMemo(() => computeCorridorKpis(loads, risks), [loads, risks]);

  // I-2b: produkcja — kolejka z otwartych ryzyk w bazie (risk_signals); demo — kolejka wyjątków z danych demo
  const sortedEx = useMemo(
    () => sortExceptions(PROD_BUILD ? risks.filter((r) => !isTechnicalRoadNotice(r.title)).map((r) => riskAsException(r, loads)) : exceptions),
    [exceptions, risks, loads],
  );
  const prodWeeks = useMemo(() => (PROD_BUILD ? progressWeeksLabel(progressWeeksFromDb(loads, getNow())) : null), [loads]);
  /* „Do zrobienia” (E9): ta sama liczba co przy „Ryzyka” w menu i na dolnym pasku (todoQueue w cockpitE9.ts) */
  const todo = useMemo(() => todoQueue(role, risks, loads) ?? { total: 0, loads: 0, other: 0 }, [role, risks, loads]);

  /* wyglad/P3-b (E9, img/e9-after): Kokpit każdej firmy — 6 kafelków w 2 kolumnach; baner „+N ryzyk”
     zastąpił kafelek „Do zrobienia” (E8 pkt 6). Liczby z danych aplikacji (cockpitE9.ts); reguły E7/E15/E16/E25 w P4–P6. */
  const profileRole = getAuthProfile()?.role ?? null;
  const userKind = profileRole ?? (role === 'HHL' ? 'HHL_ADMIN' : role === 'KSH' ? 'CLIENT_USER' : 'CARRIER_DISPATCH');
  const kindText = hasKey(locale, `p3b_kind_${userKind}`) ? t(locale, `p3b_kind_${userKind}`) : '';
  const dateText = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' }).format(getNow());
  const { invoicedLoadIds, billedLoadIds } = useMemo(() => invoicedSets(invoices, bills), [invoices, bills]);
  const ferry = useMemo(() => {
    if (PROD_BUILD) {
      const near = nearestCrossingSailings(sailings, getNow().getTime(), 1);
      const s = [near.stena[0], near.polferries[0]].filter(Boolean).sort((a, b) => Date.parse(effDeparture(a!)) - Date.parse(effDeparture(b!)))[0];
      if (!s) return null;
      const [from, to] = s.route.split('-');
      /* E9 B7: prognoza morza w bazie (marine_conditions) nie jest jeszcze w danych aplikacji — „brak źródła danych” */
      return { vessel: s.vessel, route: `${from} → ${to}`, depIso: effDeparture(s), sea: null };
    }
    const s = focusVoyage();
    const sea = shows('seaWeather') ? seaForSailing(s) : null;
    return {
      vessel: vesselById(s.vessel).short || vesselById(s.vessel).name,
      route: `${s.depPort} → ${s.arrPort}`,
      depIso: new Date(Date.parse(s.depLocal)).toISOString(),
      sea: sea ? { waveM: sea.waveM, risk: formatSeaRiskLabel(sea.risk, locale) } : null,
    };
  }, [sailings, locale]);
  const marginInfo = useMemo(() => {
    const rev = loads.reduce((a, l) => a + (l.pricing?.revTotal || 0), 0);
    const mar = loads.reduce((a, l) => a + (l.pricing?.margin || 0), 0);
    const agg = aggregateTier(loads, role);
    return {
      pct: rev > 0 ? mar / rev : null,
      moneyText: formatAppMoney(mar, locale, currency),
      tierText: agg.tier ? t(locale, `tier_${agg.tier}`).toLowerCase() : t(locale, 'tier_PROGNOZA').toLowerCase(),
    };
  }, [loads, role, locale, currency]);
  const tiles = buildCockpit({
    role, locale, nowIso: getNow().toISOString(), loads, documents, bills, invoicedLoadIds, billedLoadIds,
    todo, ferry, margin: marginInfo,
  });
  const marginTier = aggregateTier(loads, role);
  const moneyTags = marginTier.tier ? (
    <span data-kpi-tier={marginTier.tier} data-kpi-provisional={marginTier.provisional}>
      {marginTier.provisional > 0 ? <span className="pill p-amber">{t(locale, 'fx_provisional')} · {marginTier.provisional}</span> : null}
    </span>
  ) : null;
  /* Stopka HHL (E9): „Czas wykrycia odchylenia: **za mało danych** (2 z 5 zdarzeń w 30 dniach)”; mediana od 5 zdarzeń */
  const detect: [string, string] = shows('detectTimeKpi')
    ? [tp(locale, 'p3b_detect_ok', { m: '8' }), tp(locale, 'p3b_detect_ok_n', { n: 12 })]
    : detectLag && detectLag.samples >= 5 && detectLag.medianMin != null
      ? [tp(locale, 'p3b_detect_ok', { m: String(detectLag.medianMin) }), tp(locale, 'p3b_detect_ok_n', { n: detectLag.samples })]
      : detectLag && detectLag.samples > 0
        ? [t(locale, 'p3b_detect_few'), tp(locale, 'p3b_detect_few_n', { n: String(detectLag.samples) })]
        : [t(locale, 'p3b_detect_none'), t(locale, 'p3b_detect_none_n')];
  const footer = role === 'HHL' && canSeeMargin(role) ? (
    <span data-detect-lag>
      {t(locale, 'p3b_detect_label')} <b>{detect[0]}</b> {detect[1]}
    </span>
  ) : null;
  const onGo = (tile: CockpitTile) => {
    if (tile.id === 'permits7') { navigateTo({ view: 'docs', docsFilter: docsMissing ? 'missing' : null }); return; }
    if (tile.id === 'ferry') { navigateTo({ view: 'risk', riskFilter: 'FERRY' }); return; }
    navigateTo({ view: tile.go ?? 'sched' });
  };

  return (
    <div className="page-sections" data-page="dash">
      <Cockpit
        locale={locale}
        role={role}
        org={ROLE_META[role].name}
        kind={kindText}
        date={dateText}
        tiles={tiles}
        footer={footer}
        moneyTags={moneyTags}
        onGo={onGo}
      />

      {/* Claude renderDash triad: q_title | progress + mini map */}
      <div className="panel grid2" style={{ padding: 0 }}>
        <div style={{ borderRight: '1px solid var(--rule-2)', minWidth: 0 }}>
          {/* E8 pkt 6 i V5: „Najpilniejsze z „Do zrobienia”” (KSH: z „Sytuacji na trasie”); telefon — 3 pierwsze */}
          <header className="panel-hd ck-list-hd">
            <h2>{t(locale, 'p3b_urgent')}</h2>
            <span className="sub">{t(locale, role === 'KSH' ? 'p3b_urgent_sub_ksh' : 'p3b_urgent_sub')}</span>
            <div className="spacer" />
            <button type="button" className="chipbtn ck-desk" onClick={() => setView('risk')}>
              {navLabel(locale, 'risk', role)}
            </button>
          </header>
          {sortedEx.length === 0 ? (
            <div className="panel-bd" style={{ color: 'var(--ink-3)' }}>
              {t(locale, 'q_none')}
            </div>
          ) : (
            <ul className="exq ck-urgent">
              {sortedEx.slice(0, 7).map((ex) => (
                <ExceptionRow
                  key={ex.id}
                  item={ex}
                  onClick={() => {
                    if (ex.loadId) selectLoad(ex.loadId);
                    else setView('risk');
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <header className="panel-hd">
            <h2>{t(locale, 'progress')}</h2>
            <span className="sub">{PROD_BUILD ? (prodWeeks ? tp(locale, 'i2_progress_weeks', { r: prodWeeks }) : '') : t(locale, 'progress_weeks')}</span>
          </header>
          <div className="panel-bd">
            <DeliveryProgress loads={loads} locale={locale} />
          </div>
          <header className="panel-hd" style={{ borderTop: '1px solid var(--rule-2)' }}>
            <h2>{t(locale, 'nav_map')}</h2>
            <div className="spacer" />
            <button
              type="button"
              className="chipbtn"
              onClick={() => navigateTo({ view: 'map' })}
            >
              {t(locale, 'nav_map')}
            </button>
          </header>
          <div
            className="grid2-map-body minimap"
            style={{ overflow: 'hidden', background: 'var(--surface-3)', position: 'relative' }}
          >
            <CorridorMap loads={loads} embedded />
          </div>
        </div>
      </div>
    </div>
  );
}
