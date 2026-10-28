/**
 * wyglad/W-decyzja-przewoznik (#590/#592): decyzje importu KSH, które mają własne funkcje bazy.
 *
 * „Zmiana przewoźnika w pliku” (KSH_CARRIER_CHANGED) — Anuluj / Usuń z harmonogramu / Odłóż 2 h — rozstrzyga
 * `decision_resolve_carrier_change(p_decision, p_action)`: tylko ona zmienia transport. Ogólne `decision_resolve`
 * zamknęłoby decyzję bez skutku w harmonogramie, więc ekran nigdy go tu nie woła.
 *
 * „Usunięty transport wrócił w pliku” (KSH_REMOVED_BACK) — „Przywrócę” woła `load_restore_removed(p_load)`
 * (tylko administrator HHL; funkcja sama zamyka decyzję), „Zostaw usunięty” — zwykłe `decision_resolve`.
 */

import { calibErrCode } from './etaCalibAuto';

export type DecisionRpc =
  | { fn: 'decision_resolve_carrier_change'; args: { p_decision: string; p_action: string } }
  | { fn: 'load_restore_removed'; args: { p_load: string } }
  | { fn: 'decision_resolve'; args: Record<string, unknown> };

export const CARRIER_CHANGED = 'KSH_CARRIER_CHANGED';
export const REMOVED_BACK = 'KSH_REMOVED_BACK';

const CARRIER_ACTIONS = new Set(['CANCEL', 'REMOVE', 'SNOOZE_2H']);

export function decisionRpc(
  d: { id: string; typeCode: string; loadId: string | null },
  option: string,
  note: string | null,
  payload?: Record<string, unknown> | null,
): DecisionRpc | { error: 'unknown_option' | 'no_load' } {
  if (d.typeCode === CARRIER_CHANGED) {
    /* nieznana opcja nie może spaść do ogólnego rozstrzygnięcia — to zamknęłoby sprawę bez skutku */
    if (!CARRIER_ACTIONS.has(option)) return { error: 'unknown_option' };
    return { fn: 'decision_resolve_carrier_change', args: { p_decision: d.id, p_action: option } };
  }
  if (d.typeCode === REMOVED_BACK && option === 'WILL_RESTORE') {
    if (!d.loadId) return { error: 'no_load' };
    return { fn: 'load_restore_removed', args: { p_load: d.loadId } };
  }
  const args: Record<string, unknown> = { p_decision: d.id, p_option: option, p_note: note };
  if (payload != null) args.p_payload = payload;
  return { fn: 'decision_resolve', args };
}

/** Klucz ostrzeżenia (słownik decyzji), gdy opcja wymaga potwierdzenia na stronie; `null` — bez potwierdzenia. */
export function confirmKeyOf(typeCode: string, option: string): string | null {
  if (typeCode === CARRIER_CHANGED && option === 'CANCEL') return 'dec_confirm_CARRIER_CANCEL';
  if (typeCode === CARRIER_CHANGED && option === 'REMOVE') return 'dec_confirm_CARRIER_REMOVE';
  if (typeCode === REMOVED_BACK && option === 'WILL_RESTORE') return 'dec_confirm_REMOVED_RESTORE';
  return null;
}

/** Decyzja ma własną opcję „Odłóż 2 h” — ogólny przycisk odkładania byłby drugim takim samym. */
export function hasOwnSnooze(typeCode: string): boolean {
  return typeCode === CARRIER_CHANGED;
}

/** Odmowa uprawnień z bazy (42501 / „forbidden”) → zrozumiały komunikat zamiast angielskiego słowa. */
export function isForbidden(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42501' || /forbidden/i.test(e.message ?? '');
}

/** Opcja widoczna dla tej osoby: „Przywróć” tylko dla administratora HHL (funkcja bazy przepuszcza tylko tę rolę). */
export function optionVisible(typeCode: string, option: string, role: string | null | undefined): boolean {
  if (typeCode === REMOVED_BACK && option === 'WILL_RESTORE') return role === 'HHL_ADMIN';
  return true;
}

/** Komentarz z karty nie trafia do funkcji zmiany przewoźnika — pole komentarza ukryte, żeby nie obiecywać zapisu. */
export function takesNote(typeCode: string): boolean {
  return typeCode !== CARRIER_CHANGED;
}

/**
 * W-604: błędy kalibracji ETA (0320) przy rozstrzyganiu `ETA_CALIBRATION_APPROVAL` — wyzwalacz woła
 * `eta_apply_calibration_internal`, więc `decision_resolve` może zwrócić `ETA_APPLY_NEWER`, `ETA_CALIB_BUSY`, `ETA_FROZEN`,
 * `ETA_NOT_ADMIN`, „wersja cofnięta”… → klucz `dec_err_ETA_*`; `null` — to nie błąd kalibracji.
 */
export function etaDbErrorKey(e: { code?: string | null; message?: string | null } | null | undefined): string | null {
  const c = calibErrCode(e);
  return c ? `dec_err_ETA_${c}` : null;
}

/** Angielskie komunikaty funkcji bazy → klucz słownika decyzji; `null` — pokaż komunikat bazy bez zmian (np. polski 22023). */
export function dbErrorKey(e: { code?: string | null; message?: string | null }): string | null {
  /* przed 42501: ETA_NOT_ADMIN ma własne zdanie */
  const eta = etaDbErrorKey(e);
  if (eta) return eta;
  if (isForbidden(e)) return 'dec_err_forbidden';
  const m = (e.message ?? '').trim().toLowerCase();
  if (m === 'not found' || e.code === 'P0002') return 'dec_err_stale';
  if (m === 'wrong type') return 'dec_err_stale';
  return null;
}

/** Skutek w transporcie (anulowanie / usunięcie / przywrócenie) — po sukcesie trzeba odświeżyć harmonogram, nie tylko listę decyzji. */
export function changesLoads(call: DecisionRpc): boolean {
  return call.fn === 'load_restore_removed' || call.fn === 'decision_resolve_carrier_change';
}
