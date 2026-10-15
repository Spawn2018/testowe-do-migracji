/**
 * wyglad/P5-c — teksty: Kokpit „Marża” z liczbą transportów z ceną i bez (E16), opłata paliwowa przy pozycji faktury
 * (E39), karta opłaty paliwowej w panelu „Ceny” z liczbą publikacji i „ostateczna od …” (E39), powód odrzucenia
 * dopłaty (E33). Interfejs po polsku (E43); klucz spoza listy — słownik główny.
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  /* Kokpit (E16) */
  p5c_margin_desc: '{money} · ważona przychodem · {counts}',

  /* Faktura — pozycja transportu (E39) */
  p5c_bd_load: 'Transport',
  p5c_bd_fx: 'Kurs NBP',
  p5c_bd_fuel: 'Opłata paliwowa t{week} · ×{mult}',
  p5c_bd_fuel_amt: '{amt} {cur}',
  p5c_bd_fuel_fc: 'prognoza',

  /* Panel › Ceny — karta opłaty paliwowej (E39) */
  p5c_fuel_n: '({n}\u00a0publ.)',
  p5c_fuel_running: 'jeszcze nie zamknięte, do tego czasu ostatnia ostateczna {x} (wskaźniki {last})',
  p5c_fuel_final_from: 'ostateczna od {date}',
  p5c_fuel_until: 'ostateczna po zamknięciu tygodnia przed załadunkiem',

  /* Dopłata — odrzucenie z powodem (E33, 09.10 13:09 pkt 5) */
  p5c_rej_label: 'Powód odrzucenia',
  p5c_rej_ph: 'np. postój nie z winy załadowcy',
  p5c_rej_need: 'Wpisz powód — zobaczy go {who}.',
  p5c_rej_opt: 'Powód (nieobowiązkowo) — zobaczy go {who}.',
  p5c_rej_ok: 'Odrzuć dopłatę',
  p5c_rej_cancel: 'Anuluj',
  p5c_rej_by: 'Odrzucona przez {who}: {reason}',
  p5c_rej_by_nr: 'Odrzucona przez {who}.',
};

export function fc(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function fcp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = fc(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
