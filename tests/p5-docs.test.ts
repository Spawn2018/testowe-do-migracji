/**
 * wyglad/P5 — Dokumenty (E31): liczby „po terminie” i „w ciągu 7 dni”, widoczność polis (pytanie 3),
 * nazwa CMR według terminu, kolejność rodzajów w oknie „Wgraj dokument”, wyszukiwanie transportu, filtry plików.
 * Kody i numery zmyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Document, Load } from '../src/types';
import type { DocStatusRow } from '../src/lib/docRequirements';
import { cmrKind, codesParts, codesText, filterFiles, kindOptions, reqCount, reqVisible, responsibleOrg, searchLoads, seenBy } from '../src/lib/p5Docs';

const NOW = Date.parse('2026-10-14T10:00:00Z');
const row = (loadId: string, category: DocStatusRow['category'], state: DocStatusRow['state'], dueAt: string | null): DocStatusRow => ({ loadId, category, state, dueAt });

describe('E31 — wymagania przy transporcie', () => {
  it('po terminie i w ciągu 7 dni; bez terminu i komplet się nie liczą', () => {
    const rows = [
      row('a', 'PERMIT_PL', 'OVERDUE', '2026-10-10T04:00:00Z'),
      row('b', 'PERMIT_PL', 'MISSING', '2026-10-16T04:00:00Z'),
      row('c', 'PERMIT_PL', 'MISSING', '2026-10-30T04:00:00Z'),
      row('d', 'PERMIT_PL', 'MISSING', null),
      row('e', 'PERMIT_PL', 'OK', '2026-10-15T04:00:00Z'),
      row('f', 'CMR', 'OVERDUE', '2026-10-01T04:00:00Z'),
    ];
    const c = reqCount(rows, 'PERMIT_PL', NOW);
    expect(c.overdue.map((r) => r.loadId)).toEqual(['a']);
    expect(c.soon.map((r) => r.loadId)).toEqual(['b']);
  });
  it('polisy: KSH bez polisy przewoźnika, SCX bez polisy HHL, HHL obie (pytanie 3)', () => {
    expect([reqVisible('INSURANCE', 'KSH'), reqVisible('OCS', 'KSH')]).toEqual([false, true]);
    expect([reqVisible('INSURANCE', 'SCX'), reqVisible('OCS', 'SCX')]).toEqual([true, false]);
    expect([reqVisible('INSURANCE', 'HHL'), reqVisible('OCS', 'HHL')]).toEqual([true, true]);
  });
  it('CMR po rozładunku = z podpisem odbiorcy (decyzja 1B); kto wgrywa skrótem firmy', () => {
    expect(cmrKind({ category: 'CMR', required: true, responsible: 'CARRIER', anchor: 'AFTER_UNLOAD', offsetHours: 48 })).toBe('SIGNED');
    expect(cmrKind({ category: 'CMR', required: true, responsible: 'CARRIER', anchor: 'AT_LOAD', offsetHours: 2 })).toBe('LOAD');
    expect([responsibleOrg('CARRIER'), responsibleOrg('CLIENT'), responsibleOrg('FORWARDER')]).toEqual(['SCX', 'KSH', 'HHL']);
    expect(codesText(['A-1', 'A-2'])).toBe('A-1, A-2');
    expect(codesText(['1', '2', '3', '4', '5', '6', '7'], 3)).toBe('1, 2, 3 … (7)');
    /* wyglad/W-przed-wydaniem-2: te same części dla widoku (kody w osobnych <span>) */
    expect(codesParts(['A-1', 'A-2'])).toEqual({ shown: ['A-1', 'A-2'], total: null });
    expect(codesParts(['1', '2', '3', '4', '5', '6', '7'], 3)).toEqual({ shown: ['1', '2', '3'], total: 7 });
  });
});

