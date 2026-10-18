/**
 * wyglad/E49 — teksty: sprawa SCX „Objazd czy postój?” (decyzja 16.10.2026, 02:08, odp. 3) i linie wiatru w ETA.
 * Interfejs tylko po polsku (E43).
 */
const pl = {
  e49_title: '{place} zamknięty {until} — objazd czy postój?',
  e49_until: 'do {t}',
  e49_until_none: 'bez godziny końca',
  e49_reason_WIND: 'wiatr',
  e49_reason_ACCIDENT: 'wypadek',
  e49_reason_WORKS: 'roboty',
  e49_reason_OTHER: 'utrudnienie',
  e49_src_TRAFIKVERKET: 'komunikat Trafikverket',
  e49_src_HERE: 'zdarzenie HERE Traffic',
  e49_sub: '{reason} · {src} {at} · decyzja SCX do {by} (auto dojedzie do zjazdu)',
  e49_sub_late: '{reason} · {src} {at} · termin decyzji minął {by} — ETA liczy postój',
  e49_hold: 'Stoimy',
  e49_detour: 'Jedziemy objazdem',
  e49_hold_h: 'Postój',
  e49_detour_h: 'Objazd',
  e49_hold_until: 'do {t} (koniec zamknięcia + 30\u00a0min)',
  e49_hold_unknown: 'do odwołania komunikatu — koniec nieznany',
  e49_km0: '+0\u00a0km',
  e49_eta: 'ETA {t}',
  e49_eta_add: '+{d} wobec ETA bez zamknięcia',
  e49_via: '{via}',
  e49_faster: 'szybciej o {d}',
  e49_risks: 'Ryzyka',
  e49_risk_warn: 'uwaga',
  e49_risk_ok: 'sprawdzone',
  e49_none: 'Brak objazdu dla tego zestawu',
  e49_note: 'Uwagi (dobrowolnie)',
  e49_src_line: 'Objazd: trasa HERE dla ciężarówki z wymiarami i masą zestawu. Przeliczane co 30\u00a0min i przy zmianie komunikatu.',
  e49_wait_scx: 'Decyduje SCX — czeka na decyzję.',
  e49_done_hold: 'Zapisano: postój. HHL dostanie powiadomienie, ETA liczy postój.',
  e49_done_detour: 'Zapisano: objazd. HHL dostanie powiadomienie, ETA liczy objazd.',
  e49_hist_hold: 'SCX: postój do {t} — {place} zamknięty',
  e49_hist_hold_unknown: 'SCX: postój do odwołania — {place} zamknięty',
  e49_hist_detour: 'SCX: objazd {via}, {km}, +{d} — {place} zamknięty',
  e49_hist_note: ' · uwagi: {n}',
  e49_short: '{place} zamknięty — objazd czy postój?',
  /* E45 (D-20261016-0230-01 Z3 pkt 8): linia objazdu na mapie po decyzji SCX „Jedziemy objazdem” */
  e49_map_line: '{code} · objazd {via}: {km}, +{d} · decyzja SCX',

} as const;

export type E49Key = keyof typeof pl;

export function e49t(key: E49Key, vars?: Record<string, string | number>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const E49_PL = pl;
