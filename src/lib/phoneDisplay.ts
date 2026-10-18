/**
 * Pełny numer telefonu do wyświetlenia: „+48000000012” → „+48 000 000 012”.
 * Decyzja właściciela 15.10.2026, 03:12: numery telefonów są wszędzie widoczne, bez ukrywania
 * (zastępuje „numer częściowo ukryty” z makiety E37 i skrót „…123” w Opcjach › Bramka SMS).
 */
export function groupPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return raw.trim();
  const plus = raw.trim().startsWith('+');
  /* przegląd 18.10 (D37) i F7 #307 D1: długość kodu kraju według ITU-T E.164 — 1 cyfra (+1, +7),
     3 cyfry (np. Litwa +370, Finlandia +358, Czechy +420, Izrael +972), pozostałe 2 cyfry */
  const ccLen = !plus ? 0 : /^[17]/.test(digits) ? 1
    : /^(2[1-689]|3[578]|42|5[09]|6[7-9]|8[05789]|9[679])/.test(digits) ? 3 : 2;
  const cc = plus ? `+${digits.slice(0, ccLen)}` : '';
  const rest = plus ? digits.slice(ccLen) : digits;
  return [cc, ...(rest.match(/\d{1,3}/g) ?? [])].filter(Boolean).join(' ');
}
