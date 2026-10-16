/**
 * wyglad/P10b-b — teksty panelu Pomocy (E37 pkt 3, makieta `makiety_html/E37/pasek.html`). Interfejs po polsku (E43).
 * Treści „Jak pracuję” — `src/lib/helpContent.ts` (dosłownie z D-20261009-0015-01).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  help_title: 'Pomoc',
  help_close: 'Zamknij Pomoc',
  help_tab_how: 'Jak pracuję',
  help_tab_news: 'Co nowego',
  help_tab_contact: 'Kontakt',
  help_tab_keys: 'Skróty',
  help_tabs: 'Zakładki Pomocy',
  help_phone_h: 'Na telefonie',
  help_step_open: 'Otwórz: {place}',
  help_contact_role: 'Operacje HHL',
  help_call: 'Zadzwoń',
  help_contact_none: 'Brak konta Operacji HHL z telefonem.',
  help_news_none: 'Brak zmian do pokazania.',
  help_key_dash: 'Kokpit',
  help_key_map: 'Mapa',
  help_key_sched: 'Harmonogram',
  help_key_risk: 'Ryzyka',
  help_key_docs: 'Dokumenty',
  help_key_view: 'Zmień widok (Podgląd)',
  help_key_theme: 'Jasny / ciemny',
  help_key_esc: 'Zamknij panel, wyczyść filtr',
  help_key_help: 'Pomoc',
};

export function hp(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function hpp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = hp(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
