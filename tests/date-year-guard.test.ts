/**
 * wyglad/daty-rok (PR #262) — strażnik formatu dat. Właściciel 16.10.2026, 13:58 i 14:09 (zmienia E21, znosi D17):
 * „Do każdej daty w każdym miejscu w całym systemie musisz dodać rok. Format daty […] DD.MM.RRRR. Gdy jakiekolwiek
 * miejsce używa godziny, to musi być w formacie GG:MM.”
 *
 * (a) każdy formater widoku daje rok i GG:MM — dziś, inny rok, północ, czas letni i zimowy;
 * (b) skan tekstów dla użytkownika (`src/i18n/*.ts`, `src/data/seed.ts`, potem całe `src`): żadna data `dd.mm`
 *     bez `.rrrr`; wyjątki tylko jawne, z powodem;
 * (c) w kodzie widoku nie wraca format bez roku (Intl z miesiącem bez roku, `${d.slice(8, 10)}.${d.slice(5, 7)}`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  fmtDate, fmtDateRange, fmtDateTime, fmtDateTimeRange, fmtTime, fmtWeek,
  formatCalendarDay, formatCompactInZone, formatEtaBoden, formatEtaBodenCompact, formatLoadPl, formatOpsDate,
  formatOpsDateTime, formatSchedTableDay, formatTableDay, formatTableInZone, formatUnloadSe, TZ_LOAD_PL, TZ_UNLOAD_SE,
} from '../src/lib/time';
import { formatListCompact, formatListDateTime } from '../src/lib/format';
import { dmy as schedDmy, hmIn } from '../src/lib/schedLayout';
import { dayLong, dayShort, dmHm, hm as awizHm, hourWindow } from '../src/lib/p7Awiz';
import { hm as mapHm } from '../src/lib/p9cMap';
import { fmtLocal } from '../src/lib/sailings';
import { sailDay, sailTime } from '../src/lib/sailView';
import { dayLabel, dmy as histDmy, hhmm, histRow } from '../src/lib/p6History';
import { describeDeviation } from '../src/lib/pl/describe';
import { dayOnly, dayTime, timeOnly } from '../src/lib/statusAxis';
import { formatVoyageDayLabel } from '../src/lib/voyage';
import { weekLabel, weekOf } from '../src/lib/p5Finance';
import { weekKeyLabel } from '../src/lib/p5Invoices';
import { packWeekLabel } from '../src/lib/p5Pack';
import type { LoadEvent } from '../src/types';

/* ── przypadki ───────────────────────────────────────────────────────────────────── */
const TODAY = '2026-10-16T06:05:00Z'; // 08:05 w Polsce i w Szwecji (CEST), bieżący rok
const OTHER_YEAR = '2025-12-31T12:00:00Z'; // 13:00 CET
const NEXT_YEAR = '2027-01-09T17:00:00Z'; // 18:00 CET
const MIDNIGHT = '2026-10-15T22:00:00Z'; // 00:00 w Polsce 16.10 — nie „24:00” i nie poprzedni dzień
const SUMMER = '2026-07-01T10:00:00Z'; // 12:00 CEST (+02)
const WINTER = '2026-01-15T10:00:00Z'; // 11:00 CET (+01)
const AFTER_DST_END = '2026-10-25T01:30:00Z'; // po zmianie czasu 25.10.2026: 02:30 CET

/** Data zawsze z rokiem; godzina zawsze GG:MM (dwie cyfry, 24 h); żadnego „dd.mm” bez roku. */
const DATE_NO_YEAR = /(?<![\d.])\d{1,2}\.\d{2}(?![\d])(?!\.\d{4})/;
function ok(s: string): void {
  expect(s, s).not.toMatch(DATE_NO_YEAR);
  expect(s, s).not.toMatch(/(?<![\d:])\d:\d{2}(?!\d)/); // „8:05”
  expect(s, s).not.toMatch(/\b24:\d{2}\b/);
}

