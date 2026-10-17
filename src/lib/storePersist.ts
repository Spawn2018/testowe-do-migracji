/**
 * D22 — persisted Zustand store schema versioning + migration.
 *
 * Storage key kept as `watch-tower-ui-v6-ready-gate` so existing browsers migrate
 * in place (zustand `version` field, default was 0 → now STORE_SCHEMA_VERSION).
 *
 * Prefer migrate-over-wipe. Wipe only for corrupt / unreadable / future-incompatible
 * payloads; then flag a Polish toast via sessionStorage (consumed after rehydrate).
 */

import type { Invoice, Load } from '../types';
import { attachMoneyV2 } from './money/loadMoney';
import { localDateOf } from './money/engine';
import { getNowIso } from './frozenNow';

function todayLocalForMigration(): string {
  try { return localDateOf(getNowIso()); } catch { return new Date().toISOString().slice(0, 10); }
}

export const STORE_PERSIST_KEY = 'watch-tower-ui-v6-ready-gate';

/** Bump when persisted shape breaks backward compatibility. v3 (audyt 17.10): domyślna waluta widoku EUR.
 *  v4 (audyt 17.10, N6, F7): dane demo zgodne z dniem demo — zapisane w przeglądarce stare dane startowe odrzucone. */
export const STORE_SCHEMA_VERSION = 4;

/**
 * v3 → v4: wycinki danych startowych demo (transporty, zdarzenia, sprawy, faktury, czat…). Zapisane przed wyglad/W-demo
 * miały załadunki w październiku i brak ETA — po migracji wracają dane startowe; zostaje konto i wygląd
 * (rola, motyw, ustawienia powiadomień, oferta faktoringu). W trybie Supabase tych wycinków się nie zapisuje.
 */
const SEED_DATA_KEYS_V4: readonly StorePersistFieldKey[] = [
  'loads', 'events', 'documents', 'messages', 'notifications', 'invoices', 'bills', 'sailings', 'geofences',
  'workflows', 'workflowRuns', 'scheduleVersions', 'rateCost', 'rateRev', 'baf', 'risks', 'exceptions',
];

/** sessionStorage flag → toast after rehydrate (baseline/visual clear this). */
export const STORE_WIPE_FLAG_KEY = 'wt-persist-wipe-notice';

export const STORE_WIPE_MESSAGE_PL =
  'Zapisany stan aplikacji był uszkodzony lub niekompatybilny. Przywrócono dane startowe.';

/** Fields written by persist `partialize` — keep in sync with useTowerStore. */
export const STORE_PERSIST_FIELD_KEYS = [
  'role',
  'locale',
  'theme',
  'themeManual',
  'factoringOffer',
  'loads',
  'events',
  'documents',
  'messages',
  'notifications',
  'notificationPrefs',
  'invoices',
  'bills',
  'sailings',
  'geofences',
  'workflows',
  'workflowRuns',
  'scheduleVersions',
  'rateCost',
  'rateRev',
  'baf',
  'risks',
  'exceptions',
] as const;

export type StorePersistFieldKey = (typeof STORE_PERSIST_FIELD_KEYS)[number];

export type TowerPersistSlice = Partial<Record<StorePersistFieldKey, unknown>>;

const ARRAY_FIELDS: StorePersistFieldKey[] = [
  'loads',
  'events',
  'documents',
  'messages',
  'notifications',
  'invoices',
  'bills',
  'sailings',
  'geofences',
  'workflows',
  'workflowRuns',
  'scheduleVersions',
  'rateCost',
  'rateRev',
  'risks',
  'exceptions',
];

const ROLES = new Set(['HHL', 'KSH', 'SCX']);
const LOCALES = new Set(['pl', 'en', 'sv']);
const THEMES = new Set(['light', 'dark']);

