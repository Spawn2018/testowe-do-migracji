/**
 * BN9-c1 / decyzja 63b — „Wczytaj rozkład Vikinga z pliku” (Harmonogram › Rejsy, Administrator HHL).
 *
 * Kontrakt Edge `viking-schedule-import` i tabeli `viking_schedule_imports` z PR #690 (#685-b, migracja 0360,
 * `supabase/functions/viking-schedule-import/index.ts`, `_shared/ferry/vikingFileImport.ts`).
 * Typy poniżej MUSZĄ odpowiadać #690 — po jego scaleniu można je zastąpić reeksportem
 * `src/lib/ferry/vikingFileImport.ts` (na `main` przed #690 go nie ma, dlatego są tu lokalnie).
 *
 * Tu tylko czyste funkcje i dane demonstracyjne (bez klienta bazy — paczka demo, I-2).
 * Wywołanie serwera: `vikingImportApi.ts` (ładowany wyłącznie w buildzie z logowaniem).
 */
import type { Locale, SailingStatus } from '../types';
import { portByCode, routeEnds } from './ferryCatalog';
import { ferryRouteLabel, portName } from './portName';
import { sailingStatusLabel } from './sailings';
import { fmtDateTime, fmtTime, TZ_OPS } from './time';

/* ---------- kontrakt #690 ---------- */

/** Ciało żądania (POST). `from_ymd` RRRR-MM-DD; `days` serwer przycina do 30–90 (domyślnie 60). */
export interface VikingImportRequest {
  html: string;
  file_name: string;
  commit: boolean;
  from_ymd?: string;
  days?: number;
}

/** #690 `VikingFilePlanRow` — pozycja rejsu w planie podglądu. */
export interface VikingPlanRow {
  route: string;
  vessel: string;
  departureUtc: string;
  status?: string;
  reason?: string;
}

/** #690 `VikingFileApplyPlan`. */
export interface VikingImportPlan {
  to_insert: VikingPlanRow[];
  to_remove: VikingPlanRow[];
  to_take_over: VikingPlanRow[];
  risks: VikingPlanRow[];
  blocked: VikingPlanRow[];
}

/** Odpowiedź podglądu (`commit: false`). */
export interface VikingImportPreview extends VikingImportPlan {
  ok: true;
  preview: true;
  file_name: string;
  file_hash: string;
  sailing_count: number;
  from_at: string | null;
  to_at: string | null;
  horizon_days: number;
  inserted: number;
  updated: number;
  removed: number;
  taken_over: number;
  warnings: string[];
}

/** Odpowiedź zapisu (`commit: true`). */
export interface VikingImportCommit {
  ok: true;
  preview: false;
  import_id: string | null;
  file_name: string;
  file_hash: string;
  sailing_count: number;
  from_at: string | null;
  to_at: string | null;
  horizon_days: number;
  source_down_closed: boolean;
  inserted: number;
  updated: number;
  removed: number;
  taken_over: number;
  manual_kept: number;
  risks: number;
  warnings: string[];
}

/** Wiersz `viking_schedule_imports` (odczyt RLS `is_hhl()`). `stats` — jak `p_stats` w #690. */
export interface VikingImportHistoryRow {
  id: string;
  imported_at: string;
  file_name: string | null;
  sailing_count: number;
  from_at: string | null;
  to_at: string | null;
  stats: {
    inserted?: number;
    updated?: number;
    removed?: number;
    taken_over?: number;
    manual_kept?: number;
    risks?: number;
    horizon_days?: number;
    source_down_closed?: boolean;
    clean_threshold_passed?: boolean;
    interrupted?: boolean;
    warnings?: string[];
  } | null;
}

/** Wynik wywołania: dane albo kod HTTP (0 = brak połączenia) i komunikat serwera. */
export type VikingCall<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export interface VikingImportApi {
  run(req: VikingImportRequest & { commit: false }): Promise<VikingCall<VikingImportPreview>>;
  run(req: VikingImportRequest & { commit: true }): Promise<VikingCall<VikingImportCommit>>;
  /** `null` — historii nie dało się odczytać (np. baza przed migracją 0360). */
  history(limit: number): Promise<VikingImportHistoryRow[] | null>;
}

