/**
 * E37 (08.10 12:14), E21 „Zero kodów” (audyt-A A-03): port promowy pełną nazwą — „Gdańsk”, „Nynäshamn”, „Gdynia”,
 * „Karlskrona” — w pasku górnym i w Kokpicie ten sam słownik `p3a_port_*`. Nazwy własne są te same w każdym języku
 * (słownik polski jako zapas); nieznany kod zostaje bez zmian.
 */
import { I18N_ALL } from '../i18n/messages';
import type { Locale } from '../types';
import { routeEnds } from './ferryCatalog';

export function portName(locale: Locale, code: string): string {
  const key = `p3a_port_${code}`;
  return I18N_ALL[locale]?.[key] ?? I18N_ALL.pl[key] ?? code;
}

/** „Gdańsk → Nynäshamn”. */
export function ferryRouteName(locale: Locale, from: string, to: string): string {
  return `${portName(locale, from)} → ${portName(locale, to)}`;
}

/** BN9-b: port z terminalem — „Tallinn A” (Viking Line, Eckerö); bez terminala sama nazwa. */
function endName(locale: Locale, code: string, terminal?: string): string {
  const n = portName(locale, code);
  return terminal ? `${n} ${terminal}` : n;
}

/**
 * BN9-b — nazwa trasy z jej kodu dla każdej trasy ze słownika: „Gdańsk → Nynäshamn”, „Tallinn A → Helsinki”.
 * Kod spoza katalogu i słownika zostaje bez zmian (bez podmiany na Gdańsk → Nynäshamn).
 */
export function ferryRouteLabel(locale: Locale, code: string | null | undefined): string {
  const e = routeEnds(code);
  if (!e) return code ?? '';
  return `${endName(locale, e.from, e.fromTerminal)} → ${endName(locale, e.to, e.toTerminal)}`;
}

/**
 * DP-4 (F7 #649): końce trasy pełnymi nazwami ze słownika tras (`routeEnds`) — „Tallinn A”, „Helsinki”.
 * Bez dzielenia kodu po myślniku („TLLA-HEL” nie daje portu „TLLA”). Trasa spoza słownika albo brak trasy → null
 * (bez podmiany na Gdańsk → Nynäshamn).
 */
export function ferryRouteEnds(locale: Locale, code: string | null | undefined): { a: string; b: string } | null {
  const e = routeEnds(code);
  if (!e) return null;
  return { a: endName(locale, e.from, e.fromTerminal), b: endName(locale, e.to, e.toTerminal) };
}
