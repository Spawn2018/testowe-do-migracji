/**
 * wyglad/P5 — Finanse (E16) i opłata paliwowa według tygodnia (E39): czyste funkcje widoku.
 * Liczą z cen transportów, które już są w aplikacji (EUR, `pricing.money` v2 z widoków cen w bazie). Bez nowych zapytań.
 * Jedno źródło liczb dla Kokpitu, Harmonogramu i panelu podłącza wykonawca (E16 „Jedno źródło”) — `src/lib/p5Source.ts`.
 */
import type { Load } from '../types';
import type { PricingTier } from './money/engine';
import { sideEffectiveEur, type MoneySideV2 } from './money/loadMoney';
import { fmtDateRange } from './time';

export type FinStage = PricingTier;
/** Która strona kwoty: HHL obie, KSH przychód, SCX koszt (E16 „Każda firma”). */
export type FinSide = 'both' | 'rev' | 'cost';

export interface FinAmount { eur: number; pln: number | null }
export interface FinStageRow { stage: FinStage; count: number; rev: FinAmount; cost: FinAmount }
export interface FinTypeRow { type: string; priced: number; all: number; rev: FinAmount; cost: FinAmount }
export interface FinBelowRow { id: string; code: string; type: string; stage: FinStage; marginEur: number; marginPln: number | null; marginPct: number }
export interface FinNbp { tableNo: string; date: string; mid: number }
export interface FinSummary {
  all: number;
  priced: number;
  /** Kody transportów bez ceny i czy wszystkie są bez daty załadunku (KR bez daty — E33 pkt 2). */
  unpricedCodes: string[];
  unpricedNoDate: boolean;
  stages: FinStageRow[];
  total: { count: number; rev: FinAmount; cost: FinAmount };
  types: FinTypeRow[];
  /** Ostatnia tabela NBP widoczna w danych — „kurs bieżący” dla transportów przed rozładunkiem (E16, 23:12). */
  nbpLatest: FinNbp | null;
  /** Czy każdą kwotę udało się przeliczyć na PLN (kurs transportu albo bieżący). */
  plnComplete: boolean;
}

export const FIN_STAGES: FinStage[] = ['FAKTURA', 'REALIZACJA', 'PROGNOZA'];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function sidesOf(load: Load): { rev: MoneySideV2; cost: MoneySideV2; tier: PricingTier } | null {
  const m = load.pricing?.money;
  if (!m || m.v !== 2) return null;
  return { rev: m.rev, cost: m.cost, tier: m.tier };
}

function stageOf(s: { rev: MoneySideV2; cost: MoneySideV2; tier: PricingTier }, side: FinSide): FinStage {
  return side === 'rev' ? s.rev.tier : side === 'cost' ? s.cost.tier : s.tier;
}

function isPriced(s: { rev: MoneySideV2; cost: MoneySideV2 } | null, side: FinSide): boolean {
  if (!s) return false;
  const r = sideEffectiveEur(s.rev);
  const c = sideEffectiveEur(s.cost);
  return side === 'rev' ? r > 0 : side === 'cost' ? c > 0 : r > 0 && c > 0;
}

/** Ostatnia tabela NBP spośród migawek kursu transportów (największa data). */
export function latestNbp(loads: Load[]): FinNbp | null {
  let best: FinNbp | null = null;
  for (const l of loads) {
    const s = sidesOf(l);
    if (!s) continue;
    for (const fx of [s.rev.fx, s.cost.fx]) {
      if (!(fx.mid > 0) || !fx.date) continue;
      if (!best || fx.date > best.date) best = { tableNo: fx.tableNo, date: fx.date, mid: fx.mid };
    }
  }
  return best;
}

function plnOf(side: MoneySideV2, eur: number, latest: FinNbp | null): number | null {
  const mid = side.fx.mid > 0 ? side.fx.mid : latest?.mid ?? 0;
  return mid > 0 ? r2(eur * mid) : null;
}

const add = (a: FinAmount, eur: number, pln: number | null): FinAmount => ({
  eur: r2(a.eur + eur),
  pln: a.pln == null || pln == null ? null : r2(a.pln + pln),
});
const zero = (): FinAmount => ({ eur: 0, pln: 0 });