/* ---------- plik ---------- */

/** Limit jak w #690 (R1-B7): 3 MB. */
export const VIKING_IMPORT_MAX_BYTES = 3 * 1024 * 1024;
export const VIKING_IMPORT_DAYS = [30, 60, 90] as const;
export const VIKING_IMPORT_DEFAULT_DAYS = 60;
export const VIKING_HISTORY_LIMIT = 8;

/** Sprawdzenie pliku przed odczytem: rozszerzenie i rozmiar. `null` = w porządku. */
export function vikingFileError(f: { name: string; size: number } | null | undefined): string | null {
  if (!f) return 'Wybierz plik zapisanej strony (.html).';
  if (!/\.html?$/i.test(f.name.trim())) return 'To nie jest zapisana strona. Wybierz plik z rozszerzeniem .html albo .htm.';
  if (f.size <= 0) return 'Plik jest pusty. Zapisz stronę jeszcze raz.';
  if (f.size > VIKING_IMPORT_MAX_BYTES) return 'Plik jest za duży (najwięcej 3 MB). Zapisz stronę jako „Strona internetowa, tylko HTML”.';
  return null;
}

/** Ciało żądania po zamianie na tekst — serwer odrzuca ponad 3 MB (nagłówek Content-Length). */
export function vikingBodyTooLarge(req: VikingImportRequest): boolean {
  return new TextEncoder().encode(JSON.stringify(req)).length > VIKING_IMPORT_MAX_BYTES;
}

/** Komunikat po polsku dla błędu wywołania (kody z #690: 400, 401, 403, 413, 500; 0 = sieć). */
export function vikingImportErrorPl(status: number, error?: string | null): string {
  const e = String(error ?? '');
  if (status === 0) return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj jeszcze raz.';
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  if (status === 403) {
    return /2FA|Administrator/i.test(e)
      ? 'Import może wykonać tylko Administrator HHL z weryfikacją dwuetapową (2FA). Zaloguj się kodem z aplikacji.'
      : 'Brak uprawnień do importu rozkładu.';
  }
  if (status === 413) return 'Plik jest za duży (najwięcej 3 MB). Zapisz stronę jako „Strona internetowa, tylko HTML”.';
  if (status === 400) {
    if (/from_ymd|data/i.test(e)) return 'Nieprawidłowa data początku. Wybierz dzień z kalendarza.';
    if (/Pusty/i.test(e)) return 'Plik jest pusty. Zapisz stronę jeszcze raz.';
    return 'Serwer nie odczytał pliku. Zapisz stronę Viking Cargo jeszcze raz i wczytaj nowy plik.';
  }
  if (status === 500 && /przerwany/i.test(e)) return 'Import przerwany — rejsy nie zostały w pełni zapisane. Wpis jest w historii; spróbuj ponownie.';
  if (status === 500 && /histori/i.test(e)) return 'Rejsy zapisane, ale nie zapisano wpisu w historii importów. Zgłoś to w Stanie systemu.';
  return 'Nie udało się wykonać importu. Spróbuj ponownie za chwilę.';
}

/* ---------- widok planu ---------- */

const TZ_BY_COUNTRY: Record<string, string> = {
  PL: 'Europe/Warsaw', SE: 'Europe/Stockholm', EE: 'Europe/Tallinn', FI: 'Europe/Helsinki',
};

/** Strefa portu odjazdu trasy (Tallinn → Europe/Tallinn); trasa nieznana → czas PL. */
export function departureTz(route: string): string {
  const from = routeEnds(route)?.from;
  const country = from ? portByCode(from)?.country : undefined;
  return (country && TZ_BY_COUNTRY[country]) || TZ_OPS;
}

