/**
 * DP-22 (#667 F7 r1 N5 / r2): ostrzeżenie w Stanie systemu z summary odrzuconego legu.
 * Bez Leaflet — czysta funkcja pod testy node.
 */
import type { SourceRow } from './sysSource';

/** Jak `roadsRejectSummary` w applyBasemap — tu bez zależności od mapy. */
export function roadsRejectDetail(rejected: { leg: string; why: string }[]): string {
  if (rejected.length === 0) return '';
  return rejected.map((r) => `${r.leg}: ${r.why}`).join(' · ');
}

/**
 * Gdy `checkRoads` zwróci odrzucenia (summary z bazy) — wiersz `here-roads` → partial
 * (albo dopisek przy down/nosource z przebiegu zadania).
 */
export function withHereRoadsRejects(
  rows: SourceRow[],
  rejected: { leg: string; why: string }[],
): SourceRow[] {
  if (!rejected.length) return rows;
  const detail = roadsRejectDetail(rejected);
  if (!detail) return rows;
  return rows.map((r) => {
    if (r.id !== 'here-roads') return r;
    if (r.state === 'down' || r.state === 'nosource') {
      return { ...r, why: r.why ? `${r.why} ${detail}` : detail };
    }
    return {
      ...r,
      state: 'partial',
      since: r.since ?? r.lastAt,
      why: detail,
    };
  });
}
