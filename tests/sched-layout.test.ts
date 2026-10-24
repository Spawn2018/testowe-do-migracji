/**
 * wyglad/P7-c — Harmonogram w układzie pliku KSH (E38 1A), „Widok skrócony” (E30 pkt 1), filtry (E30 pkt 3), eksport
 * (E30 pkt 4), układ kolumn (E30 pkt 2): obliczenia widoku.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  dayPl, dmy, DEFAULT_LAYOUT, docCell, etaText, exportName, FILE_COLS, fileColsFor, inRange, loadSchedLayout, moneyKey, pair, QUICKS,
  saveSchedLayout, SHORT_COLS, shortExtrasFor, weekOf, weekPicks,
} from '../src/lib/schedLayout';
import { s7 } from '../src/i18n/sched7';
import type { DocStatusRow } from '../src/lib/docRequirements';
import { DEFAULT_DOC_REQUIREMENTS } from '../src/lib/docRequirements';

describe('układ pliku i widok skrócony', () => {
  it('kolumny pliku w kolejności z pliku (bez Lp., Przewoźnika, Komentarza), potem Watch Tower', () => {
    expect(FILE_COLS.map((c) => s7('pl', c.key))).toEqual([
      'Typ', 'Wysyłka', 'Rozmiar L × W × H', 'Waga elementu', 'Ilość', 'Waga [t]', 'Data załadunku', 'Dzień', 'Godzina', 'Kierowca', 'Telefon kierowcy', 'Ciągnik',
      'Naczepa', 'Nr zlecenia SCX', 'Data dostawy', 'Dzień', 'Godzina', 'Nr zlecenia HHL', 'Status', 'ETA Boden', 'Dokumenty', 'Kwota',
    ]);
    expect(FILE_COLS.filter((c) => c.fixed).map((c) => c.id)).toEqual(['type', 'code', 'status']);
    expect(FILE_COLS.findIndex((c) => c.group === 'wt')).toBe(18);
  });
  it('KSH bez kolumn numerów (E41 1A); kolumny ukryte; kwota według firmy', () => {
    expect(fileColsFor('KSH', []).map((c) => c.id)).not.toContain('ordScx');
    expect(fileColsFor('KSH', []).map((c) => c.id)).not.toContain('ordHhl');
    expect(fileColsFor('SCX', []).map((c) => c.id)).toContain('ordHhl');
    expect(fileColsFor('HHL', ['trailer', 'type']).map((c) => c.id)).toContain('type');
    expect(fileColsFor('HHL', ['trailer']).map((c) => c.id)).not.toContain('trailer');
    expect([moneyKey('HHL'), moneyKey('KSH'), moneyKey('SCX')].map((k) => s7('pl', k))).toEqual(['Przychód', 'Twoja cena', 'Moja stawka']);
    expect(SHORT_COLS).toHaveLength(9); /* 8 kolumn E30 + „Telefon kierowcy” (właściciel 16.10, 13:58) */
    expect(shortExtrasFor('KSH')).toEqual(['tractor', 'trailer', 'sailing']);
    expect(SHORT_COLS.map((c) => c.id)).toContain('phone');
    expect(shortExtrasFor('HHL')).toContain('cost');
    expect(shortExtrasFor('SCX')).not.toContain('cost');
  });
});

