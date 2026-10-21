/**
 * I-2 — ZERO FASADY. Zasada: każda funkcja widoczna w buildzie produkcyjnym (VITE_AUTH_MODE=supabase)
 * działa na danych z bazy albo jest ukryta / oznaczona „brak źródła danych”. Nigdy nie udaje.
 *
 * Jedno miejsce z listą funkcji ukrytych w produkcji (z powodem) — test `tests/i2-facade.test.ts`
 * pilnuje, że każdy klucz jest użyty w kodzie, a `tests/i2-facade.local.spec.ts` sprawdza build produkcyjny.
 * Tryb demo (lokalnie, podglądy Vercel) bez zmian.
 */
import { getAuthProfile, type AuthProfile } from '../auth/profile';
import { getPreviewViewRole } from './previewGate';

export const PROD_BUILD: boolean = import.meta.env.VITE_AUTH_MODE === 'supabase';

/** Funkcje ukryte w produkcji 1.0 — powód (do POSTEP/SCOPE i do testu). */
export const HIDDEN_IN_PROD = {
  seaWeather: 'Pogoda morska demo (statyczna voyageSea); produkcja = marine_conditions z II-8 (FMI+DMI+SMHI)',
  roadSituationsSe: 'Zdarzenia drogowe SE demo (8.5 seed): w produkcji panel czyta corridor_conditions + ROAD_SE z bazy (II-6 / road-se)',
  aisSeedPositions: 'Pozycje przykładowe promów na mapie (8.3): w produkcji tylko pozycje z bazy (vessel_positions, I-2j) z czasem sygnału albo „brak źródła danych”',
  delayCodes: 'Kody przyczyn opóźnień (8.10): nieuzgodnione z przewoźnikiem',
  detectTimeKpi: 'Kafelek „czas wykrycia odchylenia” (10.7): w demo wartość przykładowa „8 min”; w produkcji mediana z risk_signals (kpi_detection_lag, I-2l) albo „—”',
  factoringOffer: 'Oferta factoringu: zapis wyłącznie w przeglądarce, bez tabeli w bazie',
  demoMarksToggle: 'Przełącznik oznaczeń demonstracyjnych: w produkcji nie ma danych demonstracyjnych',
  clientEta: 'ETA liczona w przeglądarce ze statusu (M12): w produkcji ETA v1 z bazy (compute_load_eta)',
} as const;

export type FacadeKey = keyof typeof HIDDEN_IN_PROD;

/** `true` = funkcja widoczna (demo); w produkcji ukryta. */
export function shows(_key: FacadeKey, prod: boolean = PROD_BUILD): boolean {
  return !prod;
}

/**
 * 9.4 (28.09) — Automatyzacje na danych z bazy (silnik 0094): w produkcji widoczne wyłącznie dla HHL_ADMIN
 * (RLS `wf_all`); pozostałe role nie widzą modułu. Demo — bez zmian (dane demo).
 */
export function canSeeWorkflows(prod: boolean = PROD_BUILD, role: string | null | undefined = getAuthProfile()?.role): boolean {
  return !prod || role === 'HHL_ADMIN';
}

/**
 * B-5 (decyzja właściciela 05.10) — przycisk „Nowa automatyzacja”, edycja i usuwanie reguł: w produkcji wyłącznie
 * konto HHL_ADMIN (RLS `wf_all`). Demo: widok HHL.
 */
export function canManageWorkflows(prod: boolean = PROD_BUILD, role: string | null | undefined = getAuthProfile()?.role, demoRole?: string): boolean {
  return prod ? role === 'HHL_ADMIN' : demoRole === undefined || demoRole === 'HHL';
}

/**
 * I-2a / B5 (D-20261019-1525-01, właściciel 19.10.2026 15:14) — przełącznik „Widok HHL/KSH/SCX” (Podgląd innych
 * widoków) w produkcji wyłącznie dla roli HHL_ADMIN. HHL_OPS, KSH i przewoźnik nie widzą przełącznika — rola
 * widoku wynika z konta. Demo (bez logowania) — przełącznik jest sposobem prezentacji.
 */
export function canSwitchView(prod: boolean = PROD_BUILD, role: string | null | undefined = switchRoleOf()): boolean {
  return !prod || role === 'HHL_ADMIN';
}

/**
 * B5 (0249) — Podgląd w bazie: profil to konto oglądane (KSH Użytkownik / SCX Dyspozytor), a prawo przełączania
 * ma prawdziwy administrator (`real_role`). „Działaj jako” (zapis) przełącznika nie pokazuje.
 */
export function dbPreviewOn(p: AuthProfile | null = getAuthProfile()): boolean {
  return p?.acting_as === true && p.preview_ro === true;
}

export function switchRoleOf(p: AuthProfile | null = getAuthProfile()): string | null | undefined {
  return dbPreviewOn(p) ? p?.real_role : p?.role;
}

const OWN_VIEW: Record<string, string> = { HHL: 'HHL', KSH: 'KSH', SCX: 'SCX' };

/**
 * E9-7 / G-07 / B5 — „Podgląd bez zapisu” tylko w supabase: widok innej strony niż własna firma konta
 * (Administrator HHL ogląda KSH/SCX) — UI ukrywa i blokuje zapis; sesja bazy zostaje konta. Każdy widok inny niż
 * własny jest tylko do odczytu, także gdyby konto bez prawa Podglądu miało go zapamiętanego. Demo: pełne prawa.
 */
export function isPreviewReadOnly(opts?: {
  prod?: boolean;
  viewRole?: string | null;
  orgCode?: string | null;
  /** B5 (0249): Podgląd zapisany w bazie (`impersonation_state.read_only`). */
  dbPreview?: boolean;
}): boolean {
  const prod = opts?.prod ?? PROD_BUILD;
  if (prod && (opts?.dbPreview ?? dbPreviewOn())) return true;
  const viewRole = opts?.viewRole !== undefined ? opts.viewRole : getPreviewViewRole();
  const orgCode = opts?.orgCode !== undefined ? opts.orgCode : getAuthProfile()?.org_code;
  const own = orgCode ? OWN_VIEW[orgCode] : undefined;
  if (!prod || !viewRole || !own) return false;
  return viewRole !== own;
}
