/**
 * wyglad/P10b-c — dane ekranu Opcje › System › Stan systemu: źródła danych (E23), błędy aplikacji (E47),
 * bezpieczeństwo (E19 pkt 7), wydajność (E46). Demo: przykłady z `sysDemo.ts` (G-09). Produkcja: `null`, dopóki
 * wykonawca nie podłączy danych (D-20261016-0845-01) — do tego czasu ekran pokazuje dzisiejszy panel stanu.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { demoAppErrors, demoOtherJobs, demoPerf, demoSecurity, demoSources } from './sysDemo';

/** E23 pkt 1–2: Działa, Częściowo, Brak pomiaru, Nie działa, Bez źródła. */
export type SourceState = 'ok' | 'partial' | 'nomeasure' | 'down' | 'nosource';

export type SourceRow = {
  id: string;
  /** Nazwa po polsku (E21), np. „Telematyka naczep”. */
  name: string;
  /** „emtrack · co 2 min” */
  cadence: string | null;
  /** Co zasila, np. „pozycje naczep na Mapie i w panelu”. */
  feeds: string;
  /** Czas ostatnich danych (ISO) albo opis, gdy źródeł jest kilka („3–12 min temu”). */
  lastAt: string | null;
  lastText?: string | null;
  state: SourceState;
  /** Od kiedy obecny stan (dla stanów wymagających uwagi). */
  since: string | null;
  /** Przyczyna i skutek zdaniem, bez kodów (E21). */
  why: string | null;
  /** „Sprawdź teraz” (E23 pkt 8) — uruchamia zadanie, wynik w wierszu. */
  canCheck: boolean;
};

export type OtherJob = { id: string; name: string; lastAt: string | null; state: SourceState };

export type CheckResult = { at: string; state: SourceState; text: string | null };

/** E47: nowy, powrócił (po naprawie wystąpił znowu), obserwacja, ustąpił po naprawie, przyczyna znana. */
export type ErrorState = 'new' | 'back' | 'watch' | 'fixed' | 'known';
export type ErrorGroup = {
  id: string;
  /** Treść błędu (grupowanie po treści, E47). */
  message: string;
  /** Strona, na której występuje najczęściej. */
  where: string;
  people: number;
  count: number;
  builds: number;
  firstAt: string;
  lastAt: string;
  state: ErrorState;
  /** Przy „known”: przyczyna znana, np. „E22: pasek »Jest nowa wersja«”. */
  stateNote?: string | null;
  /** Szczegóły po kliknięciu: stos (fragment), strony, role — bez danych osobowych. */
  stack?: string | null;
  pages?: string[];
  roles?: string[];
};
export type AppErrors = {
  groups: ErrorGroup[];
  /** Wystąpienia w 7 dni. */
  total7d: number;
  /** Od kiedy liczone „nowe” (ostatnie wdrożenie). */
  newSince: string | null;
  newCount: number;
};

export type SecState = 'ok' | 'warn' | 'bad';
export type SecRow = { id: 'advisor' | 'anon' | 'test' | 'mfa' | 'passwords'; what: string; state: SecState; value: string; details: string };

export type PerfRow = { id: string; what: string; how: string; result: string; limit: string; ok: boolean | null };
export type Perf = { at: string | null; rows: PerfRow[] };

export function sourceHealth(nowIso: string): SourceRow[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoSources(nowIso);
  return null;
}

export function otherJobs(nowIso: string): OtherJob[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoOtherJobs(nowIso);
  return null;
}

/** „Sprawdź teraz”: produkcja — `null` (przycisk niedostępny), dopóki wykonawca nie podłączy uruchomienia zadania. */
export function checkSource(id: string, nowIso: string): Promise<CheckResult> | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    const row = demoSources(nowIso).find((r) => r.id === id);
    return new Promise((res) => { setTimeout(() => res({ at: nowIso, state: row?.state ?? 'ok', text: null }), 500); });
  }
  return null;
}

export function appErrors(nowIso: string): AppErrors | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoAppErrors(nowIso);
  return null;
}

export function securityRows(nowIso: string): SecRow[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoSecurity(nowIso);
  return null;
}

export function perfResults(nowIso: string): Perf | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoPerf(nowIso);
  return null;
}

/** E23 pkt 3: progi „Nie działa” (zmienia Administrator HHL). */
export type SourceThreshold = { key: string; value: number; unit: string };

export function sourceThresholds(): SourceThreshold[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return [
      { key: 'SRC_TELEMATICS_MIN', value: 10, unit: 'min' },
      { key: 'SRC_FERRY_POS_MIN', value: 15, unit: 'min' },
      { key: 'SRC_FERRY_STATUS_MIN', value: 30, unit: 'min' },
      { key: 'SRC_ROAD_SE_MIN', value: 45, unit: 'min' },
      { key: 'SRC_WEATHER_H', value: 3, unit: 'h' },
      { key: 'SRC_FUEL_H', value: 26, unit: 'h' },
      { key: 'SRC_SCHEDULE_D', value: 8, unit: 'dni' },
    ];
  }
  return null;
}

/** Zapis progu: produkcja — `null` (tylko podgląd), dopóki wykonawca nie podłączy zapisu z wpisem w Historii zmian. */
export function saveSourceThreshold(key: string, value: number): Promise<boolean> | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return Promise.resolve(Number.isFinite(value) && value > 0 && !!key);
  return null;
}

/** Czy „Sprawdź teraz” i zapis progów są podłączone (demo — tak; produkcja — po podłączeniu przez wykonawcę). */
export function sysActionsReady(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}