/** Odjazd: „06.11.2026, 10:30 (Tallinn)” i „09:30 PL” (konwencja D8: rozkład portu + czas operacyjny PL). */
export function departureCells(row: Pick<VikingPlanRow, 'route' | 'departureUtc'>, locale: Locale = 'pl'): { local: string; pl: string | null } {
  if (!row.departureUtc || !Number.isFinite(Date.parse(row.departureUtc))) return { local: '—', pl: null };
  const tz = departureTz(row.route);
  const from = routeEnds(row.route)?.from;
  const where = from ? ` (${portName(locale, from)})` : '';
  return {
    local: `${fmtDateTime(row.departureUtc, tz)}${where}`,
    pl: tz === TZ_OPS ? null : `${fmtTime(row.departureUtc, TZ_OPS)} PL`,
  };
}

export function routePl(route: string, locale: Locale = 'pl'): string {
  return route ? ferryRouteLabel(locale, route) || route : '—';
}

const SAILING_STATUSES = new Set<string>(['ZAPLANOWANY', 'OPOZNIONY', 'ODWOLANY', 'W_REJSIE', 'DOPLYNAL']);

function statusPl(s: string | undefined, locale: Locale): string {
  return s && SAILING_STATUSES.has(s) ? sailingStatusLabel(s as SailingStatus, locale).toLowerCase() : 'nietykalny';
}

export type PlanSection = keyof VikingImportPlan;

/** Opis pozycji planu po polsku (powód z #690: season, digitraffic, digitraffic_takeover, blocked:…, VIKING_FILE_…). */
export function planReasonPl(section: PlanSection, row: VikingPlanRow, locale: Locale = 'pl'): string {
  const r = row.reason ?? '';
  if (section === 'to_insert') return 'nowy rejs z pliku';
  if (section === 'to_take_over') return 'rejs z danych portu, ma transporty — zostaje, czasy z pliku';
  if (section === 'to_remove') {
    return r === 'digitraffic'
      ? 'rejs z danych portu bez transportów — zastąpiony rejsem z pliku'
      : 'nie ma go już w rozkładzie (zmiana sezonu), bez transportów';
  }
  if (section === 'blocked') return `w bazie jest rejs „${statusPl(row.status ?? r.replace(/^blocked:/, ''), locale)}” — nie zmieniamy`;
  if (r.startsWith('VIKING_FILE_INCOMPLETE')) return 'niepełny plik dla tej trasy (mniej niż połowa rejsów) — nic nie usuwamy';
  if (r.startsWith('VIKING_FILE_MISSING')) return 'rejs z transportami zniknął z rozkładu — zostaje, sprawa do sprawdzenia w Ryzykach';
  return 'sprawa do sprawdzenia w Ryzykach';
}

/** Ostrzeżenie serwera: chwile ISO → „06.11.2026, 10:30” (bez surowych znaczników czasu na ekranie, E21). */
export function warningPl(w: string): string {
  return String(w ?? '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})/g, (iso) => fmtDateTime(iso))
    .replace(/\bViking plik:\s*/g, '')
    .replace(/\bTLLA-HEL\b/g, routePl('TLLA-HEL'))
    .replace(/\bHELA-TLL\b/g, routePl('HELA-TLL'));
}

/** Zakres dat podglądu / wpisu historii: „06.11.2026–05.01.2027”. */
export function rangePl(fromAt: string | null | undefined, toAt: string | null | undefined): string {
  if (!fromAt && !toAt) return '—';
  const d = (iso: string | null | undefined) => (iso ? fmtDateTime(iso).split(', ')[0] : '—');
  return `${d(fromAt)}–${d(toAt)}`;
}

export interface HistoryView {
  id: string;
  when: string;
  file: string;
  range: string;
  count: number;
  added: number;
  removed: number;
  takenOver: number;
  risks: number;
  status: 'OK' | 'PRZERWANY';
  threshold: 'OK' | 'NIEPELNY' | null;
}

export function historyView(r: VikingImportHistoryRow): HistoryView {
  const s = r.stats ?? {};
  return {
    id: r.id,
    when: fmtDateTime(r.imported_at),
    file: r.file_name || '—',
    range: rangePl(r.from_at, r.to_at),
    count: r.sailing_count ?? 0,
    added: s.inserted ?? 0,
    removed: s.removed ?? 0,
    takenOver: s.taken_over ?? 0,
    risks: s.risks ?? 0,
    status: s.interrupted ? 'PRZERWANY' : 'OK',
    threshold: s.clean_threshold_passed == null ? null : s.clean_threshold_passed ? 'OK' : 'NIEPELNY',
  };
}

/** Dzień „dziś” w strefie PL jako RRRR-MM-DD (domyślny początek zakresu). */
export function todayYmd(nowIso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(nowIso));
  return p;
}

