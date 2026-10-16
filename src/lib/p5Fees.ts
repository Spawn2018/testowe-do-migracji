/**
 * wyglad/P5 — dopłaty w panelu „Ceny” (E33; decyzje 08.10 12:23, 12:35 i 09.10 13:09 pkt 5).
 * Dwa rodzaje: postój i anulowanie. System liczy i podpowiada, nic nie wchodzi do ceny samo:
 * HHL decyduje po swojej stronie (potem akceptuje KSH), SCX po swojej (potem akceptuje HHL).
 * Zasady (wartości z decyzji; w produkcji z bazy — `feeRulesOf`): czas wolny 6 h na załadunku i 4 h na rozładunku,
 * 75 EUR za każdą rozpoczętą godzinę ponad czas wolny, powyżej 10 h postoju 750 EUR za każdą rozpoczętą dobę
 * (W41, decyzja właściciela 15.10.2026 18:32; wcześniej 24 h);
 * anulowanie: % frachtu bez opłaty paliwowej, ten sam procent po obu stronach (≥ 5 dni 0, 4 dni 15, 3 i 2 dni 25,
 * 1 dzień 50, dzień załadunku 100).
 */
export type FeeKind = 'DWELL' | 'CANCEL';
export type DwellPlace = 'LOAD' | 'UNLOAD';

export interface FeeRules {
  freeHours: Record<DwellPlace, number>;
  hourEur: number;
  dayEur: number;
  /** Stawka dobowa od tylu godzin postoju w jednym miejscu (`DWELL_DAY_AFTER_H`). */
  dayAfterH: number;
  /** Procent frachtu według liczby dni kalendarzowych przed załadunkiem (klucz: dni; 5 = 5 i więcej). */
  cancelPct: Record<number, number>;
}

export const DECIDED_RULES: FeeRules = {
  freeHours: { LOAD: 6, UNLOAD: 4 },
  hourEur: 75,
  dayEur: 750,
  dayAfterH: 10,
  cancelPct: { 5: 0, 4: 15, 3: 25, 2: 25, 1: 50, 0: 100 },
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Postój: rozpoczęte godziny ponad czas wolny × stawka; powyżej progu (10 h, W41) — rozpoczęte doby × stawka dobowa. */
export function dwellFee(minutes: number, place: DwellPlace, rules: FeeRules = DECIDED_RULES): { overMin: number; hours: number; days: number; eur: number } {
  const overMin = Math.max(0, Math.round(minutes) - rules.freeHours[place] * 60);
  if (overMin === 0) return { overMin: 0, hours: 0, days: 0, eur: 0 };
  if (minutes > rules.dayAfterH * 60) {
    const days = Math.ceil(minutes / (24 * 60));
    return { overMin, hours: 0, days, eur: r2(days * rules.dayEur) };
  }
  const hours = Math.ceil(overMin / 60);
  return { overMin, hours, days: 0, eur: r2(hours * rules.hourEur) };
}

/** Procent anulowania według dni kalendarzowych do planowanego załadunku (ujemne = po załadunku → 100 %). */
export function cancelPct(daysBefore: number, rules: FeeRules = DECIDED_RULES): number {
  if (daysBefore >= 5) return rules.cancelPct[5];
  if (daysBefore <= 0) return rules.cancelPct[0];
  return rules.cancelPct[daysBefore] ?? rules.cancelPct[5];
}

/** Dni kalendarzowe między datą anulowania a planowanym załadunkiem (daty lokalne RRRR-MM-DD). */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86_400_000);
}

/** Anulowanie: ten sam procent od frachtu przewoźnika i od frachtu KSH, bez opłaty paliwowej (12:35 pkt 4). */
export function cancelFee(costBaseEur: number, revBaseEur: number, daysBefore: number, rules: FeeRules = DECIDED_RULES): { pct: number; cost: number; rev: number } {
  const pct = cancelPct(daysBefore, rules);
  return { pct, cost: r2((costBaseEur * pct) / 100), rev: r2((revBaseEur * pct) / 100) };
}

/** „3 h 44 min”. */
export function durText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h} h${mm ? ` ${mm} min` : ''}` : `${mm} min`;
}

/** Podpowiedź systemu dla jednego miejsca albo anulowania (dane z pomiaru stref i cennika). */
export interface FeeSuggestion {
  id: string;
  kind: FeeKind;
  place: DwellPlace | null;
  /** Nazwa miejsca, np. „Śrem” albo „Boden”. */
  where: string;
  /** Pomiar: wjazd i wyjazd ze strefy (ISO) albo powód braku pomiaru. */
  enterAt: string | null;
  exitAt: string | null;
  minutes: number | null;
  zone: string | null;
  noMeasure: string | null;
  /** Kwota po stronie przewoźnika i KSH (EUR); 0 = nic do dodania. */
  costEur: number;
  revEur: number;
  /** Anulowanie: data anulowania, dni i procent. */
  cancelledAt?: string | null;
  days?: number | null;
  pct?: number | null;
  /** Stan po stronie firm: null = nic nie dodano. */
  hhl: FeeDecision | null;
  scx: FeeDecision | null;
  /** Powód odrzucenia (E33): dopłaty HHL przez KSH i dopłaty SCX przez HHL; null = brak. */
  hhlReason?: string | null;
  scxReason?: string | null;
}

export type FeeDecision = 'DODANA' | 'NIE_DODAJE' | 'CZEKA_KSH' | 'CZEKA_HHL' | 'PRZYJETA' | 'ODRZUCONA';

/* wyglad/P5-c (E33): odrzucenie dopłaty — strona dopłaty: „hhl” (dodała HHL, akceptuje KSH), „scx” (dodał SCX, akceptuje HHL) */
export type FeeSide = 'hhl' | 'scx';
type ViewRole = 'HHL' | 'KSH' | 'SCX';
/** Kto akceptuje albo odrzuca dopłatę strony. */
export const rejecterOf = (side: FeeSide): ViewRole => (side === 'hhl' ? 'KSH' : 'HHL');
/** Kto zobaczy powód: firma, która dodała dopłatę. */
export const reasonReaderOf = (side: FeeSide): ViewRole => (side === 'hhl' ? 'HHL' : 'SCX');
/** Powód obowiązkowy, gdy HHL odrzuca dopłatę SCX (E33); KSH może odrzucić bez powodu. */
export const rejectNeedsReason = (side: FeeSide): boolean => side === 'scx';
/** Kto widzi „Odrzucona przez …”: strona dopłaty, odrzucający i HHL (KSH nie widzi dopłat SCX). */
export const rejectionVisibleTo = (role: ViewRole, side: FeeSide): boolean =>
  side === 'hhl' ? role === 'HHL' || role === 'KSH' : role === 'HHL' || role === 'SCX';
