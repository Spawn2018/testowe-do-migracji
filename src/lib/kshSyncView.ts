/**
 * wyglad/P7-e — stan synchronizacji pliku KSH na SharePoint (W13, D-20261016-1230-01 pkt 5.5–5.6; zasady 15 i 16).
 * Obliczenie widoku na polu `kshSharePointSync`, które daje wykonawca (POSTEP.md: `lastReadAt`, `lastWriteAt`,
 * `writeEnabled`, `sourceOk`, `secretExpiresOn`, `lastRun`). Bez pola (dziś: demo i produkcja przed podłączeniem) —
 * `null`, a ekran zostaje przy linii „Plik KSH: wersja … z …” (B-09).
 * Daty zawsze DD.MM.RRRR, godzina GG:MM (właściciel 16.10, 13:58).
 * Kontrakt (D-20261016-1845-01 pkt 3.1, uzupełnienie wyglad/P7-e2): `sourceOk = false` = ostatnia próba odczytu
 * nieudana; „Nie działa” liczy widok z wieku `lastReadAt` (> 30 min) — ta sama reguła co alarm `SOURCE_DOWN`.
 */
import { fmtDate, fmtDateTime, TZ_OPS, zoneOffsetIso } from './time';
import type { SourceRow } from './sysSource';

export interface KshSyncRun {
  created: number;
  changed: number;
  skipped: number;
  ntg: number;
  cases: number;
}

export interface KshSharePointSync {
  lastReadAt: string | null;
  lastWriteAt: string | null;
  writeEnabled: boolean;
  sourceOk: boolean;
  /** Data ważności sekretu aplikacji (ustawienie, nie sekret) — RRRR-MM-DD. */
  secretExpiresOn: string | null;
  lastRun?: KshSyncRun | null;
}

/** Odczyt pola z magazynu bez zależności od jego typu (pole dodaje wykonawca). */
export function kshSyncOf(state: unknown): KshSharePointSync | null {
  const v = (state as { kshSharePointSync?: KshSharePointSync | null } | null)?.kshSharePointSync;
  return v && typeof v === 'object' ? v : null;
}

export type KshSyncTone = 'ok' | 'down';

/** Zasada 15: „Nie działa” po 30 min bez udanego odczytu. */
export const KSH_SYNC_DOWN_MIN = 30;
/** Zasada 16: ostrzeżenie o sekrecie 30 dni przed datą ważności. */
export const KSH_SECRET_WARN_DAYS = 30;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Chwila ostatniego udanego odczytu albo null (brak albo nieczytelna data). */
function readAtMs(s: KshSharePointSync): number | null {
  if (!s.lastReadAt) return null;
  const t = Date.parse(s.lastReadAt);
  return Number.isFinite(t) ? t : null;
}

/**
 * Przyczyna stanu (wyglad/P7-e2, F7):
 * - `never` — nie było udanego odczytu;
 * - `age` — ostatni udany odczyt starszy niż 30 min (zasada 15, „Nie działa”);
 * - `retry` — ostatnia próba nieudana, ale udany odczyt w ciągu 30 min (jeszcze bez alarmu);
 * - `ok`.
 */
export type KshSyncReason = 'ok' | 'retry' | 'age' | 'never';

export function kshSyncReason(s: KshSharePointSync, nowIso: string): KshSyncReason {
  const at = readAtMs(s);
  if (at == null) return 'never';
  if (Date.parse(nowIso) - at > KSH_SYNC_DOWN_MIN * MIN) return 'age';
  return s.sourceOk ? 'ok' : 'retry';
}

export function kshSyncTone(s: KshSharePointSync, nowIso: string): KshSyncTone {
  const r = kshSyncReason(s, nowIso);
  return r === 'age' || r === 'never' ? 'down' : 'ok';
}

/** „Ostatni przebieg: nowe 2 · zmienione 5 · pominięte 1 · NTG 40 · sprawy 1”. */
export function kshRunText(run: KshSyncRun | null | undefined): string | null {
  if (!run) return null;
  return `Ostatni przebieg: nowe ${run.created} · zmienione ${run.changed} · pominięte ${run.skipped} · NTG ${run.ntg} · sprawy ${run.cases}`;
}

/** Koniec dnia ważności sekretu (23:59:59 czasu polskiego, zima i lato) albo null. */
function secretEndMs(s: KshSharePointSync): number | null {
  if (!s.secretExpiresOn) return null;
  const day = s.secretExpiresOn.slice(0, 10);
  const noon = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(noon.getTime())) return null;
  const end = Date.parse(`${day}T23:59:59${zoneOffsetIso(noon, TZ_OPS)}`);
  return Number.isFinite(end) ? end : null;
}

