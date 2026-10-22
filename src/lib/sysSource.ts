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
  /** A8 (D-20261017-0730-01): kiedy następna próba po serii błędów (np. emtrack `skipped_until`); widok: „następna próba o 21:05”. */
  nextTryAt?: string | null;
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
export function checkSource(id: string, nowIso: string, fallback?: SourceState): Promise<CheckResult> | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    const row = demoSources(nowIso).find((r) => r.id === id);
    /* wyglad/P7-e2: źródło spoza danych demo (np. „Plik KSH (SharePoint)”) — wynik = stan wiersza, nie zawsze „Działa” */
    return new Promise((res) => { setTimeout(() => res({ at: nowIso, state: row?.state ?? fallback ?? 'ok', text: null }), 500); });
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

/**
 * E46 — co mierzymy i jakie są limity. Właściciel 22.10.2026, 01:13: na produkcji zakładka była pusta.
 * Dopóki baza nie zapisuje pomiarów (#422), produkcja pokazuje plan pomiarów z wynikiem „bez pomiaru”.
 */
export const PERF_PLAN: readonly Omit<PerfRow, 'result' | 'ok'>[] = [
  { id: 'p1', what: 'Kokpit · telefon', how: 'LCP · CLS · TBT', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms' },
  { id: 'p2', what: 'Mapa · telefon', how: 'LCP · CLS · TBT', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms' },
  { id: 'p3', what: 'Harmonogram w układzie pliku · komputer', how: 'LCP · CLS · TBT', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms' },
  { id: 'p4', what: 'Funkcje list w bazie', how: 'p95', limit: 'p95 ≤ 500 ms' },
  { id: 'p5', what: 'Równoczesność', how: '20 sesji przez 10 min', limit: '0 błędów' },
];

export function perfResults(nowIso: string): Perf | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoPerf(nowIso);
  return { at: null, rows: PERF_PLAN.map((r) => ({ ...r, result: '—', ok: null })) };
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
      /* wyglad/audyt-E (E-09; E49 Z5): „Wiatr — SMHI” — próg świeżości 2 h */
      { key: 'SRC_WIND_H', value: 2, unit: 'h' },
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
