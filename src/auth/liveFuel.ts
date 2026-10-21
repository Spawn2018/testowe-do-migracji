/**
 * Opcje › Pieniądze › Opłata paliwowa (E3, E39) — produkcja: czyste funkcje budujące widok `FuelScreenView` z danych bazy.
 * HHL: `sefs_week_for_load` (te same średnie, mnożniki, publikacje i dni co ceny transportów — `sefs_week_calc`),
 * `sefs_parameters` (wersja załącznika i tabela mnożników), `integration_runs` zadania `fuel-prices` (pobieranie cen).
 * KSH i SCX (5B, 17.10): bez spraw HHL — mnożniki z migawek cen własnych transportów (`v_load_price_*`), wersja i tabela
 * z `sefs_parameters` w zakresie RLS; cen z publikacji baza im nie pokazuje (lista dni pusta).
 * Bez zapytań i zapisów — tylko kształt danych (test `tests/w-opcje-live-2.test.ts`).
 */
import type { FuelDayGroup, FuelDayRow, FuelFetchDay, FuelScreenView, FuelSource, FuelTier, FuelWeekView } from '../lib/p5bFuel';
import type { Load } from '../types';

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
export const addDays = (d: string, n: number) => iso(ms(d) + n * DAY);
/** Poniedziałek tygodnia (pn–nd). */
export function mondayOf(d: string): string {
  const t = ms(d);
  return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
}

export type Tier = { lte: number; mult: number };
/** Tabela załącznika „do X → ×m” jako przedziały „od–do” (jak w demo). */
export function tiersFromDb(t: readonly Tier[] | null | undefined): FuelTier[] {
  const list = [...(t ?? [])].map((x) => ({ lte: Number(x.lte), mult: Number(x.mult) })).sort((a, b) => a.lte - b.lte);
  return list.map((x, i) => ({ from: i === 0 ? 0 : Math.round((list[i - 1].lte + 0.01) * 100) / 100, to: x.lte, mult: x.mult }));
}

/** Wynik `sefs_week_calc` (pola, których używa ekran). */
export interface WeekCalc {
  ok?: boolean;
  status?: string;
  final?: boolean;
  avg_sek?: number | string | null;
  avg_pln?: number | string | null;
  n_sek?: number | null;
  n_pln?: number | null;
  mult_sek?: number | string | null;
  mult_pln?: number | string | null;
  applied_mult?: number | string | null;
  load_week_start?: string;
  load_week_end?: string;
  prev_week_start?: string;
  prev_week_end?: string;
  /** prognoza (przyszły tydzień): `prev_week_*` to tydzień kotwicy (ostatni zamknięty), tydzień wskaźników jest tutaj */
  load_prev_week_start?: string;
  load_prev_week_end?: string;
  days_sek?: { day: string; value: number | string; published_on: string }[] | null;
  pubs_pln?: { value: number | string; published_on: string }[] | null;
}

const n = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function weekFromCalc(c: WeekCalc | null, loadMon: string): FuelWeekView {
  const from = c?.load_week_start ?? loadMon;
  /* F7 #415: tydzień wskaźników = tydzień przed tygodniem załadunku — przy prognozie `load_prev_week_*`, nie kotwica */
  const idxFrom = c?.load_prev_week_start ?? c?.prev_week_start ?? addDays(loadMon, -7);
  const idxTo = c?.load_prev_week_end ?? c?.prev_week_end ?? addDays(idxFrom, 6);
  return {
    from, to: c?.load_week_end ?? addDays(from, 6), idxFrom, idxTo,
    okq8: { avg: n(c?.avg_sek), n: Number(c?.n_sek ?? 0), mult: n(c?.mult_sek) },
    orlen: { avg: n(c?.avg_pln), n: Number(c?.n_pln ?? 0), mult: n(c?.mult_pln) },
    applied: n(c?.applied_mult),
    final: c?.final === true || c?.status === 'OSTATECZNY',
  };
}

/** Przebieg zadania `fuel-prices`: czas (ISO) i wynik źródeł. */
export type FuelRun = { ran_at: string; ok: boolean; result: Record<string, unknown> | null };

const hmWarsaw = (isoTs: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoTs));
const dayWarsaw = (isoTs: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoTs));

/** Czy przebieg pobrał cenę źródła: nowy zapis (`sources.okq8.ok`) albo stary (`okq8: 23.04`). */
function runSourceOk(r: FuelRun, src: 'okq8' | 'orlen'): boolean | null {
  if (!r.ok) return false;
  const res = r.result ?? {};
  const s = (res.sources as Record<string, { ok?: boolean }> | undefined)?.[src];
  if (s && typeof s.ok === 'boolean') return s.ok;
  if (typeof res[src] === 'number') return true;
  return null;
}

