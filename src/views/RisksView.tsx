/**
 * wyglad/P6 — strona Ryzyka według E7 (img/e7-desk, img/e7-phone) i E6 (karta sprawy).
 * Komputer: „Do zrobienia” (lewa kolumna) i „Sytuacja na trasie” (prawa, bez dzwonka).
 * Telefon: zakładki „Do zrobienia N” / „Na trasie” / „System” (System tylko HHL, E7-3).
 * KSH: bez listy spraw (E9) — tylko sytuacja na trasie.
 * Dane jak dotąd: ryzyka i rejsy ze stanu aplikacji, decyzje (`decisions`), morze (`marine_conditions`),
 * drogi SE (`corridor_conditions`; demo — seed Trafikverket). Uchwyty testów: `[data-panel="ferry"]`, `[data-panel="road-se"]`.
 */
import { useEffect, useMemo, useState } from 'react';
import { LiveMark } from '../components/shell/LiveMark';
import { useTowerStore } from '../store/useTowerStore';
import { getAuthProfile } from '../auth/profile';
import { todoQueue, viewedKind } from '../lib/cockpitE9';
import { routeRisks } from '../lib/todoRules';
import { getNow } from '../lib/frozenNow';
import { useIsPhone } from '../lib/useIsPhone';
import { fetchSituations, type RoadSituation } from '../lib/trafikverket';
import { isDemoSourceMode } from '../lib/demoLabel';
import { shows } from '../lib/prodFacade';
import type { MarineConditionRow } from '../lib/marineWeatherDb';
import type { CorridorConditionRow } from '../lib/corridorConditionsDb';
import { TodoPanel } from '../components/risks/TodoPanel';
import { RoutePanel } from '../components/risks/RoutePanel';
import { useOpenDecisions } from '../components/risks/useDecisions';
import { rt } from '../i18n/p6';
import '../components/risks/risks.css';

const PROD = import.meta.env.VITE_AUTH_MODE === 'supabase';
type Tab = 'todo' | 'route' | 'sys';

