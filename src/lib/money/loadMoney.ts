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
  buildPriceSide, assertSameMechanism, localDateOf, nbpRateBefore, resolveTier,
  type NbpRate, type PriceSide, type PricingTier,
} from './engine';
import { DEMO_NBP_RATES } from './demoFx';

export interface MoneyFuelSnap { refDate: string; multSek: number; multPln: number; applied: number }
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

/** Rzeczywisty rozładunek (UTC) — v2; demo: DELIVERED bez daty → koniec okna rozładunku. */
export function unloadedAtOf(load: Load): string | null {
  if (load.unloadedAt) return load.unloadedAt;
  if (load.status !== 'DELIVERED') return null;
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
    const rate = nbpRateBefore(rates, localRefDate);
    return { rate, provisional: localRefDate > todayLocal };
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
  const refUtc = unloadedAtUtc ?? plannedDeliveryUtc(load);
  const refDate = localDateOf(refUtc);
  const sefs = sefsForLoadDate(refDate);
  const fuel = {
    mechanism: 'SEFS_HYBRID_MIN' as const,
    referenceDate: refDate,
    multSek: sefs.multSek,
    multPln: sefs.multPln,
    appliedMultiplier: sefs.appliedMult,
    documentRef: 'src/lib/sefs.ts',
  };
  const { rate, provisional } = fxForDate(refDate, opts.todayLocal, opts.rates);
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

/** Dołącza dane v2 do każdego transportu (seed, migracja v1→v2). */
export function attachMoneyV2(loads: Load[], invoices: Invoice[], todayLocal: string): Load[] {
  const inv = invoicedCostByLoad(invoices);
  return loads.map((l) => {
    if (l.pricing?.money?.v === 2) return l;
    try {
      const money = buildLoadMoney(l, { todayLocal, invoicedCostEur: inv.get(l.id) ?? null });
      return { ...l, pricing: { ...l.pricing, money } };
    } catch {
      return l; // brak danych do wyliczenia → transport bez v2 (lista wyjątków), nie zero
    }
  });
}

/** Marża transportu z danych v2 — z wartości efektywnych (faktura nadrzędna). */
export function marginV2(m: LoadMoneyV2) {
  const revenueEur = sideEffectiveEur(m.rev);
  const costEur = sideEffectiveEur(m.cost);
  return { tier: m.tier, revenueEur, costEur, marginEur: round2(revenueEur - costEur) };
}