describe('(a) formatery widoku: rok zawsze, GG:MM', () => {
  it('time.ts — data, godzina, data z godziną, zakresy, tydzień', () => {
    const cases: [string, string][] = [
      [fmtDateTime(TODAY), '16.10.2026, 08:05'],
      [fmtDateTime(OTHER_YEAR), '31.12.2025, 13:00'],
      [fmtDateTime(NEXT_YEAR), '09.01.2027, 18:00'],
      [fmtDateTime(MIDNIGHT), '16.10.2026, 00:00'],
      [fmtDateTime(SUMMER), '01.07.2026, 12:00'],
      [fmtDateTime(WINTER), '15.01.2026, 11:00'],
      [fmtDateTime(AFTER_DST_END), '25.10.2026, 02:30'],
      [fmtDateTime(SUMMER, TZ_UNLOAD_SE), '01.07.2026, 12:00'],
      [fmtDateTime('2026-10-16'), '16.10.2026'],
      [fmtDate(TODAY), '16.10.2026'],
      [fmtDate(MIDNIGHT), '16.10.2026'],
      [fmtDate('2025-12-31'), '31.12.2025'],
      [fmtTime(MIDNIGHT), '00:00'],
      [fmtTime(WINTER), '11:00'],
      [fmtTime('2026-10-16T05:05:00Z'), '07:05'],
      [fmtDateRange('2026-10-12', '2026-10-18'), '12.10.2026–18.10.2026'],
      [fmtDateRange('2025-12-29', '2026-01-04'), '29.12.2025–04.01.2026'],
      [fmtDateTimeRange('2026-10-16T06:00:00Z', '2026-10-16T10:00:00Z'), '16.10.2026, 08:00–12:00'],
      [fmtDateTimeRange('2026-10-16T20:00:00Z', '2026-10-17T00:00:00Z'), '16.10.2026, 22:00–17.10.2026, 02:00'],
      [fmtWeek(42, '2026-10-12', '2026-10-18'), 't42 · 12.10.2026–18.10.2026'],
      [formatCalendarDay('2026-10-16'), '16.10.2026'],
      [formatTableDay('2026-10-16'), '16.10.2026'],
      [formatTableDay('2025-10-16'), '16.10.2025'],
      [formatTableInZone(TODAY, TZ_UNLOAD_SE), '16.10.2026, 08:05'],
      [formatTableInZone(OTHER_YEAR, TZ_UNLOAD_SE), '31.12.2025, 13:00'],
      [formatTableInZone(MIDNIGHT, TZ_LOAD_PL), '16.10.2026, 00:00'],
      [formatTableInZone(TODAY, TZ_LOAD_PL, { withTime: false }), '16.10.2026'],
      [formatCompactInZone(WINTER, TZ_UNLOAD_SE), '15.01.2026, 11:00'],
      [formatCompactInZone('2026-10-16', TZ_UNLOAD_SE), '16.10.2026'],
      [formatEtaBodenCompact(SUMMER), '01.07.2026, 12:00'],
      [formatSchedTableDay('2026-10-16', TODAY, TZ_LOAD_PL), '16.10.2026, 08:05'],
      [formatSchedTableDay('2026-10-16', null, TZ_LOAD_PL), '16.10.2026, –'],
      [formatOpsDateTime(WINTER), '15.01.2026, 11:00'],
      [formatOpsDate(TODAY), '16.10.2026'],
      [formatLoadPl(MIDNIGHT), '16.10.2026, 00:00'],
      [formatUnloadSe(AFTER_DST_END), '25.10.2026, 02:30'],
      [formatEtaBoden(OTHER_YEAR), '31.12.2025, 13:00'],
    ];
    for (const [got, want] of cases) {
      expect(got).toBe(want);
      ok(got);
    }
  });

  it('format.ts — formatListDateTime bez reguły „bieżący rok bez roku”', () => {
    expect(formatListDateTime(TODAY)).toBe('16.10.2026, 08:05');
    expect(formatListDateTime(OTHER_YEAR)).toBe('31.12.2025, 13:00');
    expect(formatListDateTime(MIDNIGHT)).toBe('16.10.2026, 00:00');
    expect(formatListDateTime(SUMMER)).toBe('01.07.2026, 12:00');
    expect(formatListDateTime(WINTER)).toBe('15.01.2026, 11:00');
    expect(formatListDateTime('2026-10-16')).toBe('16.10.2026');
    expect(formatListCompact(WINTER)).toBe('15.01.2026, 11:00');
  });

  it('Harmonogram (schedLayout), Awizacja i panel (p7Awiz), Mapa (p9cMap)', () => {
    expect(schedDmy('2026-10-16')).toBe('16.10.2026');
    expect(schedDmy(MIDNIGHT)).toBe('16.10.2026');
    expect(schedDmy('2025-12-31')).toBe('31.12.2025');
    expect(hmIn(MIDNIGHT, 'Europe/Warsaw')).toBe('00:00');
    expect(hmIn(WINTER, 'Europe/Stockholm')).toBe('11:00');
    expect(dayShort('2026-10-15')).toBe('czw. 15.10.2026');
    expect(dayLong('2025-12-31')).toBe('śr. 31.12.2025');
    expect(dmHm(TODAY)).toBe('16.10.2026, 08:05');
    expect(dmHm(MIDNIGHT)).toBe('16.10.2026, 00:00');
    expect(dmHm(WINTER)).toBe('15.01.2026, 11:00');
    expect(awizHm(MIDNIGHT)).toBe('00:00');
    expect(hourWindow('2026-10-16T06:00:00Z', '2026-10-16T10:00:00Z')).toBe('08:00–12:00');
    expect(mapHm(MIDNIGHT)).toBe('00:00');
    expect(mapHm(SUMMER)).toBe('12:00');
  });

  it('Rejsy (sailings, sailView) i dzień rejsu (voyage)', () => {
    expect(fmtLocal(TODAY)).toBe('16.10.2026, 08:05');
    expect(fmtLocal(MIDNIGHT)).toBe('16.10.2026, 00:00');
    expect(sailTime(TODAY)).toBe('16.10.2026, 08:05');
    expect(sailTime(NEXT_YEAR)).toBe('09.01.2027, 18:00');
    expect(sailDay(TODAY)).toBe('16.10.2026');
    expect(sailDay(WINTER)).toBe('15.01.2026');
    expect(formatVoyageDayLabel('2026-09-24T18:00:00+02:00')).toBe('24.09.2026');
  });

  it('Historia (p6History), oś statusów (statusAxis), drogi SE (pl/describe)', () => {
    expect(histDmy('2026-10-07')).toBe('07.10.2026');
    expect(hhmm(MIDNIGHT)).toBe('00:00');
    expect(dayLabel('2026-10-07')).toBe('07.10.2026 · środa');
    const e: LoadEvent = { id: 'e1', loadId: 'L1', type: 'ORDER_NO_UPDATED', at: TODAY, actor: 'system', payload: { from: OTHER_YEAR, to: WINTER } };
    const row = histRow(e, 'pl');
    for (const v of [row.from, row.to]) if (v) ok(v);
    expect(dayTime(TODAY)).toBe('16.10.2026, 08:05');
    expect(dayTime(MIDNIGHT)).toBe('16.10.2026, 00:00');
    expect(dayOnly('2026-10-16')).toBe('16.10.2026');
    expect(dayOnly(WINTER)).toBe('15.01.2026');
    expect(timeOnly(MIDNIGHT)).toBe('00:00');
    const road = describeDeviation({ StartTime: SUMMER, EndTime: WINTER }, 'roboty');
    expect(road.title).toContain('od 01.07.2026, 12:00 do 15.01.2026, 11:00');
    ok(road.title);
  });

  it('tygodnie (Finanse, Faktury, paczka tygodnia): „t42 · 12.10.2026–18.10.2026”', () => {
    expect(weekLabel(weekOf('2026-10-12'))).toBe('t42 · 12.10.2026–18.10.2026');
    expect(weekKeyLabel('2026-W42')).toBe('42 · 12.10.2026–18.10.2026');
    expect(weekKeyLabel('2026-W01')).toBe('1 · 29.12.2025–04.01.2026');
    expect(packWeekLabel('2026-W42')).toBe('t42 · 12.10.2026–18.10.2026');
  });
});

