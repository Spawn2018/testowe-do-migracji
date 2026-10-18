/**
 * Pełny numer telefonu do wyświetlenia: „+48000000012” → „+48 000 000 012”.
 * Decyzja właściciela 15.10.2026, 03:12: numery telefonów są wszędzie widoczne, bez ukrywania
 * (zastępuje „numer częściowo ukryty” z makiety E37 i skrót „…123” w Opcjach › Bramka SMS).
 */
export function groupPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return raw.trim();
  const plus = raw.trim().startsWith('+');
  /* przegląd 18.10 (D37): kody 3-cyfrowe (Litwa +370, Łotwa +371, Estonia +372, Finlandia +358) — nie „+37 000…” */
  const ccLen = plus && /^(35\d|37\d|38\d|42\d)/.test(digits) ? 3 : 2;
  const cc = plus ? `+${digits.slice(0, ccLen)}` : '';
  const rest = plus ? digits.slice(ccLen) : digits;
  return [cc, ...(rest.match(/\d{1,3}/g) ?? [])].filter(Boolean).join(' ');
}
