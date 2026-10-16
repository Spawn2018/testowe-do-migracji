/**
 * wyglad/P6-e — Czat: „Przeczytali” (kto i kiedy), wiadomość w dzwonku (D-20261016-0250-01 Cz11,
 * D-20261016-0310-01 Cz23, D-20261016-0315-01 Cz25). Interfejs tylko po polsku (E43). Mały słownik — pierwsze wczytanie.
 */
const pl = {
  p6e_sent: 'Wysłane do {orgs} · nikt jeszcze nie otworzył',
  p6e_sent_short: 'Wysłane',
  p6e_read: 'Przeczytali: {n}',
  p6e_read_short: '{n}',
  p6e_read_pending: ' · {orgs} jeszcze nie',
  p6e_pending: 'Jeszcze nie otworzyli: {orgs}',
  p6e_list: 'Kto przeczytał',
  p6e_you: ' (Ty)',
  p6e_and: ' i ',
  p6e_bell_only: 'tylko HHL i SCX',
} as const;

export type P6eKey = keyof typeof pl;

export function pt(key: P6eKey, vars?: Record<string, string | number>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const P6E_PL = pl;
