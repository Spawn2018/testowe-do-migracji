/**
 * wyglad/W-eta — Opcje › Kalibracja ETA (E15 pkt 7; audyt 17.10 sekcja 08 N6; D-20261017-1100-01).
 * Zasada: każda dostawa z GPS daje pomiar; po 5 dostawach propozycja czasów odcinków (mediana z rozrzutem, ≤ 10 % — bez zmian);
 * zatwierdza Administrator HHL; bez zatwierdzenia nic się nie zmienia. Produkcja: brak źródła, dopóki P4-u.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { CALIB_AHEAD_AT_24H, CALIB_NEEDED, CALIB_SAME_PCT, calibShiftAt24h, calibVersionText, demoCalibration, demoCalibrationApproveFor } from '../src/lib/etaCalibDemo';
import { etaDuration } from '../src/lib/etaDuration';
import { EtaCalibScreen } from '../src/components/options/EtaCalibScreen';
import { SCREEN_KEY, DESC_KEY } from '../src/components/options/types';
import { hasKey } from '../src/i18n/messages';
import type { EtaCalibration } from '../src/lib/etaCalibSource';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const snap = buildDemoSnapshot();
const data = demoCalibration(snap.loads);
const delivered = snap.loads.filter((l) => l.status === 'DELIVERED' && l.unloadedAt);
const html = (d: EtaCalibration, readOnly = false) => renderToStaticMarkup(createElement(EtaCalibScreen, {
  locale: 'pl', data: d, readOnly, onApprove: readOnly ? null : demoCalibrationApproveFor(d),
}));
/** Kody `eta_segment_params` na produkcji (0051, 0054, 0062, 0160). */
const PROD_CODES = ['PL_ROAD', 'PL_ROAD_GDY', 'PORT_CHECKIN', 'CROSSING_DEFAULT', 'SE_ROAD', 'SE_ROAD_KAA', 'SE_DAILY_REST', 'SE_BREAKS'];