/* ── (b) teksty dla użytkownika ─────────────────────────────────────────────────── */

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

/** Każda data `d.mm`/`dd.mm` bez `.rrrr` i każda godzina „8:05” w literałach tekstu (bez komentarzy i ścieżek importu). */
function textHits(file: string): { file: string; line: number; token: string; text: string }[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { file: string; line: number; token: string; text: string }[] = [];
  const re = /(?<![\d.])\d{1,2}\.\d{2}(?![\d])(?!\.\d{4})|(?<![\d:.])\d:\d{2}(?!\d)/g;
  const visit = (n: ts.Node): void => {
    let text: string | null = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      const isModulePath = ts.isStringLiteral(n) && (ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent) || ts.isExternalModuleReference(n.parent));
      if (!isModulePath) text = n.text;
    }
    if (text) {
      for (const m of text.matchAll(re)) {
        out.push({ file: relative(ROOT, file).replace(/\\/g, '/'), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, token: m[0], text });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Jawne wyjątki: liczby z kropką, które nie są datą. Klucz — plik; wartość — dozwolone ciągi i powód.
 * Każdy nowy wyjątek dopisujemy tu z powodem; data bez roku nie może tu trafić.
 */
const NOT_A_DATE: Record<string, { tokens: string[]; why: string }> = {
  'src/components/shell/ClaudeIcon.tsx': { tokens: ['*'], why: 'współrzędne ścieżki SVG (atrybut d)' },
  'src/components/shell/NotificationBell.tsx': { tokens: ['1.94'], why: 'współrzędne ścieżki SVG ikony dzwonka' },
  'src/views/OptionsView.tsx': { tokens: ['0.01'], why: 'krok pola liczbowego (step)' },
  'src/auth/BafForm.tsx': { tokens: ['18.50', '1.00', '5.90'], why: 'przykład CSV progów BAF: cena i mnożnik' },
  'src/components/drawer/AgreedFeeForm.tsx': { tokens: ['75.00'], why: 'przykład kwoty w polu (placeholder)' },
  'src/lib/permits.ts': { tokens: ['3.60', '3.50'], why: 'szerokość ładunku w metrach (W>3,50 m)' },
  'src/lib/prodFacade.ts': { tokens: ['8.10'], why: 'numer punktu zakresu (SCOPE 8.10), nie data' },
};

function unexpected(files: string[]) {
  return files.flatMap(textHits).filter((h) => {
    const ex = NOT_A_DATE[h.file];
    return !(ex && (ex.tokens.includes('*') || ex.tokens.includes(h.token)));
  });
}

describe('(b) teksty dla użytkownika bez daty bez roku', () => {
  it('src/i18n/*.ts i src/data/seed.ts — każda data z rokiem, godzina GG:MM', () => {
    const files = [
      ...readdirSync(join(SRC, 'i18n')).filter((f) => f.endsWith('.ts')).map((f) => join(SRC, 'i18n', f)),
      join(SRC, 'data', 'seed.ts'),
    ];
    expect(files.length).toBeGreaterThan(30);
    const hits = unexpected(files);
    expect(hits.map((h) => `${h.file}:${h.line} „${h.token}” w „${h.text.slice(0, 80)}”`)).toEqual([]);
  });

  it('całe src (dane demo, Pomoc, podpowiedzi, opisy wykresów) — wyjątki tylko z listy NOT_A_DATE', () => {
    const hits = unexpected(walk(SRC));
    expect(hits.map((h) => `${h.file}:${h.line} „${h.token}” w „${h.text.slice(0, 80)}”`)).toEqual([]);
  });

  it('wyjątki są aktualne — każdy wpis NOT_A_DATE nadal czegoś dotyczy', () => {
    for (const [file, ex] of Object.entries(NOT_A_DATE)) {
      const hits = textHits(join(ROOT, file));
      expect(hits.length, `${file}: ${ex.why}`).toBeGreaterThan(0);
      if (!ex.tokens.includes('*')) for (const t of ex.tokens) expect(hits.some((h) => h.token === t), `${file}: ${t}`).toBe(true);
    }
  });
});

/* ── (c) kod widoku nie wraca do formatu bez roku ───────────────────────────────── */

describe('(c) w kodzie widoku nie ma formatu daty bez roku', () => {
  const code = walk(SRC).map((f) => ({ f: relative(ROOT, f).replace(/\\/g, '/'), s: readFileSync(f, 'utf8') }));

  it('Intl.DateTimeFormat / toLocale*String z miesiącem zawsze z rokiem', () => {
    const bad: string[] = [];
    for (const { f, s } of code) {
      for (const m of s.matchAll(/(?:DateTimeFormat|toLocale(?:Date|Time)?String)\(([^;]*?)\{([^}]*)\}/g)) {
        const opts = m[2];
        if (/\bmonth\s*:/.test(opts) && !/\byear\s*:/.test(opts)) bad.push(`${f}: ${m[0].slice(0, 90)}`);
        if (/\bdateStyle\s*:/.test(opts)) bad.push(`${f}: ${m[0].slice(0, 90)} (dateStyle zależy od języka)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ręczne „dd.mm” z fragmentów ISO zawsze z rokiem', () => {
    const bad: string[] = [];
    for (const { f, s } of code) {
      for (const line of s.split('\n')) {
        if (/slice\(8, ?10\)\}\.\$\{[^}]*slice\(5, ?7\)\}(?!\.\$\{)/.test(line)) bad.push(`${f}: ${line.trim().slice(0, 100)}`);
        if (/getU?T?C?Date\(\)\)\.padStart\(2, '0'\)\}\.\$\{String\([^)]*getU?T?C?Month\(\) \+ 1\)\.padStart\(2, '0'\)\}(?!\.)/.test(line)) bad.push(`${f}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