/* ---------- demo (bez bazy) ---------- */

const at = (ymd: string, dayOffset: number, utcHm: string): string => {
  const d = new Date(`${ymd}T${utcHm}:00Z`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().replace('.000Z', 'Z');
};

/**
 * Wynik przykładowy (demo): wymyślone rejsy na trasach Tallinn A ⇄ Helsinki, bez danych osobowych (G-09).
 * W demo plik nie jest porównywany z bazą — ekran pokazuje, jak wygląda podgląd.
 */
export function demoVikingPreview(req: VikingImportRequest): VikingImportPreview {
  const ymd = req.from_ymd && /^\d{4}-\d{2}-\d{2}$/.test(req.from_ymd) ? req.from_ymd : '2026-09-23';
  const days = req.days ?? VIKING_IMPORT_DEFAULT_DAYS;
  const ins: VikingPlanRow[] = [
    { route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: at(ymd, 1, '04:00') },
    { route: 'HELA-TLL', vessel: 'Viking XPRS', departureUtc: at(ymd, 1, '07:30') },
    { route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: at(ymd, 1, '14:00') },
    { route: 'HELA-TLL', vessel: 'Viking XPRS', departureUtc: at(ymd, 1, '17:30') },
    { route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: at(ymd, 2, '04:00') },
  ];
  const plan: VikingImportPlan = {
    to_insert: ins,
    to_remove: [{ route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: at(ymd, 3, '19:15'), status: 'ZAPLANOWANY', reason: 'season' }],
    to_take_over: [{ route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: at(ymd, 2, '14:00'), status: 'ZAPLANOWANY', reason: 'digitraffic_takeover' }],
    risks: [],
    blocked: [{ route: 'HELA-TLL', vessel: 'Viking XPRS', departureUtc: at(ymd, 2, '07:30'), status: 'ODWOLANY', reason: 'blocked:ODWOLANY' }],
  };
  return {
    ok: true,
    preview: true,
    file_name: req.file_name,
    file_hash: 'demo',
    sailing_count: 112,
    from_at: at(ymd, 0, '04:00'),
    to_at: at(ymd, Math.max(days - 1, 0), '17:30'),
    horizon_days: days,
    ...plan,
    inserted: plan.to_insert.length,
    updated: plan.to_take_over.length,
    removed: plan.to_remove.length,
    taken_over: plan.to_take_over.length,
    warnings: [],
  };
}

export const DEMO_VIKING_HISTORY: VikingImportHistoryRow[] = [
  {
    id: 'demo-2', imported_at: '2026-09-01T08:12:00Z', file_name: 'viking-cargo-wrzesien.html', sailing_count: 118,
    from_at: '2026-09-01T04:00:00Z', to_at: '2026-10-30T17:30:00Z',
    stats: { inserted: 6, removed: 2, taken_over: 1, risks: 0, clean_threshold_passed: true, interrupted: false },
  },
  {
    id: 'demo-1', imported_at: '2026-08-03T07:40:00Z', file_name: 'viking-cargo-sierpien.html', sailing_count: 41,
    from_at: '2026-08-03T04:00:00Z', to_at: '2026-10-01T17:30:00Z',
    stats: { inserted: 0, removed: 0, taken_over: 0, risks: 1, clean_threshold_passed: false, interrupted: false },
  },
];

/** Demo: podgląd z przykładu, historia przykładowa; zapis niedostępny (przycisk nieaktywny w ekranie). */
export const demoVikingImportApi: VikingImportApi = {
  async run(req: VikingImportRequest) {
    if (req.commit) return { ok: false, status: 403, error: 'demo' };
    return { ok: true, data: demoVikingPreview(req) };
  },
  async history() {
    return DEMO_VIKING_HISTORY;
  },
} as VikingImportApi;