/** Stan pobierania jednego dnia: true — pobrane, false — wszystkie próby z błędem, null — jeszcze nie było próby. */
export function fetchDay(runs: readonly FuelRun[], date: string): FuelFetchDay {
  const day = runs.filter((r) => dayWarsaw(r.ran_at) === date);
  const pick = (src: 'okq8' | 'orlen') => {
    if (!day.length) return null;
    const vals = day.map((r) => runSourceOk(r, src));
    return vals.some((v) => v === true) ? true : vals.some((v) => v === false) ? false : null;
  };
  return { date, okq8: pick('okq8'), orlen: pick('orlen') };
}

/** Godziny prób danego dnia (czas polski), od najwcześniejszej. */
export function runTimes(runs: readonly FuelRun[], date: string): string[] {
  return runs.filter((r) => dayWarsaw(r.ran_at) === date).map((r) => hmWarsaw(r.ran_at)).sort();
}

/** Dni tygodnia wskaźników (pn–nd, do dziś) z publikacji wyniku `sefs_week_calc`. */
export function daysFromCalc(
  c: WeekCalc | null, from: string, today: string, runs: readonly FuelRun[], closed: FuelDayGroup['closed'], missWhy = '',
  /** publikacje Orlen spoza tygodnia (np. sobota poprzedniego) — poniedziałek bierze ostatnią wcześniejszą cenę */
  extraPln: readonly { value: number | string; published_on: string }[] = [],
): FuelDayGroup {
  const sek = new Map((c?.days_sek ?? []).map((d) => [d.day, d]));
  const byPub = new Map([...extraPln, ...(c?.pubs_pln ?? [])].map((x) => [x.published_on, x]));
  const pln = [...byPub.values()].sort((a, b) => a.published_on.localeCompare(b.published_on));
  const rows: FuelDayRow[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(from, i);
    if (date > today) continue;
    const s = sek.get(date) ?? null;
    const p = [...pln].reverse().find((x) => x.published_on <= date) ?? null;
    const f = fetchDay(runs, date);
    const at = runTimes(runs, date)[0] ?? null;
    const okq8 = s ? Number(s.value) : null;
    const orlen = p ? Number(p.value) : null;
    const miss: FuelSource | null = okq8 == null ? 'OKQ8' : orlen == null ? 'ORLEN' : null;
    rows.push({
      date,
      okq8,
      okq8Pub: s && s.published_on !== date ? s.published_on : null,
      orlen,
      orlenPub: p && p.published_on !== date ? p.published_on : null,
      how: miss ? 'MISSING' : f.okq8 || f.orlen ? 'AUTO' : 'FILLED',
      at,
      missing: miss ? { source: miss, why: missWhy } : null,
    });
  }
  return { from, to: addDays(from, 6), closed, rows };
}

/** Widok HHL: tydzień bieżący i przyszły z `sefs_week_for_load`, dni z publikacji, pobieranie z `fuel-prices`. */
export function hhlFuelView(args: {
  today: string;
  params: { version: number; valid_from: string; agreed_with_carrier: boolean; tiers_sek: Tier[]; tiers_pln: Tier[] } | null;
  cur: WeekCalc | null;
  next: WeekCalc | null;
  /**
   * Publikacje tygodnia bieżącego (liczy przyszły tydzień): `sefs_week_for_load` dla załadunku w przyszłym tygodniu
   * z „dziś” = poniedziałek przyszłego tygodnia — wtedy tydzień wskaźników to tydzień bieżący (prognoza bierze kotwicę).
   */
  curDays: WeekCalc | null;
  /** odczyty Orlen z ostatnich tygodni (`fuel_index_readings`, PLN) — cena obowiązująca w dniu bez publikacji */
  plnPubs?: readonly { value: number | string; published_on: string }[];
  runs: readonly FuelRun[];
  exampleBaseEur: number;
  /** tekst przy dniu bez ceny („brak publikacji”) */
  missWhy?: string;
}): FuelScreenView {
  const { today, params, cur, next, runs } = args;
  const mon = mondayOf(today);
  const current = weekFromCalc(cur, mon);
  const nx = weekFromCalc(next, addDays(mon, 7));
  const yesterday = addDays(today, -1);
  const tDay = fetchDay(runs, today);
  const yDay = fetchDay(runs, yesterday);
  const times = runTimes(runs, today).length ? runTimes(runs, today) : runTimes(runs, yesterday);
  /* alarm: źródło bez ceny po wszystkich próbach dnia (dziś albo wczoraj) — wpływa na załadunki tygodnia po tygodniu ceny */
  const failed = (['okq8', 'orlen'] as const).flatMap((k) => [tDay, yDay].filter((d) => d[k] === false).map((d) => ({ k, d })))[0] ?? null;
  const failMon = failed ? addDays(mondayOf(failed.d.date), 7) : null;
  return {
    contract: { version: params?.version ?? 0, from: params?.valid_from ?? today, agreed: params?.agreed_with_carrier ?? false },
    alarm: failed && failMon ? {
      source: failed.k === 'okq8' ? 'OKQ8' : 'ORLEN', date: failed.d.date, at: runTimes(runs, failed.d.date).slice(-1)[0] ?? '—',
      published: null, affectsFrom: failMon, affectsTo: addDays(failMon, 6), nextTry: null,
    } : null,
    current,
    next: { from: nx.from, to: nx.to, idxFrom: nx.idxFrom, idxTo: nx.idxTo, forecast: nx.applied, finalOn: nx.from },
    fetch: { at: times[0] ?? '—', retries: times.slice(1), today: tDay, yesterday: yDay },
    exampleBaseEur: args.exampleBaseEur,
    days: [
      daysFromCalc(args.curDays, mon, today, runs, null, args.missWhy, [...(cur?.pubs_pln ?? []), ...(args.plnPubs ?? [])]),
      daysFromCalc(cur, current.idxFrom, today, runs, { okq8: current.okq8.avg, orlen: current.orlen.avg, mult: current.applied }, args.missWhy, args.plnPubs ?? []),
    ],
    tiers: { sek: tiersFromDb(params?.tiers_sek), pln: tiersFromDb(params?.tiers_pln) },
  };
}

