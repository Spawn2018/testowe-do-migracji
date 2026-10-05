/**
 * PL-PLURAL — jedna odmiana polska rzeczownika przy liczebniku.
 * 1 → one; 2–4 oraz 22–24, 32–34… → few; 0, 5–21, 12–14, 25+ → many.
 * 21 i 11 idą jak 5+ (nie jak 1). Ułamek i NaN → many.
 */
export function plPlural(n: number, one: string, few: string, many: string): string {
  if (!Number.isFinite(n)) return many;
  const v = Math.abs(Math.trunc(n));
  if (v === 1) return one;
  const mod10 = v % 10;
  const mod100 = v % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
