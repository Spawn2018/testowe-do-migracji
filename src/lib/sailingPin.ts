/**
 * #557 cz. 2 (0307) — „Przypnij rejs” w karcie transportu.
 * Ostrzeżenie `rk_sailing_mismatch`: auto jest już w SE, a przypisany rejs jeszcze nie wypłynął.
 * Odczyt propozycji: `sailing_mismatch_suggest` (HHL). Przypięcie: `sailing_mismatch_assign` — tylko Administrator HHL
 * (baza sprawdza rolę i 2FA, odrzuca rejs odwołany i zły kierunek). Warunek `VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import type { Risk, Sailing } from '../types';
import { effDeparture, fmtLocal } from './sailings';

export const MISMATCH_KEY = 'rk_sailing_mismatch';

export type PinSuggest = {
  mismatch: boolean;
  assignedSailingId: string | null;
  proposedSailingId: string | null;
  proposedLabel: string | null;
};

/** Otwarte ostrzeżenie o złym rejsie dla tego transportu. */
export function hasOpenMismatch(risks: readonly Risk[], loadId: string): boolean {
  return risks.some((r) => r.loadId === loadId && r.titleKey === MISMATCH_KEY);
}

/** Przycisk widzi tylko Administrator HHL we własnym widoku (nie w podglądzie KSH/SCX). */
export function canPinSailing(opts: { admin: boolean; readOnly: boolean; mismatch: boolean }): boolean {
  return opts.admin && !opts.readOnly && opts.mismatch;
}

/** Odpowiedź RPC → propozycja (bez danych spoza kontraktu). */
export function suggestFromRpc(d: unknown): PinSuggest | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  if (o.ok !== true) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    mismatch: o.mismatch === true,
    assignedSailingId: str(o.assigned_sailing_id),
    proposedSailingId: str(o.proposed_sailing_id),
    proposedLabel: str(o.proposed_label),
  };
}

/**
 * Nazwa proponowanego rejsu: statek + odejście w czasie polskim (z rozkładu w aplikacji).
 * Gdy rejsu nie ma w pobranym rozkładzie — etykieta z bazy (podana w UTC, więc z dopiskiem).
 */
export function proposedText(s: PinSuggest, sailings: readonly Sailing[]): string | null {
  if (!s.proposedSailingId) return null;
  const hit = sailings.find((x) => x.id === s.proposedSailingId);
  if (hit) return `${hit.vessel} · ${fmtLocal(effDeparture(hit))}`;
  return s.proposedLabel ? `${s.proposedLabel.trim()} (godz. UTC)` : null;
}

/**
 * Komunikat błędu przypięcia po polsku. Znane odmowy bazy (0307) → zrozumiały tekst; reszta → ogólny
 * (bez surowego komunikatu bazy w karcie).
 */
export function pinErrorKey(raw: string | null): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('2fa') || m.includes('administrator')) return 'p7_pin_err_admin';
  if (m.includes('odwołany')) return 'p7_pin_err_cancelled';
  if (m.includes('trasa')) return 'p7_pin_err_route';
  return 'p7_pin_err';
}

export async function sailingMismatchSuggest(loadId: string): Promise<{ data: PinSuggest | null; error: string | null }> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return { data: null, error: null };
  const { getSupabase } = await import('../auth/client');
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('sailing_mismatch_suggest', { p_load_id: loadId });
  if (error) return { data: null, error: error.message };
  return { data: suggestFromRpc(data), error: null };
}

export async function sailingMismatchAssign(loadId: string, sailingId: string): Promise<{ ok: boolean; error: string | null }> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return { ok: false, error: null };
  const { getSupabase } = await import('../auth/client');
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('sailing_mismatch_assign', { p_load_id: loadId, p_sailing_id: sailingId });
  if (error) return { ok: false, error: error.message };
  const ok = !!data && typeof data === 'object' && (data as { ok?: unknown }).ok === true;
  return { ok, error: ok ? null : 'assign_failed' };
}
