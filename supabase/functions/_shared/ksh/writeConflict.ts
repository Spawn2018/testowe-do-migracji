/**
 * A6 — konflikt zapisu WT→plik: wiersz w pliku zmienił się od ostatniego odczytu (D-1420).
 * Porównanie tylko pól dat/godzin (bez PII).
 */

export type FileDateSnap = {
  ld: string | null;
  lt: string | null;
  dd: string | null;
  dt: string | null;
};

/** true = plik ≠ oczekiwany → nie nadpisuj, sprawa HHL. */
export function fileRowChangedSinceRead(
  expected: FileDateSnap | null | undefined,
  current: FileDateSnap | null | undefined,
): boolean {
  if (!expected) return false;
  if (!current) return true;
  return (
    (expected.ld ?? null) !== (current.ld ?? null)
    || (expected.lt ?? null) !== (current.lt ?? null)
    || (expected.dd ?? null) !== (current.dd ?? null)
    || (expected.dt ?? null) !== (current.dt ?? null)
  );
}
