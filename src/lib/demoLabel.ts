/**
 * D3 / D18 — explicit demo source labels (Polish UI).
 * Reuse when marking seed/makieta data that must not look like live API.
 */

export const DEMO_MARK_PL = 'DEMONSTRACYJNE';

export const DEMO_MARK_TITLE_PL =
  'Dane demonstracyjne makiety — nie żywy feed zewnętrznego API';

/** Trafikverket E4 panel / map footnote (D3). */
export function trafikverketSourceNote(mode: 'live' | 'seed'): string {
  if (mode === 'live') return 'Trafikverket live';
  return 'dane demonstracyjne · brak klucza Trafikverket';
}

/** Short map footnote token. */
export function trafikverketShortLabel(mode: 'live' | 'seed'): string {
  return mode === 'live' ? 'live' : 'demonstracyjne';
}

export function isDemoSourceMode(mode: 'live' | 'seed'): boolean {
  return mode !== 'live';
}
