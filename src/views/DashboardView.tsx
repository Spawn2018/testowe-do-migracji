import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { KpiTile } from '../components/ui/KpiTile';
import { DeliveryProgress, progressWeeksFromDb, progressWeeksLabel } from '../components/chart/DeliveryProgress';
import { CorridorMap } from '../components/map/LazyCorridorMap';
import { fmtPct, INTL_LOCALE, pctText, riskText, t, tp } from '../i18n/messages';
import { canSeeMargin, ROLE_META } from '../lib/permissions';
import { getNow } from '../lib/frozenNow';
import { formatEtaBodenCompact } from '../lib/time';
import { computeCorridorKpis } from '../lib/corridorKpis';
import { cockpitFerryBanner, focusVoyage, seaForSailing } from '../lib/voyage';
import { formatSeaRiskLabel } from '../lib/voyageSea';
import { formatAppMoney } from '../lib/money/demoFx';
import { TIER_PILL, aggregateTier } from '../lib/money/loadMoney';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { docsCompleteBeforeLoad, otifShown, prodBannerRisk, riskAsException, sortExceptions } from '../lib/prodDash';

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

  const kpis = useMemo(() => computeCorridorKpis(loads, risks), [loads, risks]);
  const ferryBanner = useMemo(() => cockpitFerryBanner(loads), [loads]);
  /* A6-T1 — liczba transportów: odmiana ze słownika, potem wstawiona do treści banera */
  const bannerBody = riskText(locale, ferryBanner.body, ferryBanner.bodyKey, {
    ...ferryBanner.bodyParams,
    loads: tp(locale, String(ferryBanner.bodyParams.loads_key), { n: ferryBanner.loadCount }),
    loads_key: undefined,
  });
  const {
    delivered,
    delayedN,
    docsOk,
    docsMissing,
    otifPct: otif,
    marginAvg,
    inTransit,
    notInTransit,
    arrivals: arrivals72,
    ferryHot,
  } = kpis;

  // I-2b: produkcja — kolejka z otwartych ryzyk w bazie (risk_signals); demo — kolejka wyjątków z danych demo
  const sortedEx = useMemo(
    () => sortExceptions(PROD_BUILD ? risks.map((r) => riskAsException(r, loads)) : exceptions),
    [exceptions, risks, loads],
  );
  const prodBanner = useMemo(() => (PROD_BUILD ? prodBannerRisk(risks) : null), [risks]);
  const docsOkShown = PROD_BUILD ? docsCompleteBeforeLoad(loads, documents) : docsOk;
  const prodWeeks = useMemo(() => (PROD_BUILD ? progressWeeksLabel(progressWeeksFromDb(loads, getNow())) : null), [loads]);
  const otifText = otifShown(delivered) ? fmtPct(locale, otif / 100, 0) : '—';

  const critEx = sortedEx.filter((e) => e.severity === 'CRITICAL');

  // G4 (z M8): poziom pewności i kurs tymczasowy przy kwotach kokpitu.
  const weekLoads = useMemo(() => loads.filter((l) => l.stage === 'DELIVERED').slice(-6), [loads]);
  const tierTags = (subset: typeof loads) => {
    const agg = aggregateTier(subset, role);
    if (!agg.tier) return null;
    return (
      <span data-kpi-tier={agg.tier} data-kpi-provisional={agg.provisional}>
        <span className={`pill ${TIER_PILL[agg.tier]}`}>{t(locale, `tier_${agg.tier}`)}</span>
        {agg.provisional > 0 ? <> <span className="pill p-amber">{t(locale, 'fx_provisional')} · {agg.provisional}</span></> : null}
      </span>
    );
  };

  return (
    <div className="page-sections" data-page="dash">
      {PROD_BUILD ? (
        /* I-2b: baner z bazy — najpoważniejsze otwarte ryzyko; brak → brak banera (bez treści demo „R-03”, bez prognozy fali) */
        prodBanner ? (
          <div className="banner red" data-banner="db" role="button" tabIndex={0} onClick={() => setView('risk')} onKeyDown={(e) => e.key === 'Enter' && setView('risk')}>
            <span data-content>
              <b>{riskText(locale, prodBanner.top.title, prodBanner.top.titleKey, prodBanner.top.titleParams)}</b>{' '}
              {tp(locale, 'i2_banner_more', { n: String(prodBanner.count) })}
            </span>
          </div>
        ) : null
      ) : role === 'HHL' ? (
        <div className="banner red" role="button" tabIndex={0} onClick={() => setView('risk')} onKeyDown={(e) => e.key === 'Enter' && setView('risk')}>
          <span>
            <span data-content><b>{riskText(locale, ferryBanner.title, ferryBanner.titleKey, ferryBanner.titleParams)}</b> {bannerBody}</span>
          </span>
        </div>
      ) : role === 'KSH' ? (
        <div className="banner">
          <span data-content>
            <b>{t(locale, 'an5_banner_ksh_title')}</b> {t(locale, 'an5_banner_ksh_body')}
          </span>
        </div>
      ) : (
        <div className="banner">
          <span data-content>
            <b>{t(locale, 'an5_banner_scx_title')}</b> {t(locale, 'an5_banner_scx_body')}
          </span>
        </div>
      )}

      <section className="panel section-card">
        <header className="panel-hd">
          <h2>{ROLE_META[role].name}</h2>
          <span className="sub">
            {new Intl.DateTimeFormat(INTL_LOCALE[locale], {
              timeZone: 'Europe/Warsaw',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }).format(getNow())}{' '}
            {t(locale, 'a6_dash_project')}
          </span>
        </header>
        <div className="kpis">
          {role === 'KSH' ? (
            <>
              <KpiTile
                label={t(locale, 'a6_dash_delivered_items')}
                value={`${delivered} / ${loads.length}`}
                delta={tp(locale, 'a6_dash_of_scope', { pct: fmtPct(locale, Math.round((delivered / Math.max(1, loads.length)) * 100) / 100, 0) })}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label={t(locale, "dash_tonnage")}
                value={`${loads
                  .filter((l) => l.stage === 'DELIVERED')
                  .reduce((a, l) => a + l.dims.weightT, 0)
                  .toFixed(0)} t`}
                delta={tp(locale, 'a6_dash_of_total', { n: loads.reduce((a, l) => a + l.dims.weightT, 0).toFixed(0) })}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label={t(locale, "dash_next_delivery")}
                value={arrivals72[0] ? formatEtaBodenCompact(arrivals72[0].etaBoden) : '—'}
                delta={arrivals72[0] ? `${arrivals72[0].code}` : t(locale, 'a6_dash_none_72h')}
                onClick={() =>
                  arrivals72[0] ? selectLoad(arrivals72[0].id) : navigateTo({ view: 'sched' })
                }
              />
              <KpiTile
                label={t(locale, 'kpi_in_transit')}
                value={inTransit}
                delta={t(locale, 'a6_dash_to_boden')}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label={t(locale, 'kpi_otif')}
                value={otifText}
                delta={tp(locale, 'a6_dash_late_n', { n: String(delayedN) })}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label={t(locale, 'exceptions')}
                value={sortedEx.length}
                delta={t(locale, "dash_signals")}
                tone={sortedEx.length > 6 ? 'alert' : 'warn'}
                onClick={() => setView('risk')}
              />
            </>
          ) : role === 'SCX' ? (
            <>
              <KpiTile
                label={t(locale, "dash_to_complete")}
                value={loads.filter((l) =>
                  ['RESOURCES_PENDING', 'DOC_MISSING'].includes(l.status),
                ).length}
                delta={t(locale, "dash_fields_missing")}
                tone="alert"
                onClick={() => setView('tasks')}
              />
              <KpiTile
                label={t(locale, 'kpi_in_transit')}
                value={inTransit}
                delta={t(locale, "dash_my_transit")}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label={t(locale, 'kpi_otif')}
                value={otifText}
                delta={tp(locale, 'a6_dash_late_awi_n', { n: String(delayedN) })}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label={t(locale, 'kpi_week_rev')}
                value={formatAppMoney(
                  weekLoads.reduce((a, l) => a + l.pricing.costTotal, 0),
                  locale,
                  currency,
                )}
                delta={t(locale, "dash_week_invoice")}
                tags={tierTags(weekLoads)}
                onClick={() => navigateTo({ view: 'inv' })}
              />
              <KpiTile
                label={t(locale, 'kpi_ferry_risk')}
                value={ferryHot || '—'}
                delta={shows('seaWeather') ? tp(locale, 'a6_dash_sailing', { risk: formatSeaRiskLabel(seaForSailing(focusVoyage()).risk, locale) }) : t(locale, 'i2_sea_no_source')}
                tone={ferryHot ? 'warn' : 'default'}
                onClick={() => navigateTo({ view: 'risk', riskFilter: 'FERRY' })}
              />
              <KpiTile
                label={t(locale, 'kpi_docs_complete')}
                value={`${docsOkShown} / ${loads.length}`}
                delta={t(locale, "dash_with_permit")}
                onClick={() =>
                  navigateTo({ view: 'docs', docsFilter: docsMissing ? 'missing' : null })
                }
              />
            </>
          ) : (
            <>
              <KpiTile
                label={t(locale, 'kpi_in_transit')}
                value={inTransit}
                delta={tp(locale, 'a6_dash_delivered_prep', { d: String(delivered), p: String(notInTransit) })}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label={t(locale, 'exceptions')}
                value={sortedEx.length}
                delta={t(locale, 'kpi_ex_queue')}
                tone={critEx.length ? 'alert' : 'warn'}
                onClick={() => setView('risk')}
              />
              <KpiTile
                label={t(locale, 'kpi_otif')}
                value={otifText}
                delta={tp(locale, 'a6_dash_late_deliveries', { n: String(delayedN) })}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              {canSeeMargin(role) ? (
                <KpiTile
                  label={t(locale, 'kpi_margin_cum')}
                  value={formatAppMoney(
                    loads.reduce((a, l) => a + l.pricing.margin, 0),
                    locale,
                    currency,
                  )}
                  delta={tp(locale, 'a6_dash_margin_cost', {
                    pct: pctText(locale, marginAvg, 1, `${(marginAvg * 100).toFixed(1).replace('.', ',')}%`),
                    cost: formatAppMoney(loads.reduce((a, l) => a + l.pricing.costTotal, 0), locale, currency),
                  })}
                  tone={marginAvg < 0.12 ? 'warn' : 'good'}
                  tags={tierTags(loads)}
                  onClick={() => navigateTo({ view: 'fin' })}
                />
              ) : (
                <KpiTile
                  label={t(locale, 'kpi_on_road')}
                  value={inTransit}
                  delta={t(locale, 'a6_dash_active')}
                  onClick={() => navigateTo({ view: 'map' })}
                />
              )}
              <KpiTile
                label={t(locale, 'kpi_docs_complete')}
                value={`${docsOkShown} / ${loads.length}`}
                delta={t(locale, 'kpi_docs_delta')}
                onClick={() =>
                  navigateTo({ view: 'docs', docsFilter: docsMissing ? 'missing' : null })
                }
              />
              {shows('detectTimeKpi') ? (
                <KpiTile
                  label={t(locale, 'a6_dash_detect_time')}
                  value="8 min"
                  delta={t(locale, 'a6_dash_median')}
                  tone="good"
                  onClick={() => setView('risk')}
                />
              ) : (
                <KpiTile
                  label={t(locale, 'a6_dash_detect_time')}
                  value={detectLag && detectLag.medianMin != null ? `${detectLag.medianMin} min` : '—'}
                  delta={detectLag && detectLag.samples > 0 ? t(locale, 'i2_detect_samples').replace('{n}', String(detectLag.samples)) : t(locale, 'i2_detect_none')}
                  onClick={() => setView('risk')}
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* Claude renderDash triad: q_title | progress + mini map */}
      <div className="panel grid2" style={{ padding: 0 }}>
        <div style={{ borderRight: '1px solid var(--rule-2)', minWidth: 0 }}>
          <header className="panel-hd">
            <h2>{t(locale, 'exceptions')}</h2>
            <span className="sub">{sortedEx.length}</span>
            <div className="spacer" />
            <button type="button" className="chipbtn" onClick={() => setView('risk')}>
              {t(locale, 'nav_risk')}
            </button>
          </header>
          {sortedEx.length === 0 ? (
            <div className="panel-bd" style={{ color: 'var(--ink-3)' }}>
              {t(locale, 'q_none')}
            </div>
          ) : (
            <ul className="exq">
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
