/**
 * A6 — konflikt zapisu WT→plik: wiersz w pliku zmienił się od ostatniego odczytu (D-1420).
 * F7 #560: daty/godziny + numery zleceń; brak expected_file → nie zapisuj (pomijaj).
 */

export type FileDateSnap = {
  ld: string | null;
  lt: string | null;
  dd: string | null;
  dt: string | null;
  /** Nr zlecenia HHL-Scan (carrier_order_no). */
  co?: string | null;
  /** Nr zlecenia HHL-KSH (hhl_order_no). */
  ho?: string | null;
};

/** true = brak expected → nie wolno pisać (F7: pomiń, nie konflikt). */
export function missingExpectedFile(
  expected: FileDateSnap | null | undefined,
): boolean {
  return expected == null;
}

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
    || (expected.co ?? null) !== (current.co ?? null)
    || (expected.ho ?? null) !== (current.ho ?? null)
  );
}