export function financeSummary(loads: Load[], side: FinSide, latest: FinNbp | null = latestNbp(loads)): FinSummary {
  const stages = new Map<FinStage, FinStageRow>(FIN_STAGES.map((k) => [k, { stage: k, count: 0, rev: zero(), cost: zero() }]));
  const types = new Map<string, FinTypeRow>();
  const unpriced: Load[] = [];
  let total = { count: 0, rev: zero(), cost: zero() };
  let plnComplete = true;
  for (const l of loads) {
    const s = sidesOf(l);
    const type = types.get(l.itemType) ?? { type: l.itemType, priced: 0, all: 0, rev: zero(), cost: zero() };
    type.all += 1;
    types.set(l.itemType, type);
    if (!s || !isPriced(s, side)) { unpriced.push(l); continue; }
    const revE = side === 'cost' ? 0 : sideEffectiveEur(s.rev);
    const costE = side === 'rev' ? 0 : sideEffectiveEur(s.cost);
    const revP = side === 'cost' ? 0 : plnOf(s.rev, revE, latest);
    const costP = side === 'rev' ? 0 : plnOf(s.cost, costE, latest);
    if (revP == null || costP == null) plnComplete = false;
    const st = stages.get(stageOf(s, side))!;
    st.count += 1;
    st.rev = add(st.rev, revE, revP);
    st.cost = add(st.cost, costE, costP);
    type.priced += 1;
    type.rev = add(type.rev, revE, revP);
    type.cost = add(type.cost, costE, costP);
    total = { count: total.count + 1, rev: add(total.rev, revE, revP), cost: add(total.cost, costE, costP) };
  }
  return {
    all: loads.length,
    priced: total.count,
    unpricedCodes: unpriced.map((l) => l.code).sort((a, b) => a.localeCompare(b, 'pl', { numeric: true })),
    unpricedNoDate: unpriced.length > 0 && unpriced.every((l) => !l.plannedLoadDate),
    stages: FIN_STAGES.map((k) => stages.get(k)!),
    total,
    types: [...types.values()].sort((a, b) => b.rev.eur - a.rev.eur || a.type.localeCompare(b.type, 'pl')),
    nbpLatest: latest,
    plnComplete,
  };
}

/** Marża w % przychodu (E16: marża ÷ przychód); null bez przychodu. */
export const marginPct = (rev: number, cost: number): number | null => (rev > 0 ? ((rev - cost) / rev) * 100 : null);

/** Lista „Poniżej progu marży” (E16, wariant B): próg w %, bez progu — pusta (flaga wyłączona). */
export function belowThreshold(loads: Load[], thresholdPct: number | null, latest: FinNbp | null = latestNbp(loads)): FinBelowRow[] {
  if (thresholdPct == null) return [];
  const out: FinBelowRow[] = [];
  for (const l of loads) {
    const s = sidesOf(l);
    if (!s || !isPriced(s, 'both')) continue;
    const rev = sideEffectiveEur(s.rev);
    const cost = sideEffectiveEur(s.cost);
    const p = marginPct(rev, cost);
    const rp = plnOf(s.rev, rev, latest);
    const cp = plnOf(s.cost, cost, latest);
    const marginPln = rp == null || cp == null ? null : r2(rp - cp);
    if (p != null && p < thresholdPct) out.push({ id: l.id, code: l.code, type: l.itemType, stage: s.tier, marginEur: r2(rev - cost), marginPln, marginPct: p });
  }
  return out.sort((a, b) => a.marginPct - b.marginPct);
}

/** „94 transporty”, „86 transportów”, „1 transport”, „22 transporty”, „12 transportów”. */
export function transportsText(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (n === 1) return `${n} transport`;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return `${n} transporty`;
  return `${n} transportów`;
}

/** „KR-08 – KR-15” dla ciągu kodów z tym samym przedrostkiem, inaczej lista. */
export function codeRange(codes: string[]): string {
  if (codes.length === 0) return '';
  if (codes.length <= 3) return codes.join(', ');
  const pre = (c: string) => c.replace(/\d+$/, '');
  const num = (c: string) => Number((c.match(/(\d+)$/) ?? ['', 'NaN'])[1]);
  /* zakres „KR-08 – KR-15” tylko bez przerw w numeracji jednej serii */
  const run = codes.every((c, i) => pre(c) === pre(codes[0]) && (i === 0 || num(c) === num(codes[i - 1]) + 1));
  return run ? `${codes[0]} – ${codes[codes.length - 1]}` : `${codes.slice(0, 3).join(', ')} … (${codes.length})`;
}

