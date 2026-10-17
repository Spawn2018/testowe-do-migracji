/**
 * M2 — dane v2 pieniędzy na transporcie (MECHANIZM_PIENIEDZY §4–§5).
 *
 * Każda strona (koszt, przychód) trzyma:
 *  - poziom wyceny (PROGNOZA / REALIZACJA / FAKTURA),
 *  - OBIE wartości: wyliczoną mechanizmem i fakturowaną (Z1 — faktura nie kasuje wyliczenia),
 *  - migawkę mnożnika paliwowego z datą (SEFS hybrid_min, ta sama po obu stronach),
 *  - migawkę kursu NBP z numerem tabeli (reguła W3, dzień lokalny — Z2).
 * EUR jest źródłem (Z3). PLN wyłącznie przeliczeniem wyświetlania.
 */
import type { Invoice, Load } from '../../types';
import { sefsForLoadDate } from '../sefs';
import {
  buildPriceSide, assertSameMechanism, fuelLocalDate, fxReferenceUtc, localDateOf, nbpRateBefore, resolveTier, totalsByTier,
  type LoadMargin, type NbpRate, type PriceSide, type PricingTier,
} from './engine';
import { DEMO_NBP_RATES } from './demoFx';
import { formatCalendarDay } from '../time';

/** status (0189): PROGNOZA = prev tydzień niezamknięty (ostatni OSTATECZNY); OSTATECZNY = migawka; BRAK; WSTEPNY = legacy 0187. */
export type FuelMultStatus = 'PROGNOZA' | 'WSTEPNY' | 'OSTATECZNY' | 'BRAK';
export interface MoneyFuelSnap { refDate: string; multSek: number; multPln: number; applied: number; status?: FuelMultStatus }
export interface MoneyFxSnap { tableNo: string; mid: number; date: string; provisional: boolean }

export interface MoneySideV2 {
  tier: PricingTier;
  /** Wyliczenie mechanizmem — NIGDY nadpisywane fakturą (Z1). */
  computedEur: number;
  /** Kwota z faktury (EUR); gdy jest — nadrzędna. */
  invoicedEur: number | null;
  fuel: MoneyFuelSnap;
  fx: MoneyFxSnap;
}

export interface LoadMoneyV2 {
  v: 2;
  /** Poziom transportu = poziom mniej pewnej strony. */
  tier: PricingTier;
  cost: MoneySideV2;
  rev: MoneySideV2;
}

/** M8 — kolor pigułki poziomu wyceny (wzorzec .pill z makiety). */
export const TIER_PILL: Record<PricingTier, string> = { PROGNOZA: 'p-plan', REALIZACJA: 'p-sea', FAKTURA: 'p-go' };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const TIER_ORDER: PricingTier[] = ['PROGNOZA', 'REALIZACJA', 'FAKTURA'];
export const leastTier = (a: PricingTier, b: PricingTier): PricingTier =>
  TIER_ORDER[Math.min(TIER_ORDER.indexOf(a), TIER_ORDER.indexOf(b))];

export const sideEffectiveEur = (s: MoneySideV2): number => s.invoicedEur ?? s.computedEur;

/** Różnica faktura − wyliczenie (flaga Z1); null, gdy brak faktury. */
export const sideInvoiceDiffEur = (s: MoneySideV2): number | null =>
  s.invoicedEur == null ? null : round2(s.invoicedEur - s.computedEur);

/**
 * Z1: zastosowanie faktury do strony. Wyliczenie zostaje bez zmian,
 * wartość efektywna = fakturowana, poziom strony = FAKTURA.
 */
export function applyInvoiceToSide(side: MoneySideV2, invoicedEur: number): MoneySideV2 {
  return { ...side, invoicedEur: round2(invoicedEur), tier: 'FAKTURA' };
}

export function withSides(m: LoadMoneyV2, cost: MoneySideV2, rev: MoneySideV2): LoadMoneyV2 {
  return { v: 2, tier: leastTier(cost.tier, rev.tier), cost, rev };
}

