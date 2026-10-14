/**
 * wyglad/P5 — teksty Finansów (E16, E39) poza pierwszym wczytaniem: moduł ładowany razem z leniwym widokiem
 * Finansów (budżet 400 kB gzip, `scripts/bundle-size.mjs`). Interfejs po polsku (E43); klucz spoza listy — słownik główny.
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  /* nagłówek */
  p5_fin_unpriced_note: '({codes}{why})',
  p5_fin_unpriced_why_date: ', brak daty',
  p5_fin_cur: '{cur} · zmiana w „Dla mnie”',
  /* etapy */
  p5_fin_stages_h: 'Od przychodu do marży',
  p5_fin_stages_h_ksh: 'Do zapłaty według etapu',
  p5_fin_stages_h_scx: 'Należność według etapu',
  p5_fin_col_stage: 'Etap rozliczenia',
  p5_fin_col_stage_s: 'Etap',
  p5_fin_col_loads: 'Transporty',
  p5_fin_col_rev: 'Przychód (KSH)',
  p5_fin_col_cost: 'Koszt (SCX)',
  p5_fin_col_margin: 'Marża',
  p5_fin_col_pct: '%',
  p5_fin_col_due_ksh: 'Do zapłaty ({cur})',
  p5_fin_col_due_scx: 'Należność ({cur})',
  p5_fin_stage_FAKTURA: 'Zafakturowane',
  p5_fin_stage_REALIZACJA: 'Dostarczone',
  p5_fin_stage_PROGNOZA: 'Prognoza',
  p5_fin_stage_FAKTURA_d: 'obie faktury',
  p5_fin_stage_REALIZACJA_d: 'do zafakturowania',
  p5_fin_stage_PROGNOZA_d: 'przed dostawą',
  p5_fin_stage_REALIZACJA_rev: 'Dostarczone, przed fakturą',
  p5_fin_stage_REALIZACJA_cost: 'Dostarczone, do faktury',
  p5_fin_sub_ksh: 'Twoja cena',
  p5_fin_sub_scx: 'Twoja stawka',
  p5_fin_margin_total: 'Marża razem',
  p5_fin_margin_line: 'przychód {rev} · koszt {cost}',
  p5_fin_card_margin: 'Marża',
  p5_fin_card_revcost: 'Przychód / koszt',
  p5_fin_card_due_ksh: 'Do zapłaty',
  p5_fin_card_due_scx: 'Należność',
  p5_fin_nbp_short: '{table} z {date} · {mid} · dostarczone: kurs przed rozładunkiem',
  p5_fin_priced_line: '{priced} z ceną · {unpriced} bez ceny',
  p5_fin_priced_all: '{priced} z ceną',
  p5_fin_total: 'Razem ({cur})',
  p5_fin_total_s: 'Razem',
  p5_fin_stages_note:
    'Marża % = marża ÷ przychód. Te same liczby w Kokpicie, w Harmonogramie i w panelu każdego transportu. „Dostarczone” liczy się od statusu „Dostarczone”, a kwota z faktury zastępuje wyliczenie.',
  p5_fin_stages_note_ksh: 'Twoja cena według etapu. Bez kosztu przewoźnika i bez marży.',
  p5_fin_stages_note_scx: 'Twoja stawka według etapu. Bez ceny KSH i bez marży.',
  p5_fin_pln_note: 'PLN: transport dostarczony — kurs NBP z dnia roboczego przed rozładunkiem; przed rozładunkiem — kurs bieżący {table} z {date}. Suma to suma przeliczeń transportów.',
  p5_fin_pln_missing: 'Brak kursu NBP — kwoty w EUR.',
  /* rodzaje */
  p5_fin_types_h: 'Marża według rodzaju elementu',
  p5_fin_col_type: 'Rodzaj',
  p5_fin_col_priced: 'Z ceną / wszystkie',
  p5_fin_col_rev_s: 'Przychód',
  p5_fin_col_cost_s: 'Koszt',
  p5_fin_types_n: '{n} rodzajów',
  /* karty z boku */
  p5_fin_nbp_h: 'Kurs NBP (tabela A)',
  p5_fin_nbp_last: 'Ostatnia tabela',
  p5_fin_nbp_last_v: 'z {date} · 1 EUR = {mid} PLN',
  p5_fin_nbp_none: 'brak kursu w danych',
  p5_fin_nbp_fetch: 'Pobieranie',
  p5_fin_nbp_fetch_v: '2× dziennie, 12:30 i 16:30',
  p5_fin_nbp_done: 'Dostarczony',
  p5_fin_nbp_done_v: 'kurs z dnia roboczego przed rozładunkiem, na stałe przy transporcie',
  p5_fin_nbp_before: 'Przed rozładunkiem',
  p5_fin_nbp_before_v: 'kurs bieżący (ostatnia tabela), z dopiskiem „kurs bieżący”',
  p5_fin_nbp_foot: 'PLN tylko po przełączeniu waluty w Moje konto.',
  p5_fin_flag_h: 'Flaga marży',
  p5_fin_flag_thr: 'Próg marży (Opcje › Cennik i opłaty)',
  p5_fin_flag_thr_none: 'nie ustawiony',
  p5_fin_flag_below: 'Transporty poniżej progu',
  p5_fin_flag_off: '— (flaga wyłączona)',
  p5_fin_flag_note: 'Jeden próg dla listy i koloru marży. Ustawia i zmienia tylko Administrator HHL, z wpisem w Historii zmian. Bez progu flaga jest wyłączona.',
  p5_fin_flag_list_h: 'Poniżej progu marży',
  p5_fin_fuel_h: 'Opłata paliwowa',
  p5_fin_fuel_p: 'Tydzień, w którym opłata obowiązuje, tydzień wskaźników i mnożniki — tabela niżej. Ceny paliwa, tabela mnożników i pobieranie: Opcje › Opłata paliwowa.',
  p5_fin_fuel_go_table: 'Tabela tygodni',
  p5_fin_fuel_go_opts: 'Opcje › Opłata paliwowa',
  /* E39 — tabela tygodni */
  p5_fuel_h: 'Opłata paliwowa według tygodnia załadunku',
  p5_fuel_sub: 'tydzień = poniedziałek–niedziela · opłata obowiązuje w tygodniu załadunku · wskaźniki z tygodnia poprzedniego · niższy z dwóch mnożników · ta sama po stronie kosztu i przychodu',
  p5_fuel_col_week: 'Tydzień załadunku (obowiązuje)',
  p5_fuel_col_idx: 'Wskaźniki z tygodnia',
  p5_fuel_col_okq8: 'OKQ8 GoEasy Diesel',
  p5_fuel_col_orlen: 'Orlen Ekodiesel',
  p5_fuel_col_applied: 'Stosowany',
  p5_fuel_col_state: 'Stan',
  p5_fuel_col_loads: 'Transporty',
  p5_fuel_state_OSTATECZNA: 'Ostateczna',
  p5_fuel_state_PROGNOZA: 'Prognoza',
  p5_fuel_state_BRAK: 'Bez ceny',
  p5_fuel_final_from: 'ostateczna od {date}',
  p5_fuel_final_later: 'do zamknięcia tygodnia przed załadunkiem',
  p5_fuel_no_date: 'bez daty załadunku',
  p5_fuel_idx_running: '{label} — trwa',
  p5_fuel_okq8: '{avg} SEK/l{publ} → ×{mult}',
  p5_fuel_orlen: '{avg} PLN/l{publ} → ×{mult}',
  p5_fuel_publ: ' ({n} publ.)',
  p5_fuel_lower: 'niższy',
  p5_fuel_foot:
    'Kliknięcie wiersza: lista transportów i publikacje cen. Data załadunku: rzeczywista (wyjazd ze strefy Śrem albo ręczny status przewoźnika z datą), a do tego czasu z planu KSH.',
  p5_fuel_loads_h: 'Transporty',
  p5_fuel_publ_h: 'Publikacje cen z tygodnia {label}',
  p5_fuel_publ_none: 'Lista publikacji — po podłączeniu danych z bazy.',
  p5_fuel_publ_row: '{date} · {source} · {price}',
  p5_fuel_empty: 'Brak transportów z opłatą paliwową.',
};

export function ft(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function ftp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = ft(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