type Side = 'rev' | 'cost';
const sideOf = (l: Load, side: Side) => {
  const m = l.pricing?.money;
  return m && m.v === 2 ? (side === 'rev' ? m.rev : m.cost) : null;
};

/** Stawka do przykładu „Jak liczymy”: SG (albo pierwszy transport z ceną) — kwota bez opłaty = wyliczenie ÷ mnożnik. */
export function exampleBaseOf(loads: readonly Load[], side: Side): number {
  const priced = loads.map((l) => ({ l, s: sideOf(l, side) })).filter((x) => x.s && x.s.computedEur > 0 && x.s.fuel.applied > 0);
  const pick = priced.find((x) => /^SG\b|^SG-/.test(x.l.code)) ?? priced[0];
  return pick ? Math.round(pick.s!.computedEur / pick.s!.fuel.applied) : 0;
}

/** Widok KSH / SCX (5B): mnożniki tygodnia z migawek własnych transportów; bez pobierania, alarmu i cen z publikacji. */
export function partyFuelView(args: {
  today: string;
  side: Side;
  loads: readonly Load[];
  params: { version: number; valid_from: string; agreed_with_carrier: boolean; tiers_sek?: Tier[] | null; tiers_pln?: Tier[] | null } | null;
}): FuelScreenView {
  const { today, side, loads, params } = args;
  const mon = mondayOf(today);
  const nextMon = addDays(mon, 7);
  const snaps = loads.map((l) => sideOf(l, side)?.fuel).filter((f): f is NonNullable<typeof f> => !!f && !!f.refDate);
  const inWeek = (m: string) => snaps.filter((f) => mondayOf(f.refDate) === m);
  const week = (m: string): FuelWeekView => {
    const f = inWeek(m)[0] ?? null;
    return {
      from: m, to: addDays(m, 6), idxFrom: addDays(m, -7), idxTo: addDays(m, -1),
      okq8: { avg: null, n: 0, mult: f ? f.multSek : null },
      orlen: { avg: null, n: 0, mult: f ? f.multPln : null },
      applied: f ? f.applied : null,
      final: f?.status === 'OSTATECZNY',
    };
  };
  const current = week(mon);
  const nx = week(nextMon);
  return {
    contract: { version: params?.version ?? 0, from: params?.valid_from ?? today, agreed: params?.agreed_with_carrier ?? false },
    alarm: null,
    current,
    next: { from: nextMon, to: addDays(nextMon, 6), idxFrom: mon, idxTo: addDays(mon, 6), forecast: nx.applied ?? current.applied, finalOn: nextMon },
    fetch: { at: '—', retries: [], today: { date: today, okq8: null, orlen: null }, yesterday: { date: addDays(today, -1), okq8: null, orlen: null } },
    exampleBaseEur: exampleBaseOf(loads, side),
    days: [],
    tiers: { sek: tiersFromDb(params?.tiers_sek), pln: tiersFromDb(params?.tiers_pln) },
  };
}
