import { useMemo } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { ExceptionRow } from '../components/ui/ExceptionRow';
import { KpiTile } from '../components/ui/KpiTile';
import { DeliveryProgress } from '../components/chart/DeliveryProgress';
import { CorridorMap } from '../components/map/CorridorMap';
import { t } from '../i18n/messages';
import { canSeeMargin, ROLE_META } from '../lib/permissions';
import { getNow } from '../lib/frozenNow';
import { formatEtaBodenCompact } from '../lib/time';
import { computeCorridorKpis } from '../lib/corridorKpis';
import { cockpitFerryBanner, focusVoyage, seaForSailing } from '../lib/voyage';
import { formatMoney } from '../lib/money/engine';

export function DashboardView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const loads = useTowerStore((s) => s.loads);
  const exceptions = useTowerStore((s) => s.exceptions);
  const risks = useTowerStore((s) => s.risks);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const navigateTo = useTowerStore((s) => s.navigateTo);
  const setView = useTowerStore((s) => s.setView);

  const kpis = useMemo(() => computeCorridorKpis(loads, risks), [loads, risks]);
  const ferryBanner = useMemo(() => cockpitFerryBanner(loads), [loads]);
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

  const sortedEx = useMemo(
    () =>
      [...exceptions].sort((a, b) => {
        const sev = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
        return sev[a.severity] - sev[b.severity] || b.ageHours - a.ageHours;
      }),
    [exceptions],
  );

  const critEx = sortedEx.filter((e) => e.severity === 'CRITICAL');

  return (
    <div className="page-sections" data-page="dash">
      {role === 'HHL' ? (
        <div className="banner red" role="button" tabIndex={0} onClick={() => setView('risk')} onKeyDown={(e) => e.key === 'Enter' && setView('risk')}>
          <span>
            <b>{ferryBanner.title}</b> {ferryBanner.body}
          </span>
        </div>
      ) : role === 'KSH' ? (
        <div className="banner">
          <span>
            <b>Dostawa 26.09 o 11:30.</b> Dźwig i ekipa potrzebne przez 3 h. Transport R-03
            przekracza okno o 1 h 35 min — nowa propozycja godziny czeka na potwierdzenie.
          </span>
        </div>
      ) : (
        <div className="banner">
          <span>
            <b>7 pól bez uzupełnienia.</b> Trzy transporty z załadunkiem w ciągu 48 h nie mają
            zezwolenia. Lista w zakładce Moje zadania.
          </span>
        </div>
      )}

      <section className="panel section-card">
        <header className="panel-hd">
          <h2>{ROLE_META[role].name}</h2>
          <span className="sub">
            {new Intl.DateTimeFormat('pl-PL', {
              timeZone: 'Europe/Warsaw',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }).format(getNow())}{' '}
            · projekt Stegra Boden
          </span>
        </header>
        <div className="kpis">
          {role === 'KSH' ? (
            <>
              <KpiTile
                label="Elementy dostarczone"
                value={`${delivered} / ${loads.length}`}
                delta={`${Math.round((delivered / Math.max(1, loads.length)) * 100)}% zakresu`}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label="Tonaż na placu"
                value={`${loads
                  .filter((l) => l.stage === 'DELIVERED')
                  .reduce((a, l) => a + l.dims.weightT, 0)
                  .toFixed(0)} t`}
                delta={`z ${loads.reduce((a, l) => a + l.dims.weightT, 0).toFixed(0)} t`}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label="Najbliższa dostawa"
                value={arrivals72[0] ? formatEtaBodenCompact(arrivals72[0].etaBoden) : '—'}
                delta={arrivals72[0] ? `${arrivals72[0].code}` : 'brak w 72h'}
                onClick={() =>
                  arrivals72[0] ? selectLoad(arrivals72[0].id) : navigateTo({ view: 'sched' })
                }
              />
              <KpiTile
                label="Transporty w drodze"
                value={inTransit}
                delta="w drodze do Boden"
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label="Terminowość"
                value={`${otif}%`}
                delta={`${delayedN} poza oknem`}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label={t(locale, 'exceptions')}
                value={sortedEx.length}
                delta="sygnałów w Twoich dostawach"
                tone={sortedEx.length > 6 ? 'alert' : 'warn'}
                onClick={() => setView('risk')}
              />
            </>
          ) : role === 'SCX' ? (
            <>
              <KpiTile
                label="Do uzupełnienia"
                value={loads.filter((l) =>
                  ['RESOURCES_PENDING', 'DOC_MISSING'].includes(l.status),
                ).length}
                delta="pól bez uzupełnienia"
                tone="alert"
                onClick={() => setView('tasks')}
              />
              <KpiTile
                label="Transporty w drodze"
                value={inTransit}
                delta="moich transportów w drodze"
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label="Terminowość"
                value={`${otif}%`}
                delta={`${delayedN} poza oknem awizacji`}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              <KpiTile
                label="Przychód tygodnia"
                value={formatMoney(
                  loads
                    .filter((l) => l.stage === 'DELIVERED')
                    .slice(-6)
                    .reduce((a, l) => a + l.pricing.costTotal, 0),
                  locale,
                  currency,
                )}
                delta="tydzień 38, do zafakturowania"
                onClick={() => navigateTo({ view: 'inv' })}
              />
              <KpiTile
                label="Ryzyko promowe"
                value={ferryHot || '—'}
                delta={`rejs · ${seaForSailing(focusVoyage()).risk}`}
                tone={ferryHot ? 'warn' : 'default'}
                onClick={() => navigateTo({ view: 'risk', riskFilter: 'FERRY' })}
              />
              <KpiTile
                label="Komplet dokumentów"
                value={`${docsOk} / ${loads.length}`}
                delta="transportów z zezwoleniem"
                onClick={() =>
                  navigateTo({ view: 'docs', docsFilter: docsMissing ? 'missing' : null })
                }
              />
            </>
          ) : (
            <>
              <KpiTile
                label="Transporty w drodze"
                value={inTransit}
                delta={`${delivered} dostarczonych, ${notInTransit} w przygotowaniu`}
                onClick={() => navigateTo({ view: 'map' })}
              />
              <KpiTile
                label={t(locale, 'exceptions')}
                value={sortedEx.length}
                delta="w kolejce wyjątków"
                tone={critEx.length ? 'alert' : 'warn'}
                onClick={() => setView('risk')}
              />
              <KpiTile
                label="Terminowość"
                value={`${otif}%`}
                delta={`${delayedN} dostaw poza oknem`}
                tone={otif < 90 ? 'warn' : 'good'}
                onClick={() => navigateTo({ view: 'sched' })}
              />
              {canSeeMargin(role) ? (
                <KpiTile
                  label="Marża narastająco"
                  value={formatMoney(
                    loads.reduce((a, l) => a + l.pricing.margin, 0),
                    locale,
                    currency,
                  )}
                  delta={`${(marginAvg * 100).toFixed(1).replace('.', ',')}% · koszt ${formatMoney(
                    loads.reduce((a, l) => a + l.pricing.costTotal, 0),
                    locale,
                    currency,
                  )}`}
                  tone={marginAvg < 0.12 ? 'warn' : 'good'}
                  onClick={() => navigateTo({ view: 'fin' })}
                />
              ) : (
                <KpiTile
                  label="W drodze"
                  value={inTransit}
                  delta="aktywne"
                  onClick={() => navigateTo({ view: 'map' })}
                />
              )}
              <KpiTile
                label="Komplet dokumentów"
                value={`${docsOk} / ${loads.length}`}
                delta="komplet przed załadunkiem"
                onClick={() =>
                  navigateTo({ view: 'docs', docsFilter: docsMissing ? 'missing' : null })
                }
              />
              <KpiTile
                label="Czas wykrycia odchylenia"
                value="8 min"
                delta="mediana, ostatnie 30 dni"
                tone="good"
                onClick={() => setView('risk')}
              />
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
            <span className="sub">{t(locale, 'progress_weeks')}</span>
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
