/**
 * Opcje › Pieniądze › Opłata paliwowa — produkcja w wyglądzie z audytu (E3 `img/e3-opcje-desk`, `img/e3-opcje-phone`; E39):
 * ekran `FuelScreen` (ten sam co w demo) — karty „Ten tydzień / Przyszły / Pobieranie”, „Jak liczymy”, ceny 2 tygodni,
 * tabela mnożników. Dane: `src/auth/liveFuel.ts`.
 * HHL: pełny dzisiejszy formularz `BafForm` (nowa wersja załącznika — `sefs_save_parameters`, cena ręczna i korekta —
 * `fuel_add_reading`, dziennik) zostaje pod ekranem; „Nowa wersja umowy” otwiera go. Operacje HHL — tylko odczyt.
 * KSH i SCX (`party`, decyzja 5B 17.10): to, co dotyczy ich rozliczenia, bez spraw HHL; wersje załącznika w zakresie RLS
 * (dzisiejszy `SefsReadOnly`) rozwijane pod ekranem.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { lazyRetry } from '../lib/lazyRetry';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { FuelScreen } from '../components/options/MoneyScreens';
import { addDays, exampleBaseOf, hhlFuelView, mondayOf, partyFuelView, type FuelRun, type Tier, type TierBound, type WeekCalc } from './liveFuel';

const BafForm = lazy(lazyRetry(() => import('./BafForm')));
const SefsReadOnly = lazy(lazyRetry(() => import('./SefsReadOnly')));
const PROJECT_CODE = 'STEGRA_BODEN';

type Params = { version: number; valid_from: string; agreed_with_carrier: boolean; tiers_sek: Tier[]; tiers_pln: Tier[]; tier_bound?: TierBound | null };

export default function LiveFuel({ readOnly = false, party }: { readOnly?: boolean; party?: 'KSH' | 'SCX' }) {
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const today = localDateOf(getNowIso());
  const [params, setParams] = useState<Params | null | undefined>(undefined);
  const [calc, setCalc] = useState<{ cur: WeekCalc | null; next: WeekCalc | null; curDays: WeekCalc | null; plnPubs: { value: number; published_on: string }[]; runs: FuelRun[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLDetailsElement>(null);

  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      const p = await /* `*` — kolumna `tier_bound` (#563, od t44) pojawi się w bazie później; jawna lista kolumn dałaby błąd przed migracją */
        sb.from('sefs_parameters').select('*').order('version', { ascending: false }).limit(1);
      if (p.error) setMsg(p.error.message);
      setParams(((p.data ?? []) as Params[])[0] ?? null);
      if (party) return;
      const pr = await sb.from('projects').select('id').eq('code', PROJECT_CODE).maybeSingle();
      const pid = (pr.data as { id: string } | null)?.id ?? null;
      if (!pid) { setCalc({ cur: null, next: null, curDays: null, plnPubs: [], runs: [] }); return; }
      const mon = mondayOf(today);
      const nextMon = addDays(mon, 7);
      const [c, n, d, pl, r] = await Promise.all([
        sb.rpc('sefs_week_for_load', { p_project: pid, p_load_date: mon, p_today: today }),
        sb.rpc('sefs_week_for_load', { p_project: pid, p_load_date: nextMon, p_today: today }),
        /* F7 #415: ceny tygodnia bieżącego — wskaźniki dla załadunku w przyszłym tygodniu liczone „na poniedziałek”
           (prognoza z dzisiejszym „dziś” bierze tydzień kotwicy, nie bieżący); z wyniku tylko lista dni do dziś */
        sb.rpc('sefs_week_for_load', { p_project: pid, p_load_date: nextMon, p_today: nextMon }),
        sb.from('fuel_index_readings').select('value,published_on,corrects_id').eq('project_id', pid).eq('index_code', 'PLN')
          .gte('published_on', addDays(mon, -21)).order('published_on'),
        sb.from('integration_runs').select('ran_at,ok,result').eq('job', 'fuel-prices').order('ran_at', { ascending: false }).limit(30),
      ]);
      const err = c.error ?? n.error ?? d.error ?? pl.error ?? r.error;
      setMsg(err ? err.message : null);
      setCalc({
        cur: (c.data ?? null) as WeekCalc | null,
        next: (n.data ?? null) as WeekCalc | null,
        curDays: (d.data ?? null) as WeekCalc | null,
        plnPubs: ((pl.data ?? []) as { value: number; published_on: string | null; corrects_id: number | null }[])
          .filter((x) => x.published_on && x.corrects_id == null).map((x) => ({ value: x.value, published_on: x.published_on! })),
        runs: (r.data ?? []) as FuelRun[],
      });
    } catch (e) {
      /* F7 #415: wyjątek przy odczycie — komunikat zamiast pustego ekranu */
      setMsg(e instanceof Error ? e.message : t(locale, 'ol2_read_fail'));
      setParams((x) => (x === undefined ? null : x));
      setCalc((x) => x ?? { cur: null, next: null, curDays: null, plnPubs: [], runs: [] });
    }
  }, [party, today, locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const view = useMemo(() => {
    if (params === undefined) return null;
    if (party) return partyFuelView({ today, side: party === 'KSH' ? 'rev' : 'cost', loads, params });
    if (!calc) return null;
    return hhlFuelView({ today, params, cur: calc.cur, next: calc.next, curDays: calc.curDays, plnPubs: calc.plnPubs, runs: calc.runs, exampleBaseEur: exampleBaseOf(loads, 'cost'), missWhy: t(locale, 'ol2_fuel_no_price') });
  }, [params, calc, party, today, loads, locale]);

  /* „Nowa wersja umowy”: rozwija dzisiejszy formularz załącznika pod ekranem */
  const actions = party || readOnly ? null : {
    fill: null,
    newVersion: () => { setOpen(true); window.setTimeout(() => more.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0); },
  };

  return (
    <div data-panel="live-fuel" data-live-fuel={party ?? 'HHL'}>
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {view ? <FuelScreen locale={locale} view={view} actions={actions} readOnly={readOnly || !!party} party={party} /> : null}
      <details ref={more} className="ol2-more" data-live-fuel-more open={open || undefined} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{t(locale, party ? 'ol2_fuel_more_party' : 'ol2_fuel_more')}</summary>
        <Suspense fallback={null}>
          {party ? <SefsReadOnly /> : readOnly
            ? <fieldset disabled className="opt-ro" data-opt-ro><BafForm /></fieldset>
            : <BafForm />}
        </Suspense>
      </details>
    </div>
  );
}