describe('E31 — okno „Wgraj dokument”', () => {
  it('braki transportu na górze: po terminie, potem brak, potem reszta', () => {
    const rows = [row('x', 'CMR', 'MISSING', null), row('x', 'PERMIT_SE', 'OVERDUE', null), row('y', 'PERMIT_PL', 'OVERDUE', null)];
    expect(kindOptions('x', rows, ['PERMIT_PL', 'PERMIT_SE', 'CMR']).map((k) => [k.category, k.state])).toEqual([
      ['PERMIT_SE', 'OVERDUE'], ['CMR', 'MISSING'], ['PERMIT_PL', null],
    ]);
  });
  it('szukanie po kodzie albo numerze zlecenia HHL lub SCX', () => {
    const loads = [{ code: 'TA-15', hhlOrderNo: 'H/1', carrierOrderNo: 'S-77' }, { code: 'TB-02', hhlOrderNo: 'H/2', carrierOrderNo: null }];
    expect(searchLoads(loads, 'ta-1').map((l) => l.code)).toEqual(['TA-15']);
    expect(searchLoads(loads, 's-77').map((l) => l.code)).toEqual(['TA-15']);
    expect(searchLoads(loads, 'h/2').map((l) => l.code)).toEqual(['TB-02']);
    expect(searchLoads(loads, '  ')).toHaveLength(2);
  });
});

describe('E31 — pliki', () => {
  const L = (id: string, at: string) => ({ id, code: id.toUpperCase(), events: [], unloadedAt: at, plannedDeliverDate: at.slice(0, 10) } as unknown as Load);
  const loads = [L('a', '2026-10-06T10:00:00Z'), L('b', '2026-10-13T10:00:00Z')];
  const D = (id: string, loadId: string, category: Document['category'], p: Partial<Document> = {}): Document => ({
    id, loadId, category, name: `${id}.pdf`, uploadedAt: '2026-10-07T10:54:00Z', deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: ['SCX', 'HHL'], ...p,
  });
  const docs = [D('1', 'a', 'CMR'), D('2', 'b', 'PERMIT_PL'), D('3', '', 'INSURANCE'), D('4', 'a', 'CMR', { superseded: true }), D('5', 'a', 'CMR', { status: 'MISSING' })];
  it('bez filtrów: wgrane, bez zastąpionych wersji, z plikami firmy', () => {
    expect(filterFiles(docs, loads, { week: '', loadId: '', category: '' }).map((d) => d.id)).toEqual(['1', '2', '3']);
  });
  it('tydzień, transport, rodzaj; „Widzą” w stałej kolejności', () => {
    expect(filterFiles(docs, loads, { week: '2026-W41', loadId: '', category: '' }).map((d) => d.id)).toEqual(['1']);
    expect(filterFiles(docs, loads, { week: '', loadId: 'b', category: '' }).map((d) => d.id)).toEqual(['2']);
    expect(filterFiles(docs, loads, { week: '', loadId: '', category: 'INSURANCE' }).map((d) => d.id)).toEqual(['3']);
    expect(seenBy(['SCX', 'HHL'])).toBe('HHL, SCX');
  });
});

describe('E31 — strona bez edycji terminów, KSH bez wgrywania', () => {
  const view = readFileSync(new URL('../src/views/DocsView.tsx', import.meta.url), 'utf8');
  it('terminy zmienia się w Opcjach (E12) — na stronie Dokumenty nie ma zapisu wymagań', () => {
    expect(view).not.toMatch(/saveDocRequirement|docreq-edit|docreq-save/);
    const opts = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(opts).toMatch(/<DocTerms canEdit=\{isHhlAdmin\} \/>/);
  });
  it('„Wgraj dokument” tylko HHL i SCX; polis nie wgrywa się przy transporcie (G-21)', () => {
    expect(view).toMatch(/const canUpload = role === 'HHL' \|\| role === 'SCX';/);
    /* wyglad/W-dane (E31 pkt 5): „Inne” dochodzi po `otherDocsOn()`; polisy nadal nie (G-21) */
    expect(view).toMatch(/const UPLOAD_KINDS: DocCategory\[\] = otherDocsOn\(\) \? \['PERMIT_PL', 'PERMIT_SE', 'CMR', 'OTHER'\] : \['PERMIT_PL', 'PERMIT_SE', 'CMR'\];/);
    expect(view.match(/const UPLOAD_KINDS[^\n]*/)?.[0]).not.toContain('INSURANCE');
  });
});
