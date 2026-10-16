/**
 * wyglad/P9-a — teksty komunikatu zamiast szarej mapy (E24-1, makieta `raport/img/e24-after`,
 * `makiety_html/E24`). Interfejs po polsku (E43).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p9a_title: 'Nie udało się wczytać podkładu mapy',
  p9a_title_short: 'Nie udało się wczytać podkładu',
  p9a_body: 'Pozycje i trasa są aktualne. Brakuje tylko tła z ulicami.',
  p9a_body_short: 'Pozycje i trasa są aktualne.',
  p9a_body_chunk: 'Pozycje i trasa są aktualne. Aplikacja ma nową wersję — odśwież stronę, żeby wczytać podkład.',
  p9a_retry: 'Spróbuj ponownie',
  p9a_retrying: 'Wczytuję podkład…',
  p9a_reload: 'Odśwież stronę',
  p9a_tried: 'Próbowano {n} razy: {via}.',
  p9a_via_here_both: 'HERE wprost i przez serwer aplikacji',
  p9a_via_here_proxy: 'HERE przez serwer aplikacji',
  p9a_via_fallback: 'podkład zapasowy bez HERE',
  p9a_via_chunk: 'plik aplikacji z podkładem się nie pobrał',
  p9a_reported: 'Zgłoszenie zapisane dla HHL.',
};

export function p9(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function p9p(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = p9(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
