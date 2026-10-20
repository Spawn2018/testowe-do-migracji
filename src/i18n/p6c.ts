/**
 * wyglad/P6-c — teksty zakładki „Status” według E17: źródło (IMPORT / RĘCZNIE / GPS / AIS), plan z różnicą,
 * kamienie milowe, rozliczenie z dokumentów i faktur, objaśnienie źródeł. Interfejs po polsku (E43).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p6c_tag_IMPORT: 'Import',
  p6c_tag_GPS: 'GPS',
  p6c_tag_AIS: 'AIS',
  /* A10 (D-20261019-1540-01 §3): pozostałe źródła automatu */
  p6c_tag_SCHEDULE: 'Rozkład',
  p6c_tag_DATA: 'Dane',
  p6c_tag_DOC: 'Dokumenty',
  p6c_tag_DRIVER: 'Kierowca',
  p6c_tag_INVOICE: 'Faktura',
  p6c_plan: 'plan {d}',
  p6c_plan_load: 'plan zał. {d}',
  p6c_plan_ok: 'w terminie',
  p6c_plan_late: '+{n} {days}',
  p6c_plan_early: '{n} {days} wcześniej',
  p6c_day_1: 'dzień',
  p6c_day_n: 'dni',
  p6c_ms_enter: 'wjazd w strefę „{zone}”',
  p6c_ms_exit: 'wyjazd ze strefy „{zone}”',
  p6c_ms_dwell: 'postój w strefie „{zone}” potwierdzony',
  p6c_rti_cmr_wait: 'Czeka na CMR z podpisem odbiorcy · zadanie u SCX',
  p6c_rti_cmr_ok: 'CMR z podpisem odbiorcy wgrany · można zmienić status',
  p6c_rti_cmr_ok_ro: 'CMR z podpisem odbiorcy wgrany',
  p6c_inv_both: 'Brakuje obu faktur: SCX → HHL · HHL → KSH',
  p6c_inv_one: 'Brakuje faktury {list}',
  p6c_inv_ok: 'Transport jest na obu fakturach · można zmienić status',
  p6c_inv_ok_ro: 'Transport jest na obu fakturach',
  p6c_inv_mine: 'Faktura dołączona: {list}',
  p6c_legend: 'GPS = lokalizator (emtrack, link RIO) · AIS = prom · Rozkład = rozkład promu · Dane = awizacja i zasoby · Dokumenty = zezwolenia, polisy, CMR · Kierowca = aplikacja kierowcy · Faktura = faktury · ręcznie = osoba.',
};

export function fs6(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function fs6p(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = fs6(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