describe('dane demo: pomiary z dostarczonych transportów', () => {
  it('jeden pomiar na każdą dostawę z wjazdem na plac; kody i dni jak w Harmonogramie; od najwcześniejszej', () => {
    expect(data.observations.length).toBe(delivered.length);
    for (const o of data.observations) {
      const l = delivered.find((x) => x.code === o.code)!;
      expect(l).toBeTruthy();
      expect(Date.parse(o.arrivedAt)).toBeLessThan(Date.parse(l.unloadedAt!));
      expect(o.arrivedAt.slice(0, 10) <= DEMO_TODAY_LOCAL).toBe(true);
    }
    const at = data.observations.map((o) => Date.parse(o.arrivedAt));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('pomiar z omyłkowym statusem pominięty z powodem; liczy się co najmniej 5 → propozycja', () => {
    const skipped = data.observations.filter((o) => o.skipped);
    expect(skipped.length).toBe(1);
    expect(skipped[0].skipped).toMatch(/brak GPS/);
    expect(html(data)).toContain('Pomiar pominięty, nie liczy się do propozycji: brak GPS na odcinku SE (lokalizator milczał 9 h).');
    const counted = data.observations.filter((o) => !o.skipped);
    expect(CALIB_NEEDED).toBe(5);
    expect(counted.length).toBeGreaterThanOrEqual(CALIB_NEEDED);
    expect(data.proposal?.at).toBe(counted[counted.length - 1].arrivedAt);
    /* błąd „przed” = średni |błąd 24 h przed| z tabeli */
    const mean = Math.round(counted.reduce((s, o) => s + Math.abs(o.err24!), 0) / counted.length);
    expect(data.proposal?.errorBeforeMin).toBe(mean);
    /* błąd „po” = ten sam błąd przeliczony nowymi czasami (F7 B1): ETA wcześniej o sumę skróceń odcinków przed autem */
    const shift = calibShiftAt24h(data.segments);
    const after = Math.round(counted.reduce((s, o) => s + Math.abs(o.err24! + shift), 0) / counted.length);
    expect(data.proposal?.errorAfterMin).toBe(after);
    expect(after).toBeLessThan(mean);
    expect(shift).toBeGreaterThan(0);
  });
  it('kierunek błędów zgodny z propozycją: krótsze czasy odcinków przed autem ↔ przyjazd wcześniej niż ETA (błąd ujemny)', () => {
    const counted = data.observations.filter((o) => !o.skipped);
    const ahead = data.segments.filter((s) => (CALIB_AHEAD_AT_24H as readonly string[]).includes(s.code) && s.verdict === 'propose');
    expect(ahead.every((s) => s.medianMin! < s.currentMin)).toBe(true);
    expect(counted.filter((o) => o.err24! < 0).length).toBeGreaterThan(counted.length / 2);
  });
  it('odcinki = kody eta_segment_params; reguła: n < 5 — za mało, ≤ 10 % — bez zmian, inaczej mediana', () => {
    expect(data.segments.every((s) => PROD_CODES.includes(s.code))).toBe(true);
    for (const s of data.segments) {
      if (s.verdict === 'few') expect(s.n).toBeLessThan(CALIB_NEEDED);
      if (s.verdict === 'same') expect(Math.abs(s.devPct!)).toBeLessThanOrEqual(CALIB_SAME_PCT);
      if (s.verdict === 'propose') {
        expect(Math.abs(s.devPct!)).toBeGreaterThan(CALIB_SAME_PCT);
        expect(s.n).toBeGreaterThanOrEqual(CALIB_NEEDED);
      }
    }
    const v = Object.fromEntries(data.segments.map((s) => [s.code, s.verdict]));
    expect(v).toMatchObject({ PL_ROAD: 'propose', PL_ROAD_GDY: 'few', PORT_CHECKIN: 'same', CROSSING_DEFAULT: 'fixed', SE_ROAD: 'propose', SE_ROAD_KAA: 'few', SE_BREAKS: 'propose', SE_DAILY_REST: 'fixed' });
    /* mediana Drogi PL z kolumny „Droga PL” */
    const pl = data.observations.filter((o) => !o.skipped).map((o) => o.plMin!).sort((a, b) => a - b);
    const med = (pl[pl.length / 2 - 1] + pl[pl.length / 2]) / 2;
    expect(data.segments.find((s) => s.code === 'PL_ROAD')!.medianMin).toBe(Math.round(med / 5) * 5);
  });
  it('mniej niż 5 dostaw — bez propozycji', () => {
    expect(demoCalibration(delivered.slice(0, 4)).proposal).toBeNull();
  });
  it('wersja po zatwierdzeniu opisuje te same czasy co tabela', async () => {
    const r = await demoCalibrationApproveFor(data)(data.proposal!.id);
    expect(r.ok).toBe(true);
    expect(r.version?.what).toBe(calibVersionText(data));
    for (const s of data.segments.filter((x) => x.verdict === 'propose')) expect(r.version!.what).toContain(etaDuration(s.medianMin!));
    expect((await demoCalibrationApproveFor(data)('inna')).ok).toBe(false);
  });
});

describe('ekran', () => {
  it('zatwierdzona wersja z widoku Opcji: „obowiązuje”, nowe czasy w „Teraz”, bez przycisku', () => {
    const v = { id: 'cal-v2', no: 2, at: '2026-09-23T14:32:00.000Z', by: 'Konto pokazowe // H&H Logistics', current: true, what: calibVersionText(data) };
    const h = renderToStaticMarkup(createElement(EtaCalibScreen, { locale: 'pl', data, onApprove: demoCalibrationApproveFor(data), approved: v }));
    expect(h).toContain('data-cal-proposal="approved"');
    expect(h).toContain('ETA liczy czasy z wersji 2');
    expect(h).not.toContain('data-cal-approve');
    expect(h).toContain(`>${etaDuration(data.segments.find((s) => s.code === 'SE_ROAD')!.medianMin!)}<`);
  });
  it('trzy części; średni błąd 1 h przed względem celu 30 min; zysk z propozycji', () => {
    const h = html(data);
    for (const s of ['Pomiary dostaw', 'Propozycja czasów odcinków', 'Wersje czasów', 'nie większy niż 30 min', 'data-cal-avg', 'data-cal-gain', 'Zatwierdź nowe czasy', 'Bez zatwierdzenia nic się nie zmienia', 'obowiązuje']) {
      expect(h).toContain(s);
    }
    expect(h).toContain('data-cal-proposal="ready"');
    expect(h).toContain(`nowe czasy dają średni błąd 24 h przed przyjazdem ${etaDuration(data.proposal!.errorAfterMin)} zamiast ${etaDuration(data.proposal!.errorBeforeMin)}`);
    expect(h).toContain('za mało dostaw');
    expect(h).toMatch(/bez zmian \(−\d+%\)/);
  });
  it('Operacje HHL — tylko podgląd, bez przycisku', () => {
    const h = html(data, true);
    expect(h).not.toContain('data-cal-approve');
    expect(h).toContain('Nowe czasy zatwierdza Administrator HHL');
  });
  it('za mało dostaw — „Propozycja po 5 dostawach — brakuje N”, bez przycisku', () => {
    const h = html(demoCalibration(delivered.slice(0, 3)));
    expect(h).toContain('data-cal-proposal="wait"');
    expect(h).toMatch(/Propozycja po 5 dostawach — brakuje \d/);
    expect(h).not.toContain('data-cal-approve');
  });
  it('czasy jak w D-071 („X d Y h Z min”); CSS tylko z tokenów, bez wielkich liter', () => {
    expect(html(data)).toMatch(/\d+ h \d+ min/);
    expect(html(data)).not.toMatch(/\d+ h 0 min|± \d{2,} min · /);
    expect(read('src/components/options/etaCalib.css')).not.toMatch(/uppercase|gradient|box-shadow|border-radius|#[0-9a-f]{3,6}\b/i);
  });
});

describe('menu Opcji i produkcja', () => {
  it('ekran „Kalibracja ETA” w grupie Zasady transportu, nazwa i opis w słowniku; zatwierdza tylko Administrator', () => {
    expect(SCREEN_KEY.calib).toBe('p3c_s_calib');
    expect(hasKey('pl', SCREEN_KEY.calib)).toBe(true);
    expect(hasKey('pl', DESC_KEY.calib)).toBe(true);
    const v = read('src/views/OptionsView.tsx');
    expect(v).toMatch(/scr\('calib'/);
    expect(v).toMatch(/onApprove=\{ro \? null : etaCalibrationApproveOf\(calib\)\} approved=\{calibApproved\} onApproved=\{setCalibApproved\}/);
  });
  it('produkcja: źródło `null` (brak danych), warunek trybu wpisany wprost (strażnik I-0)', () => {
    const src = read('src/lib/etaCalibSource.ts');
    expect(src).toMatch(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'\) return demoCalibration\(loads\);\n {2}return null;/);
    expect(src).toMatch(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'\) return demoCalibrationApproveFor\(c\);\n {2}return null;/);
  });
});
