/**
 * Pełny numer telefonu do wyświetlenia: „+48000000012” → „+48 000 000 012”.
 * Decyzja właściciela 15.10.2026, 03:12: numery telefonów są wszędzie widoczne, bez ukrywania
 * (zastępuje „numer częściowo ukryty” z makiety E37 i skrót „…123” w Opcjach › Bramka SMS).
 */
export function groupPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return raw.trim();
  const plus = raw.trim().startsWith('+');
  const cc = plus ? `+${digits.slice(0, 2)}` : '';
  const rest = plus ? digits.slice(2) : digits;
  return [cc, ...(rest.match(/\d{1,3}/g) ?? [])].filter(Boolean).join(' ');
}
