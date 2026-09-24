/**
 * D3 / D18 — explicit demo source labels.
 * UI chrome goes through i18n (`demo_mark*`); Polish strings kept for unit asserts / legacy.
 */

export const DEMO_MARK_PL = 'DEMONSTRACYJNE';

export const DEMO_MARK_TITLE_PL =
  'Dane demonstracyjne makiety — nie żywy feed zewnętrznego API';

/** Trafikverket E4 panel / map footnote (D3). */
export function trafikverketSourceNote(mode: 'live' | 'seed', showDemoMarks = true): string {
  if (mode === 'live') return 'Trafikverket live';
  if (!showDemoMarks) return 'Trafikverket seed';
  return 'dane demonstracyjne · brak klucza Trafikverket';
}

/** Short map footnote token. */
export function trafikverketShortLabel(mode: 'live' | 'seed', showDemoMarks = true): string {
  if (mode === 'live') return 'live';
  return showDemoMarks ? 'demonstracyjne' : 'seed';
}

export function isDemoSourceMode(mode: 'live' | 'seed'): boolean {
  return mode !== 'live';
}