export function RisksView() {
  const risks = useTowerStore((s) => s.risks);
  const loads = useTowerStore((s) => s.loads);
  const geofences = useTowerStore((s) => s.geofences);
  const sailings = useTowerStore((s) => s.sailings);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const riskFilter = useTowerStore((s) => s.riskFilter);
  const openDecisionId = useTowerStore((s) => s.openDecisionId);
  const setOpenDecisionId = useTowerStore((s) => s.setOpenDecisionId);
  const phone = useIsPhone();
  const [seSituations, setSeSituations] = useState<RoadSituation[]>([]);
  const [seMode, setSeMode] = useState<'live' | 'seed'>('seed');
  const [marine, setMarine] = useState<MarineConditionRow[]>([]);
  const [corridor, setCorridor] = useState<CorridorConditionRow | null>(null);
  const [tab, setTab] = useState<Tab>(() => (riskFilter === 'FERRY' || riskFilter === 'ROAD_SE' ? 'route' : 'todo'));

  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);
  const kind = viewedKind(role, getAuthProfile()?.role);
  const count = useMemo(() => todoQueue(role, risks, kind)?.total ?? 0, [role, risks, kind]);
  const decisions = useOpenDecisions(PROD && role !== 'KSH');

  /* E7-6 i dzwonek: link do sprawy otwiera zakładkę „Do zrobienia”, link do sytuacji na trasie — „Na trasie” */
  useEffect(() => {
    if (openDecisionId) {
      if (role === 'KSH') setOpenDecisionId(null);
      else setTab('todo');
    }
  }, [openDecisionId, role, setOpenDecisionId]);
  useEffect(() => {
    if (!riskFilter || riskFilter === 'ALL') return;
    const rr = routeRisks(risks);
    const onRoute = [...rr.ferry, ...rr.weather, ...rr.roadPl, ...rr.bans].some((r) => r.id === riskFilter);
    const onSys = rr.system.some((r) => r.id === riskFilter);
    if (onRoute || onSys) {
      setTab(onSys ? 'sys' : 'route');
      window.requestAnimationFrame(() => document.querySelector(`[data-risk-id="${CSS.escape(riskFilter)}"]`)?.scrollIntoView({ block: 'center' }));
    } else if (risks.some((r) => r.id === riskFilter)) setTab('todo');
  }, [riskFilter, risks]);

  useEffect(() => {
    /* produkcja: corridor_conditions (II-6, road-se); demo: seed Trafikverket */
    let cancelled = false;
    if (PROD) {
      void import('../lib/corridorConditionsDb').then((m) => m.fetchCorridorCondition()).then((row) => {
        if (!cancelled) setCorridor(row);
      });
    } else if (shows('roadSituationsSe')) {
      void fetchSituations().then((r) => {
        if (cancelled) return;
        setSeSituations(r.items);
        setSeMode(r.mode);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    /* II-8: produkcja — pogoda morska z marine_conditions */
    if (!PROD) return;
    let cancelled = false;
    void import('../lib/marineWeatherDb').then((m) => m.fetchMarineConditions()).then((rows) => {
      if (!cancelled) setMarine(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const seDemo = !PROD && shows('roadSituationsSe') && isDemoSourceMode(seMode);
  const route = (parts: ('ferry' | 'roads' | 'system')[] | undefined, withHead: boolean) => (
    <RoutePanel
      role={role} locale={locale} phone={phone} nowIso={nowIso} loads={loads} risks={risks} sailings={sailings}
      marine={marine} corridor={corridor} seSituations={seSituations} seDemo={seDemo} showDemoMarks={showDemoMarks}
      parts={parts} withHead={withHead}
    />
  );
  const todo = (showHead: boolean) => role === 'KSH' ? null : (
    <TodoPanel
      role={role} kind={kind} locale={locale} phone={phone} nowIso={nowIso} loads={loads} risks={risks}
      geofences={geofences} count={count} decisions={PROD ? decisions : null} showHead={showHead}
    />
  );

  if (role === 'KSH') {
    return (
      <div className="dash risk-page rk-page" data-page="risks">
        <h1 className="rk-title">{rt(locale, 'p6_title')}<LiveMark /></h1>
        <p className="rk-muted rk-ksh-note">{rt(locale, 'p6_ksh_note')}</p>
        <div className={phone ? 'rk-one' : 'rk-ksh'}>{route(['ferry', 'roads'], !phone)}</div>
      </div>
    );
  }

  if (phone) {
    const tabs: Tab[] = role === 'HHL' ? ['todo', 'route', 'sys'] : ['todo', 'route'];
    const label = (k: Tab) => (k === 'todo' ? rt(locale, 'p6_tab_todo') : k === 'route' ? rt(locale, 'p6_tab_route') : rt(locale, 'p6_tab_sys'));
    return (
      <div className="dash risk-page rk-page is-phone" data-page="risks">
        <h1 className="rk-title">{rt(locale, 'p6_title')}<LiveMark /></h1>
        <div className="rk-tabs" role="tablist" aria-label={rt(locale, 'p6_tabs_aria')}>
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`rk-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={tab === k ? `rk-pane-${k}` : undefined}
              tabIndex={tab === k ? 0 : -1}
              data-rk-tab={k}
              onClick={() => setTab(k)}
              onKeyDown={(e) => {
                const i = tabs.indexOf(k);
                const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
                  : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null;
                if (next) {
                  e.preventDefault();
                  setTab(next);
                  window.requestAnimationFrame(() => document.getElementById(`rk-tab-${next}`)?.focus());
                }
              }}
            >
              {label(k)}{k === 'todo' ? <span className="rk-count"> {count}</span> : null}
            </button>
          ))}
        </div>
        <div className="rk-pane" role="tabpanel" id={`rk-pane-${tab}`} aria-labelledby={`rk-tab-${tab}`}>
          {tab === 'todo' ? todo(false) : tab === 'route' ? route(['ferry', 'roads'], false) : route(['system'], false)}
        </div>
      </div>
    );
  }

  return (
    <div className="dash risk-page rk-page" data-page="risks">
      <h1 className="rk-title">{rt(locale, 'p6_title')}<LiveMark /></h1>
      <div className="rk-grid">
        {todo(true)}
        {route(undefined, true)}
      </div>
    </div>
  );
}
