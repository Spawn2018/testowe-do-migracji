/**
 * wyglad/P7-e — stan synchronizacji pliku KSH na SharePoint (W13, D-20261016-1230-01 pkt 5.5–5.6; zasady 15 i 16).
 * Obliczenie widoku na polu `kshSharePointSync`, które daje wykonawca (POSTEP.md: `lastReadAt`, `lastWriteAt`,
 * `writeEnabled`, `sourceOk`, `secretExpiresOn`, `lastRun`). Bez pola (dziś: demo i produkcja przed podłączeniem) —
 * `null`, a ekran zostaje przy linii „Plik KSH: wersja … z …” (B-09).
 * Daty zawsze DD.MM.RRRR, godzina GG:MM (właściciel 16.10, 13:58).
 */
import { fmtDate, fmtDateTime } from './time';
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

export function kshSyncTone(s: KshSharePointSync, nowIso: string): KshSyncTone {
  if (!s.sourceOk || !s.lastReadAt) return 'down';
  return Date.parse(nowIso) - Date.parse(s.lastReadAt) > KSH_SYNC_DOWN_MIN * MIN ? 'down' : 'ok';
}

/** „Ostatni przebieg: nowe 2 · zmienione 5 · pominięte 1 · NTG 40 · sprawy 1”. */
export function kshRunText(run: KshSyncRun | null | undefined): string | null {
  if (!run) return null;
  return `Ostatni przebieg: nowe ${run.created} · zmienione ${run.changed} · pominięte ${run.skipped} · NTG ${run.ntg} · sprawy ${run.cases}`;
}

/** Dni do wygaśnięcia sekretu (całe dni, może być ujemne) albo null. */
export function kshSecretDaysLeft(s: KshSharePointSync, nowIso: string): number | null {
  if (!s.secretExpiresOn) return null;
  const end = Date.parse(`${s.secretExpiresOn.slice(0, 10)}T23:59:59+02:00`);
  if (!Number.isFinite(end)) return null;
  return Math.floor((end - Date.parse(nowIso)) / DAY);
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
  const tone = kshSyncTone(s, nowIso);
  const last = s.lastReadAt ? fmtDateTime(s.lastReadAt) : null;
  const text = tone === 'ok'
    ? `Plik KSH (SharePoint): zsynchronizowano ${last}`
    : last ? `Plik KSH (SharePoint): nie działa — ostatni odczyt ${last}` : 'Plik KSH (SharePoint): nie działa — brak odczytu';
  const write = s.writeEnabled
    ? (s.lastWriteAt ? `Zapis do pliku: ostatni ${fmtDateTime(s.lastWriteAt)}` : 'Zapis do pliku: włączony')
    : 'Zapis do pliku wyłączony — dostęp tylko do odczytu';
  const title = [kshRunText(s.lastRun), write].filter(Boolean).join('\n');
  return { text, tone, title };
}

/** Wiersz w Opcjach › System › Stan systemu (zasady 15 i 16). */
export function kshSyncSourceRow(s: KshSharePointSync, nowIso: string): SourceRow {
  const tone = kshSyncTone(s, nowIso);
  const why: string[] = [];
  if (tone === 'down') why.push(`Brak udanego odczytu pliku od ponad ${KSH_SYNC_DOWN_MIN} min — alarm do Administratorów HHL.`);
  if (!s.writeEnabled) why.push('Zapis do pliku wyłączony: dostęp tylko do odczytu. Włączy się po pliku testowym od działu IT KSH i zgodzie właściciela.');
  const days = kshSecretDaysLeft(s, nowIso);
  if (days != null && days <= KSH_SECRET_WARN_DAYS && s.secretExpiresOn) {
    why.push(days < 0
      ? `Sekret aplikacji wygasł ${fmtDate(s.secretExpiresOn)} — odczyt pliku nie działa, wymień sekret.`
      : `Sekret aplikacji wygasa ${fmtDate(s.secretExpiresOn)} (za ${days} ${days === 1 ? 'dzień' : 'dni'}) — wymień go przed tym dniem.`);
  }
  const run = kshRunText(s.lastRun);
  if (run && tone === 'ok') why.push(`${run}.`);
  return {
    id: 'ksh-sharepoint',
    name: 'Plik KSH (SharePoint)',
    cadence: 'co 5 min',
    feeds: 'Harmonogram: transporty HHL z pliku KSH; wiersze NTG pomijane',
    lastAt: s.lastReadAt,
    state: tone === 'ok' ? (days != null && days <= KSH_SECRET_WARN_DAYS ? 'partial' : 'ok') : 'down',
    since: tone === 'down' ? s.lastReadAt : null,
    why: why.length ? why.join(' ') : null,
    canCheck: true,
  };
}
