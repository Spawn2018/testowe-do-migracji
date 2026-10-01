/**
 * TEL-1 / DECYZJE §1 — numer krajowy bez kierunkowego.
 * Wejście z `+48…`, `0048…`, `+46…` → kraj + numer krajowy (bez `+`, spacji, myślników).
 */
export type PhoneCountry = 'PL' | 'SE' | 'OTHER';

export interface NationalPhone {
  national: string;
  country: PhoneCountry;
}

const DIGITS = /\D/g;

/** Usuwa kierunkowy PL/SE; inne numery zostawia jako cyfry (kraj OTHER). */
export function toNationalPhone(raw: string, hint: PhoneCountry = 'PL'): NationalPhone {
  const trimmed = raw.trim();
  if (!trimmed) return { national: '', country: hint };

  let digits = trimmed.replace(DIGITS, '');
  let country: PhoneCountry = hint;

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('48') && digits.length >= 11) {
    country = 'PL';
    digits = digits.slice(2);
  } else if (digits.startsWith('46') && digits.length >= 10) {
    country = 'SE';
    digits = digits.slice(2);
    if (!digits.startsWith('0')) digits = `0${digits}`;
  } else if (trimmed.startsWith('+') && !digits.startsWith('48') && !digits.startsWith('46')) {
    country = 'OTHER';
  }

  return { national: digits, country };
}

/** Czy numer krajowy wygląda sensownie (7–12 cyfr; SE może zaczynać się od 0). */
export function isPlausibleNational(national: string): boolean {
  if (!national) return false;
  return /^0?\d{7,11}$/.test(national);
}