/* ------------------------------------------------------------------ */
/* E39 — opłata paliwowa według tygodnia załadunku                     */
/* ------------------------------------------------------------------ */

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dateOf = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
export function addDays(day: string, n: number): string {
  const d = dateOf(day);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
/** Poniedziałek tygodnia (poniedziałek–niedziela) zawierającego dzień. */
export function mondayOf(day: string): string {
  const d = dateOf(day);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}
/** Numer tygodnia ISO 8601 (t41 = 05.10–11.10.2026). */
export function isoWeek(day: string): number {
  const d = dateOf(day);
  const thu = addDays(day, 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = `${thu.slice(0, 4)}-01-04`;
  return 1 + Math.round((dateOf(thu).getTime() - dateOf(mondayOf(jan4)).getTime()) / (7 * 86400000));
}
export interface FinWeek { no: number; from: string; to: string }
export const weekOf = (monday: string): FinWeek => ({ no: isoWeek(monday), from: monday, to: addDays(monday, 6) });
/** „t41 · 05.10.2026–11.10.2026” albo „t43–t51 · 19.10.2026–20.12.2026” (rok zawsze — właściciel 16.10.2026). */
export function weekLabel(w: FinWeek, last?: FinWeek | null): string {
  if (last && last.from !== w.from) return `t${w.no}–t${last.no} · ${fmtDateRange(w.from, last.to)}`;
  return `t${w.no} · ${fmtDateRange(w.from, w.to)}`;
}

export type FuelState = 'OSTATECZNA' | 'PROGNOZA' | 'BRAK';
export interface FuelSrc { avg: number | null; n: number | null; mult: number }
export interface FuelPubl { date: string; source: 'OKQ8' | 'ORLEN'; price: number }
export interface FuelWeekRow {
  key: string;
  week: FinWeek | null;
  /** Ostatni tydzień scalonego zakresu prognozy (t43–t51). */
  weekLast?: FinWeek | null;
  idx: FinWeek | null;
  idxLast?: FinWeek | null;
  okq8: FuelSrc | null;
  orlen: FuelSrc | null;
  applied: number | null;
  state: FuelState;
  /** Dzień, od którego prognoza staje się ostateczna (poniedziałek tygodnia załadunku); null = „do zamknięcia…”. */
  finalFrom: string | null;
  /** Tydzień wskaźników jeszcze trwa. */
  running: boolean;
  loads: { id: string; code: string }[];
  /** Publikacje cen z tygodnia wskaźników (dane z bazy — wykonawca). */
  publications?: FuelPubl[] | null;
}

function fuelSideOf(load: Load, side: FinSide): MoneySideV2 | null {
  const s = sidesOf(load);
  if (!s) return null;
  const pick = side === 'rev' ? s.rev : s.cost;
  return pick.fuel.refDate ? pick : null;
}

export const stateOfSnap = (status: string | undefined, idxEnd: string, today: string): FuelState =>
  status === 'OSTATECZNY' ? 'OSTATECZNA' : status === 'BRAK' ? 'BRAK' : status === 'PROGNOZA' || status === 'WSTEPNY' ? 'PROGNOZA' : idxEnd < today ? 'OSTATECZNA' : 'PROGNOZA';

/** Wiersze tabeli E39: tydzień załadunku, tydzień wskaźników, mnożniki, stan, transporty. Zakres prognoz scalony. */
export function fuelWeeks(loads: Load[], side: FinSide, today: string): FuelWeekRow[] {
  const byWeek = new Map<string, FuelWeekRow>();
  const none: FuelWeekRow = { key: 'none', week: null, idx: null, okq8: null, orlen: null, applied: null, state: 'BRAK', finalFrom: null, running: false, loads: [] };
  for (const l of loads) {
    const s = fuelSideOf(l, side);
    if (!s || !isPriced(sidesOf(l), side)) { none.loads.push({ id: l.id, code: l.code }); continue; }
    const mon = mondayOf(s.fuel.refDate);
    const idxMon = addDays(mon, -7);
    const st = stateOfSnap(s.fuel.status, addDays(idxMon, 6), today);
    const row = byWeek.get(mon) ?? {
      key: mon, week: weekOf(mon), idx: weekOf(idxMon),
      okq8: { avg: null, n: null, mult: s.fuel.multSek }, orlen: { avg: null, n: null, mult: s.fuel.multPln },
      applied: s.fuel.applied, state: st, finalFrom: null,
      running: idxMon <= today && today <= addDays(idxMon, 6), loads: [],
    };
    if (st === 'PROGNOZA' && row.state === 'OSTATECZNA') row.state = 'PROGNOZA';
    row.loads.push({ id: l.id, code: l.code });
    byWeek.set(mon, row);
  }
  const rows = [...byWeek.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const r of rows) {
    r.loads.sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true }));
    /* prognoza: wskaźniki trwają albo już zamknięte → ostateczna od poniedziałku tygodnia załadunku */
    if (r.state === 'PROGNOZA' && r.idx && r.idx.from <= today) r.finalFrom = r.week!.from;
    if (r.state === 'PROGNOZA') { r.okq8 = null; r.orlen = null; }
  }
  /* kolejne tygodnie prognozy bez daty zamknięcia i z tym samym mnożnikiem → jeden wiersz „t43–t51” */
  const merged: FuelWeekRow[] = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    /* tylko tygodnie po kolei — przerwa (tydzień bez transportów) zaczyna nowy wiersz */
    const next = prev && r.week && (prev.weekLast ?? prev.week) ? addDays((prev.weekLast ?? prev.week)!.from, 7) === r.week.from : false;
    const same = prev && next && prev.state === 'PROGNOZA' && r.state === 'PROGNOZA' && !prev.finalFrom && !r.finalFrom && prev.applied === r.applied;
    if (same) {
      prev.weekLast = r.week;
      prev.idxLast = r.idx;
      prev.loads.push(...r.loads);
      continue;
    }
    merged.push({ ...r, loads: [...r.loads] });
  }
  if (none.loads.length) {
    none.loads.sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true }));
    merged.push(none);
  }
  return merged;
}
