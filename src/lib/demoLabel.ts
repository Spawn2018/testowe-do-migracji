/**
 * D3 / D18 — explicit demo source labels.
 * UI chrome goes through i18n (`demo_mark*`); Polish strings kept for unit asserts / legacy.
 */

import type { Locale } from '../types';
import { t } from '../i18n/messages';

export const DEMO_MARK_PL = 'DEMONSTRACYJNE';

export const DEMO_MARK_TITLE_PL =
  'Dane demonstracyjne makiety — nie żywy feed zewnętrznego API';

/** Trafikverket E4 panel / map footnote (D3). */
export function trafikverketSourceNote(mode: 'live' | 'seed', showDemoMarks = true, locale?: Locale): string {
  /* A6-T2 — z językiem: tekst ze słownika; bez języka: dotychczasowy PL (testy jednostkowe) */
  if (locale) return t(locale, mode === 'live' ? 'a6_demo_tv_live' : !showDemoMarks ? 'a6_demo_tv_seed' : 'a6_demo_tv_note');
  if (mode === 'live') return 'Trafikverket live';
  if (!showDemoMarks) return 'Trafikverket seed';
  return 'dane demonstracyjne · brak klucza Trafikverket';
}

/** Short map footnote token. */
export function trafikverketShortLabel(mode: 'live' | 'seed', showDemoMarks = true, locale?: Locale): string {
  if (locale) return t(locale, mode === 'live' ? 'a6_demo_live' : showDemoMarks ? 'a6_demo_short' : 'a6_demo_seed');
  if (mode === 'live') return 'live';
  return showDemoMarks ? 'demonstracyjne' : 'seed';
}

export function isDemoSourceMode(mode: 'live' | 'seed'): boolean {
  return mode !== 'live';
}