/** Rzeczywisty rozładunek (UTC) — v2; demo: DELIVERED (i „Rozładowany” = Dostarczone, E25 / audyt-B B-03) bez daty → koniec okna rozładunku. */
export function unloadedAtOf(load: Load): string | null {
  if (load.unloadedAt) return load.unloadedAt;
  if (load.status !== 'DELIVERED' && load.status !== 'UNLOADING') return null;
  return load.awizacja?.unloadWindowEnd ?? (load.plannedDeliverDate ? `${load.plannedDeliverDate}T12:00:00+02:00` : null);
}

function plannedDeliveryUtc(load: Load): string {
  return load.awizacja?.unloadWindowStart ?? `${load.plannedDeliverDate}T12:00:00+02:00`;
}

/**
 * Kurs wg reguły W3 z dostępnych tabel. Brak tabeli przed datą (dane spoza
 * zakresu) → najstarsza znana tabela, oznaczona jako prowizoryczna — nigdy
 * cicha „dobra” wartość.
 */
export function fxForDate(localRefDate: string, todayLocal: string, rates: NbpRate[] = DEMO_NBP_RATES): { rate: NbpRate; provisional: boolean } {
  try {
    /* audyt 17.10 (E16, decyzja 07.10 23:12): przed rozładunkiem — kurs bieżący, czyli ostatnia tabela opublikowana
       do dziś włącznie (nie tabela z przyszłości wobec „dziś”); po rozładunku — dzień roboczy przed rozładunkiem */
    const future = localRefDate > todayLocal;
    const nextDay = new Date(Date.parse(`${todayLocal}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
    const rate = nbpRateBefore(rates, future ? nextDay : localRefDate);
    return { rate, provisional: future };
  } catch {
    const sorted = [...rates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    return { rate: sorted[0], provisional: true };
  }
}

/**
 * Wylicza dane v2 transportu z obecnych składników ceny (stawka drogowa przed
 * i po SEFS, dodatki). Mechanizm paliwowy liczy `sefs.ts` — tu tylko migawka.
 * Wywołuje niezmiennik `assertSameMechanism` (M8): rozjazd przerywa wyliczenie.
 */
export function buildLoadMoney(load: Load, opts: {
  todayLocal: string;
  rates?: NbpRate[];
  invoicedCostEur?: number | null;
  invoicedRevEur?: number | null;
}): LoadMoneyV2 {
  const p = load.pricing;
  const unloadedAtUtc = unloadedAtOf(load);
  const tier = resolveTier({ plannedDeliveryUtc: plannedDeliveryUtc(load), unloadedAtUtc });
  const refDate = fuelLocalDate({ plannedLoadDate: load.plannedLoadDate });
  if (!refDate) throw new Error('Brak daty załadunku — opłata paliwowa nie zgaduje daty rozładunku');
  const sefs = sefsForLoadDate(refDate);
  const fxDate = localDateOf(fxReferenceUtc({ plannedDeliveryUtc: plannedDeliveryUtc(load), unloadedAtUtc }));
  const fuel = {
    mechanism: 'SEFS_HYBRID_MIN' as const,
    referenceDate: refDate,
    multSek: sefs.multSek,
    multPln: sefs.multPln,
    appliedMultiplier: sefs.appliedMult,
    documentRef: 'src/lib/sefs.ts',
  };
  const { rate, provisional } = fxForDate(fxDate, opts.todayLocal, opts.rates);
  const costSide: PriceSide = buildPriceSide({
    tier, roadRateEur: p.costBase, roadRateAfterFuelEur: p.costBase + (p.costSefs ?? 0),
    extras: [{ code: 'EXTRAS', label: 'extras', amountEur: round2(p.costTotal - p.costBase - (p.costSefs ?? 0)) }],
    fuel, fx: rate, fxProvisional: provisional,
  });
  const revSide: PriceSide = buildPriceSide({
    tier, roadRateEur: p.revBase, roadRateAfterFuelEur: p.revBase + (p.revSefs ?? 0),
    extras: [{ code: 'EXTRAS', label: 'extras', amountEur: round2(p.revTotal - p.revBase - (p.revSefs ?? 0)) }],
    fuel, fx: rate, fxProvisional: provisional,
  });
  assertSameMechanism(costSide, revSide);
  const snap = (s: PriceSide): MoneySideV2 => ({
    tier: s.tier,
    computedEur: s.computedTotalEur,
    invoicedEur: null,
    fuel: { refDate: s.fuel.referenceDate, multSek: s.fuel.multSek, multPln: s.fuel.multPln, applied: s.fuel.appliedMultiplier },
    fx: { tableNo: s.fx.no, mid: s.fx.mid, date: s.fx.effectiveDate, provisional: s.fxProvisional },
  });
  let cost = snap(costSide);
  let rev = snap(revSide);
  if (opts.invoicedCostEur != null) cost = applyInvoiceToSide(cost, opts.invoicedCostEur);
  if (opts.invoicedRevEur != null) rev = applyInvoiceToSide(rev, opts.invoicedRevEur);
  return { v: 2, tier: leastTier(cost.tier, rev.tier), cost, rev };
}

/** Kwoty fakturowane kosztu z zaakceptowanych faktur przewoźnika (demo). */
export function invoicedCostByLoad(invoices: Invoice[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status !== 'MATCHED') continue;
    for (const l of inv.lines) out.set(l.loadId, l.billed);
  }
  return out;
}

/**
 * M8 — wylicza dane v2 transportu z niezmiennikiem; rozjazd mechanizmu (albo brak danych)
 * PRZERYWA wyliczenie: transport bez v2 + komunikat `moneyError` (lista wyjątków), nigdy cicha wartość.
 */
export function withMoneyV2(l: Load, todayLocal: string, invoicedCostEur?: number | null): Load {
  if (!l.pricing) return l; // niepełny rekord (stary zapis) — bez wyliczenia, nie zero
  try {
    /* kwoty z faktur (Z1) zostają przy ponownym wyliczeniu */
    const money = buildLoadMoney(l, {
      todayLocal,
      invoicedCostEur: invoicedCostEur ?? l.pricing.money?.cost.invoicedEur ?? null,
      invoicedRevEur: l.pricing.money?.rev.invoicedEur ?? null,
    });
    return { ...l, pricing: { ...l.pricing, money, moneyError: null } };
  } catch (e) {
    const { money: _drop, ...rest } = l.pricing;
    void _drop;
    return { ...l, pricing: { ...rest, moneyError: e instanceof Error ? e.message : String(e) } };
  }
}

/** Dołącza dane v2 do każdego transportu (seed, migracja v1→v2). */
export function attachMoneyV2(loads: Load[], invoices: Invoice[], todayLocal: string): Load[] {
  const inv = invoicedCostByLoad(invoices);
  return loads.map((l) => (l.pricing?.money?.v === 2 ? l : withMoneyV2(l, todayLocal, inv.get(l.id) ?? null)));
}

/**
 * M8 — niezmiennik na danych z serwera (migawki obu stron): ta sama data i mnożnik paliwowy,
 * przed fakturą ta sama tabela kursu. Zwraca opis rozjazdu albo null.
 */
export function mechanismIssue(m: LoadMoneyV2): string | null {
  const c = m.cost; const r = m.rev;
  if (!c.fuel.refDate || !r.fuel.refDate) return null; // jedna strona niewidoczna dla roli — nie ma czego porównać
  if (c.fuel.refDate !== r.fuel.refDate) return `Różne daty opłaty paliwowej: koszt ${formatCalendarDay(c.fuel.refDate)}, przychód ${formatCalendarDay(r.fuel.refDate)}`;
  if (c.fuel.applied !== r.fuel.applied) return `Różne mnożniki paliwowe: koszt ${c.fuel.applied}, przychód ${r.fuel.applied}`;
  if (c.tier !== 'FAKTURA' && r.tier !== 'FAKTURA' && c.fx.tableNo && r.fx.tableNo && c.fx.tableNo !== r.fx.tableNo) {
    return `Różne tabele kursowe przed fakturą: koszt ${c.fx.tableNo}, przychód ${r.fx.tableNo}`;
  }
  return null;
}

/** M8 — strona wyceny widoczna dla roli: HHL = transport (mniej pewna strona), SCX = koszt, KSH = przychód. */
export function moneyViewFor(role: 'HHL' | 'KSH' | 'SCX', m: LoadMoneyV2): { tier: PricingTier; side: MoneySideV2 } {
  if (role === 'SCX') return { tier: m.cost.tier, side: m.cost };
  if (role === 'KSH') return { tier: m.rev.tier, side: m.rev };
  const side = m.cost.fx.provisional || !m.rev.fx.tableNo ? m.cost : m.rev;
  return { tier: m.tier, side };
}

/** Marża transportu z danych v2 — z wartości efektywnych (faktura nadrzędna). */
export function marginV2(m: LoadMoneyV2) {
  const revenueEur = sideEffectiveEur(m.rev);
  const costEur = sideEffectiveEur(m.cost);
  return { tier: m.tier, revenueEur, costEur, marginEur: round2(revenueEur - costEur) };
}

/** M8 — zestawienie poziomów wyceny dla roli (liczba na poziom, kurs tymczasowy, wyliczenia przerwane). */
export interface TierSummary { counts: Record<PricingTier, number>; provisional: number; errors: string[] }
export function tierSummary(loads: Load[], role: 'HHL' | 'KSH' | 'SCX'): TierSummary {
  const out: TierSummary = { counts: { PROGNOZA: 0, REALIZACJA: 0, FAKTURA: 0 }, provisional: 0, errors: [] };
  for (const l of loads) {
    if (!l.pricing) continue;
    if (l.pricing.moneyError) { out.errors.push(l.code); continue; }
    const m = l.pricing.money;
    if (m?.v !== 2) continue;
    const v = moneyViewFor(role, m);
    out.counts[v.tier] += 1;
    if (v.side.fx.provisional) out.provisional += 1;
  }
  return out;
}

/**
 * G4 (odłożone z M8) — oznaczenie sumy w kokpicie: poziom sumy = najmniej pewny poziom składników
 * (ta sama reguła co „mniej pewna strona”), plus liczba składników z kursem tymczasowym.
 */
export function aggregateTier(loads: Load[], role: 'HHL' | 'KSH' | 'SCX'): { tier: PricingTier | null; provisional: number; count: number } {
  let tier: PricingTier | null = null;
  let provisional = 0;
  let count = 0;
  for (const l of loads) {
    const m = l.pricing?.money;
    if (!m || m.v !== 2 || l.pricing.moneyError) continue;
    const v = moneyViewFor(role, m);
    tier = tier ? leastTier(tier, v.tier) : v.tier;
    if (v.side.fx.provisional) provisional += 1;
    count += 1;
  }
  return { tier, provisional, count };
}

/** M11 — marża transportu jako LoadMargin silnika (wartości efektywne; PLN per transport, każda strona swoim kursem). */
export function loadMarginV2(m: LoadMoneyV2): LoadMargin {
  const revenueEur = round2(sideEffectiveEur(m.rev));
  const costEur = round2(sideEffectiveEur(m.cost));
  const marginEur = round2(revenueEur - costEur);
  const revenue = round2(revenueEur * m.rev.fx.mid);
  const cost = round2(costEur * m.cost.fx.mid);
  return {
    tier: m.tier, revenueEur, costEur, marginEur,
    marginPct: revenueEur === 0 ? null : Math.round((marginEur / revenueEur) * 1e4) / 1e4,
    pln: { revenue, cost, margin: round2(revenue - cost), provisional: m.rev.fx.provisional || m.cost.fx.provisional },
  };
}

/**
 * M11 — rozbicie marży na trzy poziomy pewności (MECHANIZM_PIENIEDZY §9, AN1): zafakturowana,
 * zrealizowana niezafakturowana, prognozowana. Sumy z `totalsByTier`; `total` liczony niezależnie
 * (suma marż transportów) — kryterium: FAKTURA + REALIZACJA + PROGNOZA = total, w obu walutach.
 * Transporty bez danych v2 albo z przerwanym wyliczeniem (moneyError) są pomijane i liczone w `skipped`.
 */
export function marginSplit(loads: Load[]) {
  const margins: LoadMargin[] = [];
  let skipped = 0;
  for (const l of loads) {
    const m = l.pricing?.money;
    if (!l.pricing || l.pricing.moneyError || m?.v !== 2) { skipped += 1; continue; }
    margins.push(loadMarginV2(m));
  }
  const tiers = totalsByTier(margins);
  let eur = 0; let pln = 0;
  for (const x of margins) { eur += x.marginEur; pln += x.pln.margin; }
  return { tiers, total: { count: margins.length, marginEur: round2(eur), marginPln: round2(pln) }, skipped };
}
