/**
 * DP-231 / #859: gdy `ferry_track_sample` wraca dokładnie z limitem wierszy PostgREST —
 * sygnał ucięcia → Stan systemu „Częściowo” dla pozycji promów.
 */
import type { SourceRow } from './sysSource';

/** Domyślny max-rows PostgREST / jawny `.limit()` klienta. */
export const FERRY_TRACK_SAMPLE_LIMIT = 1000;

let truncatedAt: string | null = null;

export function noteFerryTrackSampleTruncated(atIso: string = new Date().toISOString()): void {
  truncatedAt = atIso;
}

export function clearFerryTrackSampleTruncation(): void {
  truncatedAt = null;
}

/** Testy / Stan systemu — ostatnie wykrycie ucięcia (null = brak). */
export function ferryTrackSampleTruncatedAt(): string | null {
  return truncatedAt;
}

/**
 * Gdy mapa wykryła ucięcie RPC — wiersz `ferry-pos` → partial
 * (albo dopisek przy down/nosource z przebiegu zadania).
 */
export function withFerryTrackTruncation(
  rows: SourceRow[],
  truncated: boolean,
  why = 'Odczyt pozycji promów ucięty do limitu API — mapa może mieć niepełny ślad.',
): SourceRow[] {
  if (!truncated) return rows;
  return rows.map((r) => {
    if (r.id !== 'ferry-pos') return r;
    if (r.state === 'down' || r.state === 'nosource') {
      return { ...r, why: r.why ? `${r.why} ${why}` : why };
    }
    return {
      ...r,
      state: 'partial',
      since: r.since ?? r.lastAt,
      why,
    };
  });
}
