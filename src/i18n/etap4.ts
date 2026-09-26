/** Etap 4 — klucze interfejsu (PL źródłowo; EN; SV). */
import type { Locale } from '../types';

type Dict = Record<string, string>;

const pl: Dict = {
  nav_settings: 'Ustawienia',
  settings_subtitle: 'Twoje ustawienia: język, waluta wyświetlania i motyw. Zapisywane dla Twojego konta.',
  settings_prefs_sub: 'Twoje konto',
  sched_col_ord_ksh: 'Zlec. KSH',
  sched_col_ord_hhl: 'Zlec. HHL',
  sched_col_ord_scx: 'Zlec. SCX',
  settings_prefs_note: 'Waluta wyświetlania przelicza wszystkie kwoty (źródłem jest zawsze EUR). Kwoty na fakturach pokazywane są w walucie faktury.',
};
const en: Dict = {
  nav_settings: 'Settings',
  settings_subtitle: 'Your settings: language, display currency and theme. Saved for your account.',
  settings_prefs_sub: 'Your account',
  sched_col_ord_ksh: 'KSH order',
  sched_col_ord_hhl: 'HHL order',
  sched_col_ord_scx: 'SCX order',
  settings_prefs_note: 'Display currency converts all amounts (the source is always EUR). Invoice amounts are shown in the invoice currency.',
};
const sv: Dict = {
  nav_settings: 'Inställningar',
  settings_subtitle: 'Dina inställningar: språk, visningsvaluta och tema. Sparas för ditt konto.',
  settings_prefs_sub: 'Ditt konto',
  sched_col_ord_ksh: 'KSH-order',
  sched_col_ord_hhl: 'HHL-order',
  sched_col_ord_scx: 'SCX-order',
  settings_prefs_note: 'Visningsvalutan räknar om alla belopp (källan är alltid EUR). Fakturabelopp visas i fakturans valuta.',
};

export const ETAP4: Record<Locale, Dict> = { pl, en, sv };
