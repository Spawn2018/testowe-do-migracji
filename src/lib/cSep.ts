/**
 * C-SEP — separator kierowca/telefon/ciągnik.
 * Watch Tower: „ / ” domyślnie; „|” tylko przy zaznaczonym Przepięcie.
 * SharePoint (II-10): zawsze „ / ” (formatSharePointPair).
 * Brak drugiej wartości: „A / ...” albo przy przepięciu „A|...”.
 * Brak obu: „–”.
 */

export type PairSide = string | null | undefined;

function clean(v: PairSide): string {
  return (v ?? '').trim();
}

/** Format w Watch Tower (zależny od checkboxa Przepięcie). */
export function formatTowerPair(a: PairSide, b: PairSide, swap: boolean): string {
  const left = clean(a);
  const right = clean(b);
  if (!left && !right) return '–';
  if (swap) {
    if (!left) return `...|${right}`;
    if (!right) return `${left}|...`;
    return `${left}|${right}`;
  }
  if (!left) return `... / ${right}`;
  if (!right) return `${left} / ...`;
  return `${left} / ${right}`;
}

/** Format do Excela SharePoint — zawsze „ / ”, nigdy „|”. */
export function formatSharePointPair(a: PairSide, b: PairSide): string {
  const left = clean(a);
  const right = clean(b);
  if (!left && !right) return '–';
  if (!left) return `... / ${right}`;
  if (!right) return `${left} / ...`;
  return `${left} / ${right}`;
}