describe('komórki', () => {
  it('daty i dni po polsku (plik ma dni po angielsku — E21)', () => {
    expect(dmy('2026-10-05')).toBe('05.10.2026');
    expect(dmy('2026-10-05T22:30:00Z')).toBe('06.10.2026'); // chwila → dzień w Polsce
    expect(dayPl('2026-10-05')).toBe('pon.');
    expect(dayPl('2026-10-08')).toBe('czw.');
    expect(dmy(null)).toBe('–');
  });
  it('„A / B” = PL → SE; brak drugiej części przy przepięciu = „?”', () => {
    expect(pair('A. C.', null, false)).toEqual({ a: 'A. C.', b: null, missingB: false });
    expect(pair('O. B.', '  ', true)).toEqual({ a: 'O. B.', b: null, missingB: true });
    expect(pair('R. P.', 'M. M.', true).missingB).toBe(false);
  });
  it('ETA Boden: „dostarczono”, „na placu”, „–” przed wyjazdem', () => {
    expect(etaText({ status: 'DELIVERED', stage: 'DELIVERED', etaBoden: null, etaPreLoad: false })).toBe('done');
    /* E25 (07.10 17:46): „Rozładowany” łączy się z „Dostarczone” → „dostarczono” (audyt-B, B-03) */
    expect(etaText({ status: 'UNLOADING', stage: 'SITE', etaBoden: 'x', etaPreLoad: false })).toBe('done');
    expect(etaText({ status: 'APPROACHING_SITE', stage: 'SITE', etaBoden: 'x', etaPreLoad: false })).toBe('site');
    expect(etaText({ status: 'PLANNED', stage: 'PLAN', etaBoden: 'x', etaPreLoad: true })).toBe('none');
    expect(etaText({ status: 'ON_FERRY', stage: 'FERRY', etaBoden: '2026-10-05T10:00:00Z', etaPreLoad: false })).toBe('eta');
  });
  it('Dokumenty: po terminie „brak …” i kto wgrywa; przed terminem „… do”; komplet', () => {
    const row = (category: DocStatusRow['category'], state: DocStatusRow['state'], dueAt: string | null = '2026-10-04T10:00:00Z'): DocStatusRow => ({ loadId: 'l', category, state, dueAt });
    expect(docCell([row('CMR', 'OVERDUE'), row('PERMIT_PL', 'OK')], DEFAULT_DOC_REQUIREMENTS)).toEqual({ tone: 'bad', keys: ['s7_d_CMR'], whoKey: 's7_d_who_SCX' });
    expect(docCell([row('PERMIT_PL', 'MISSING'), row('CMR', 'OK')], DEFAULT_DOC_REQUIREMENTS)).toMatchObject({ tone: 'due', keys: ['s7_d_PERMIT_PL'] });
    expect(docCell([row('CMR', 'OK')], DEFAULT_DOC_REQUIREMENTS)).toEqual({ tone: 'ok' });
    expect(docCell([], DEFAULT_DOC_REQUIREMENTS)).toEqual({ tone: 'none' });
  });
});

describe('filtry, eksport, układ', () => {
  it('tygodnie pon–nd jak E39; zakres włącznie', () => {
    const w = weekOf('2026-10-08T10:00:00Z');
    expect(w).toEqual({ from: '2026-10-05', to: '2026-10-11', n: 41 });
    expect(weekPicks('2026-10-08T10:00:00Z').map((p) => p.label)).toEqual(['t40', 't41', 't41–t42', 't42']);
    expect(inRange('2026-10-11', w)).toBe(true);
    expect(inRange('2026-10-12', w)).toBe(false);
    expect(inRange(null, w)).toBe(false);
    expect(inRange(null, null)).toBe(true);
  });
  it('filtry stanu: E28 pkt 2 + „Anulowane” (E30 pkt 3)', () => {
    expect(QUICKS).toEqual(['late', 'nodocs', 'nodriver', 'notractor', 'cancelled']);
  });
  it('nazwa pliku eksportu jak w E30 pkt 4', () => {
    expect(exportName('HHL', 't40–t41', '2026-10-08', 'xlsx')).toBe('Harmonogram_HHL_t40-t41_2026-10-08.xlsx');
    expect(exportName('KSH', null, '2026-10-08', 'pdf')).toBe('Harmonogram_KSH_2026-10-08.pdf');
  });
  afterEach(() => localStorage.clear());
  it('układ kolumn: domyślnie plik, zapis i odczyt, nieznane kolumny odrzucone', () => {
    expect(loadSchedLayout()).toEqual(DEFAULT_LAYOUT);
    saveSchedLayout({ view: 'short', fileHidden: ['trailer'], shortExtras: ['cost'] });
    expect(loadSchedLayout()).toEqual({ view: 'short', fileHidden: ['trailer'], shortExtras: ['cost'] });
    localStorage.setItem('watch-tower-schedule-v2', JSON.stringify({ view: 'x', fileHidden: ['type', 'bad'], shortExtras: ['bad'] }));
    expect(loadSchedLayout()).toEqual(DEFAULT_LAYOUT);
  });
  it('Harmonogram bez „Zmień ciągnik”, bez „Zapisz widok” i bez okna przeglądarki (E30 pkt 2 i 5)', () => {
    const v = readFileSync('src/views/ScheduleView.tsx', 'utf8');
    expect(v).not.toMatch(/data-change-tractor|window\.prompt|a6_sch_save_view/);
    expect(readFileSync('src/TowerShell.tsx', 'utf8')).toMatch(/ScheduleViewLazy as ScheduleView/);
  });
});
