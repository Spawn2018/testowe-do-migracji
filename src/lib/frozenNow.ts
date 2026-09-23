/**
 * Clock freeze for reproducible screenshots (Etap C2.1).
 *
 * Without a freeze, Topbar ferry countdown + live clock (and NotificationBell
 * relative ages) change every second and make visual baselines non-reproducible.
 *
 * Sources (first wins):
 *   1) URL query `now` — HashRouter shape:
 *        http://host/#/?now=2026-09-23T14:32:00Z
 *        http://host/#/driver/x?now=2026-09-23T14:32:00Z
 *      also accepted before the hash:
 *        http://host/?now=2026-09-23T14:32:00Z#/
 *   2) Build/dev env: VITE_FROZEN_NOW=2026-09-23T14:32:00Z
 *
 * Usage:
 *   import { getNow, getNowMs, getNowIso, isFrozenNow } from './frozenNow';
 *   const now = getNow(); // Date — frozen or wall clock
 *
 * Call getNow() / getNowMs() / getNowIso() instead of `new Date()` / `Date.now()`
 * for UI clocks, ferry countdown, and relative times. Mutation timestamps in the
 * store may keep wall clock; seed data already uses fixed ISO strings.
 */

const DEFAULT_HINT = '2026-09-23T14:32:00Z';

let cachedMs: number | null | undefined;

function parseIsoToMs(raw: string | null | undefined): number | null {
  if (!raw || !String(raw).trim()) return null;
  const t = Date.parse(String(raw).trim());
  return Number.isFinite(t) ? t : null;
}

/** Read `now` from location.search and from the hash query (? after #). */
function readNowParamFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('now');
    if (fromSearch) return fromSearch;
    const hash = window.location.hash || '';
    const q = hash.indexOf('?');
    if (q >= 0) {
      const fromHash = new URLSearchParams(hash.slice(q + 1)).get('now');
      if (fromHash) return fromHash;
    }
  } catch {
    /* ignore malformed URL */
  }
  return null;
}

function resolveFrozenMs(): number | null {
  if (cachedMs !== undefined) return cachedMs;
  const fromUrl = parseIsoToMs(readNowParamFromUrl());
  if (fromUrl != null) {
    cachedMs = fromUrl;
    return cachedMs;
  }
  const envRaw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_FROZEN_NOW as string | undefined)
      : undefined;
  const fromEnv = parseIsoToMs(envRaw);
  cachedMs = fromEnv;
  return cachedMs;
}

/** True when URL or VITE_FROZEN_NOW supplied a valid ISO timestamp. */
export function isFrozenNow(): boolean {
  return resolveFrozenMs() != null;
}

/** Current instant as Date — frozen when configured, else wall clock. */
export function getNow(): Date {
  const ms = resolveFrozenMs();
  return ms != null ? new Date(ms) : new Date();
}

/** Current instant as epoch ms — frozen when configured, else Date.now(). */
export function getNowMs(): number {
  const ms = resolveFrozenMs();
  return ms != null ? ms : Date.now();
}

/** Current instant as ISO string — frozen when configured, else now. */
export function getNowIso(): string {
  return getNow().toISOString();
}

/**
 * Test/helper: clear memo so the next getNow() re-reads URL/env.
 * Not needed in production UI.
 */
export function resetFrozenNowCache(): void {
  cachedMs = undefined;
}

/** Documented default used by scripts/baseline.mjs (not applied automatically). */
export const BASELINE_FROZEN_NOW = DEFAULT_HINT;
