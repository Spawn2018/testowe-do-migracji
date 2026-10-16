/**
 * E37 (08.10 12:14), E21 „Zero kodów” (audyt-A A-03): port promowy pełną nazwą — „Gdańsk”, „Nynäshamn”, „Gdynia”,
 * „Karlskrona” — w pasku górnym i w Kokpicie ten sam słownik `p3a_port_*`. Nazwy własne są te same w każdym języku
 * (słownik polski jako zapas); nieznany kod zostaje bez zmian.
 */
import { I18N_ALL } from '../i18n/messages';
import type { Locale } from '../types';

export function portName(locale: Locale, code: string): string {
  const key = `p3a_port_${code}`;
  return I18N_ALL[locale]?.[key] ?? I18N_ALL.pl[key] ?? code;
}

/** „Gdańsk → Nynäshamn”. */
export function ferryRouteName(locale: Locale, from: string, to: string): string {
  return `${portName(locale, from)} → ${portName(locale, to)}`;
}
