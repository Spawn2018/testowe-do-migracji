/**
 * BN9-c1 — formularz ręcznego komunikatu armatora (Ryzyka › Promy) i historia komunikatów.
 * DP-86: wybór rejsów armatora wydzielony do `noticeSailingsFor` (test z > 40 rejsami bałtyckimi).
 * DP-87: bez rejsów z przeszłości (odejście — także opóźnione — przed „teraz”).
 * DP-104: historia — „automatyczny” / „ręczny” (`operator_notices.source`, 0358) i link do źródła tylko https.
 */
import type { Sailing } from '../types';
import { isFerryOperator, sailingOfOperator, type FerryOperator } from './ferryCatalog';
import { effDeparture } from './sailings';

/** Najwięcej rejsów na liście formularza (jak dotąd). */
export const NOTICE_SAILINGS_MAX = 40;

/**
 * Rejsy do wyboru w formularzu: tylko wybranego armatora (F7 #680 B4), bez rejsów, które już odeszły (DP-87),
 * od najbliższego, najwyżej `max`. Brak armatora → pusta lista.
 */
export function noticeSailingsFor(
  sailings: readonly Sailing[],
  operator: FerryOperator | '' | null | undefined,
  nowMs: number,
  max: number = NOTICE_SAILINGS_MAX,
): Sailing[] {
  if (!operator) return [];
  return sailings
    .filter((s) => {
      const named = isFerryOperator(s.source) ? s.source : s.operator;
      return sailingOfOperator({ route: s.route, operator: named }, operator);
    })
    .filter((s) => {
      const dep = Date.parse(effDeparture(s));
      return Number.isFinite(dep) && dep >= nowMs;
    })
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))
    .slice(0, max);
}

/** DP-104: etykieta źródła komunikatu. Brak kolumny (baza przed 0358) — ręczny, jak domyślna wartość kolumny. */
export function noticeIsAuto(source: string | null | undefined): boolean {
  return /^\s*auto\s*$/i.test(String(source ?? ''));
}

export function noticeSourcePl(source: string | null | undefined): 'automatyczny' | 'ręczny' {
  return noticeIsAuto(source) ? 'automatyczny' : 'ręczny';
}

/** DP-104: adres źródła do linku — wyłącznie poprawny `https:`; inaczej `null` (bez linku). */
export function noticeSourceHref(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !!u.hostname ? u.href : null;
  } catch {
    return null;
  }
}