/** Dni do wygaśnięcia sekretu (całe dni, może być ujemne) albo null. */
export function kshSecretDaysLeft(s: KshSharePointSync, nowIso: string): number | null {
  const end = secretEndMs(s);
  return end == null ? null : Math.floor((end - Date.parse(nowIso)) / DAY);
}

/** „(dziś)”, „(za 1 dzień)”, „(za 14 dni)”. */
function inDays(days: number): string {
  if (days === 0) return 'dziś';
  return `za ${days} ${days === 1 ? 'dzień' : 'dni'}`;
}

export interface KshSyncLine {
  text: string;
  tone: KshSyncTone;
  /** Podpowiedź: ostatni przebieg, stan zapisu. */
  title: string;
}

/**
 * Linia nad Harmonogramem (zasada 15): „Plik KSH (SharePoint): zsynchronizowano 16.10.2026, 08:05”.
 * Brak odczytu ponad 30 min albo źródło nie działa: „Plik KSH (SharePoint): nie działa — ostatni odczyt …”.
 */
export function kshSyncLine(s: KshSharePointSync, nowIso: string): KshSyncLine {
  const reason = kshSyncReason(s, nowIso);
  const tone = kshSyncTone(s, nowIso);
  const last = readAtMs(s) != null && s.lastReadAt ? fmtDateTime(s.lastReadAt) : null;
  const text = reason === 'never'
    ? 'Plik KSH (SharePoint): nie działa — brak odczytu'
    : reason === 'age'
      ? `Plik KSH (SharePoint): nie działa — ostatni odczyt ${last}`
      : `Plik KSH (SharePoint): zsynchronizowano ${last}`;
  const retry = reason === 'retry' ? 'Ostatnia próba odczytu nieudana — następna za kilka minut' : null;
  const write = s.writeEnabled
    ? (s.lastWriteAt ? `Zapis do pliku: ostatni ${fmtDateTime(s.lastWriteAt)}` : 'Zapis do pliku: włączony')
    : 'Zapis do pliku wyłączony — dostęp tylko do odczytu';
  const title = [retry, kshRunText(s.lastRun), write].filter(Boolean).join('\n');
  return { text, tone, title };
}

/** Wiersz w Opcjach › System › Stan systemu (zasady 15 i 16). */
export function kshSyncSourceRow(s: KshSharePointSync, nowIso: string): SourceRow {
  const reason = kshSyncReason(s, nowIso);
  const at = readAtMs(s);
  const why: string[] = [];
  if (reason === 'age') why.push(`Brak udanego odczytu pliku od ponad ${KSH_SYNC_DOWN_MIN} min — alarm do Administratorów HHL.`);
  if (reason === 'never') why.push('Plik nie został jeszcze odczytany — sprawdź dostęp aplikacji do pliku i sekret.');
  if (reason === 'retry') why.push(`Ostatnia próba odczytu nieudana. Ostatni udany odczyt ${fmtDateTime(s.lastReadAt)}; po ${KSH_SYNC_DOWN_MIN} min bez odczytu — alarm do Administratorów HHL.`);
  if (!s.writeEnabled) why.push('Zapis do pliku wyłączony: dostęp tylko do odczytu. Włączy się po pliku testowym od działu IT KSH i zgodzie właściciela.');
  const days = kshSecretDaysLeft(s, nowIso);
  const expired = days != null && days < 0;
  if (days != null && days <= KSH_SECRET_WARN_DAYS && s.secretExpiresOn) {
    why.push(expired
      ? `Sekret aplikacji wygasł ${fmtDate(s.secretExpiresOn)} — odczyt pliku nie działa, wymień sekret.`
      : `Sekret aplikacji wygasa ${fmtDate(s.secretExpiresOn)} (${inDays(days)}) — wymień go przed tym dniem.`);
  }
  const run = kshRunText(s.lastRun);
  if (run && reason === 'ok') why.push(`${run}.`);
  const down = reason === 'age' || reason === 'never' || expired;
  const warn = reason === 'retry' || (days != null && days <= KSH_SECRET_WARN_DAYS);
  /* „od kiedy obecny stan” (E23): „Nie działa” zaczyna się 30 min po ostatnim udanym odczycie, a przy wygasłym sekrecie — po końcu dnia ważności */
  const end = expired ? secretEndMs(s) : null;
  const since = reason === 'age' && at != null
    ? new Date(at + KSH_SYNC_DOWN_MIN * MIN).toISOString()
    : end != null ? new Date(end + 1000).toISOString() : null;
  return {
    id: 'ksh-sharepoint',
    name: 'Plik KSH (SharePoint)',
    cadence: 'co 5 min',
    feeds: 'Harmonogram: transporty HHL z pliku KSH; wiersze NTG pomijane',
    lastAt: at != null ? s.lastReadAt : null,
    state: down ? 'down' : warn ? 'partial' : 'ok',
    since,
    why: why.length ? why.join(' ') : null,
    canCheck: true,
  };
}
