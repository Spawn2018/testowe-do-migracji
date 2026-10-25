/**
 * TEL-1 / DECYZJE §1 — numer krajowy bez kierunkowego.
 * Wejście z `+48…`, `0048…`, `+46…` → kraj + numer krajowy (bez `+`, spacji, myślników).
 * E.164 budujemy dopiero przy SMS (`toE164`).
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

/** E6-4 — numer konta / zaproszenia w pełnym E.164. */
export function isE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone.trim());
}

/** E.164 wyłącznie do dial/`tel:` i bramki SMS — nie do zapisu w loads. */
export function toE164(national: string, country: PhoneCountry = 'PL'): string | null {
  const d = national.replace(DIGITS, '');
  if (!d) return null;
  if (country === 'PL' || country === 'OTHER') {
    const n = d.startsWith('48') && d.length >= 11 ? d.slice(2) : d;
    return /^\d{7,11}$/.test(n) ? `+48${n}` : null;
  }
  if (country === 'SE') {
    let n = d.startsWith('46') ? d.slice(2) : d;
    if (n.startsWith('0')) n = n.slice(1);
    return /^\d{7,11}$/.test(n) ? `+46${n}` : null;
  }
  return null;
}