export function flagPersistWipe(): void {
  try {
    sessionStorage.setItem(STORE_WIPE_FLAG_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Returns true once if a wipe was flagged (and clears the flag). */
export function consumePersistWipeNotice(): boolean {
  try {
    const v = sessionStorage.getItem(STORE_WIPE_FLAG_KEY);
    if (!v) return false;
    sessionStorage.removeItem(STORE_WIPE_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

export function pickPersistSlice(raw: Record<string, unknown>): TowerPersistSlice {
  const out: TowerPersistSlice = {};
  for (const k of STORE_PERSIST_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      out[k] = raw[k];
    }
  }
  return out;
}

/**
 * True when persisted payload cannot be safely merged (wrong types / junk root).
 * Missing optional fields are OK — shallow merge keeps seed defaults.
 */
export function isCorruptPersistSlice(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return true;
  const o = raw as Record<string, unknown>;

  for (const k of ARRAY_FIELDS) {
    if (k in o && o[k] != null && !Array.isArray(o[k])) return true;
  }
  if ('role' in o && o.role != null && !ROLES.has(String(o.role))) return true;
  if ('locale' in o && o.locale != null && !LOCALES.has(String(o.locale))) return true;
  if ('theme' in o && o.theme != null && !THEMES.has(String(o.theme))) return true;
  if ('themeManual' in o && o.themeManual != null && typeof o.themeManual !== 'boolean') {
    return true;
  }
  if (
    'notificationPrefs' in o &&
    o.notificationPrefs != null &&
    (typeof o.notificationPrefs !== 'object' || Array.isArray(o.notificationPrefs))
  ) {
    return true;
  }
  if (
    'factoringOffer' in o &&
    o.factoringOffer != null &&
    (typeof o.factoringOffer !== 'object' || Array.isArray(o.factoringOffer))
  ) {
    return true;
  }
  if ('baf' in o && o.baf != null && (typeof o.baf !== 'object' || Array.isArray(o.baf))) {
    return true;
  }
  return false;
}

export type MigrateTowerResult = {
  /** Slice to shallow-merge; `{}` = keep in-memory seed (wipe path). */
  state: TowerPersistSlice;
  wiped: boolean;
  reason?: 'corrupt' | 'unsupported-future';
};

/**
 * Pure migrator used by zustand `persist.migrate` and unit tests.
 * `fromVersion` is the version read from storage (legacy installs = 0).
 */
export function migrateTowerPersist(
  persistedState: unknown,
  fromVersion: number,
): MigrateTowerResult {
  if (fromVersion > STORE_SCHEMA_VERSION) {
    flagPersistWipe();
    return { state: {}, wiped: true, reason: 'unsupported-future' };
  }

  if (isCorruptPersistSlice(persistedState)) {
    flagPersistWipe();
    return { state: {}, wiped: true, reason: 'corrupt' };
  }

  const picked = pickPersistSlice(persistedState as Record<string, unknown>);

  // v0 (unversioned / zustand default) → v1: keep useful fields as-is.
  // v1 → v2 (M2): transporty dostają dane v2 pieniędzy (poziom, obie wartości,
  // migawki mnożnika i kursu) — wyliczone z zapisanych składników, bez utraty danych.
  if (fromVersion < 2 && Array.isArray(picked.loads)) {
    const invoices = Array.isArray(picked.invoices) ? (picked.invoices as Invoice[]) : [];
    picked.loads = attachMoneyV2(picked.loads as Load[], invoices, todayLocalForMigration());
  }
  // v2 → v3 (audyt 17.10, D-20261017-0730-01 §4): domyślna waluta widoku EUR, jak w fakturach i cenniku (E16).
  // `displayCurrency` nie należy do STORE_PERSIST_FIELD_KEYS, więc przy migracji wraca wartość domyślna (EUR).
  // Zapisany w przeglądarce „PLN” był dotąd wartością domyślną, nie wyborem; wybór zapisany na koncie
  // (`user_preferences`) wraca przy logowaniu (`loadPreferences`).
  if (fromVersion < 4) {
    for (const k of SEED_DATA_KEYS_V4) delete picked[k];
  }
  if (fromVersion <= 0 || fromVersion < STORE_SCHEMA_VERSION) {
    return { state: picked, wiped: false };
  }

  return { state: picked, wiped: false };
}

/** Adapter for zustand `migrate` option (returns slice only). */
export function migrateTowerPersistForZustand(
  persistedState: unknown,
  fromVersion: number,
): TowerPersistSlice {
  return migrateTowerPersist(persistedState, fromVersion).state;
}

/**
 * Wrap JSON storage so a missing `version` is treated as 0 (forces migrate when
 * STORE_SCHEMA_VERSION > 0). Corrupt JSON → null (fresh seed) + wipe flag.
 */
export function createVersionedJSONStorage(): {
  getItem: (name: string) => { state: unknown; version: number } | null;
  setItem: (name: string, value: { state: unknown; version?: number }) => void;
  removeItem: (name: string) => void;
} {
  return {
    getItem(name) {
      try {
        const raw = localStorage.getItem(name);
        if (raw == null) return null;
        const parsed = JSON.parse(raw) as { state?: unknown; version?: number };
        if (parsed == null || typeof parsed !== 'object') {
          flagPersistWipe();
          return null;
        }
        const version = typeof parsed.version === 'number' ? parsed.version : 0;
        return { state: parsed.state, version };
      } catch {
        flagPersistWipe();
        return null;
      }
    },
    setItem(name, value) {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem(name) {
      localStorage.removeItem(name);
    },
  };
}
