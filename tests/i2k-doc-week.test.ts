/** I-2k — paczka „tydzień”: wyłącznie dokumenty transportów z wybranego tygodnia ISO (także zawartość pliku ZIP). */
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { Document, Load } from '../src/types';
import { defaultDocWeek, docsForWeek, loadWeekKey, weeksWithLoads } from '../src/lib/docWeek';
import { downloadDocumentsZip } from '../src/lib/zipDocs';

const load = (id: string, deliver: string, extra: Partial<Load> = {}): Load =>
  ({ id, plannedLoadDate: '2026-09-01', plannedDeliverDate: deliver, status: 'PLANNED', ...extra }) as unknown as Load;
const doc = (id: string, loadId: string, name: string): Document =>
  ({ id, loadId, category: 'CMR', name, uploadedAt: '2026-09-20T10:00:00Z', deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: [], dataUrl: `data:application/pdf;base64,${btoa(name)}` }) as Document;

// W39 = 21–27.09.2026, W40 = 28.09–04.10.2026
const LOADS = [
  load('L39a', '2026-09-24'), load('L39b', '2026-09-27'),
  load('L40', '2026-09-28'),
  load('L38u', '2026-09-30', { status: 'DELIVERED', unloadedAt: '2026-09-18T09:00:00Z' } as Partial<Load>),
];
const DOCS = [doc('d1', 'L39a', 'cmr1.pdf'), doc('d2', 'L39b', 'cmr2.pdf'), doc('d3', 'L40', 'cmr3.pdf'), doc('d4', 'L38u', 'pod.pdf'), doc('d5', '', 'luzem.pdf')];

describe('I-2k — tydzień transportu i wybór dokumentów', () => {
  it('tydzień = rozładunek, a przed nim planowana dostawa (niedziela 27.09 → W39, poniedziałek 28.09 → W40)', () => {
    expect(LOADS.map(loadWeekKey)).toEqual(['2026-W39', '2026-W39', '2026-W40', '2026-W38']);
    expect(weeksWithLoads(LOADS)).toEqual(['2026-W38', '2026-W39', '2026-W40']);
  });
  it('domyślnie bieżący tydzień z transportami, inaczej najbliższy następny, inaczej ostatni', () => {
    const w = weeksWithLoads(LOADS);
    expect(defaultDocWeek(w, new Date('2026-09-25T10:00:00Z'))).toBe('2026-W39');
    expect(defaultDocWeek(['2026-W38', '2026-W41'], new Date('2026-09-25T10:00:00Z'))).toBe('2026-W41');
    expect(defaultDocWeek(['2026-W30'], new Date('2026-09-25T10:00:00Z'))).toBe('2026-W30');
    expect(defaultDocWeek([], new Date())).toBe('');
  });
  it('dokumenty wyłącznie z transportów tygodnia; dokument bez transportu — nigdy', () => {
    expect(docsForWeek(DOCS, LOADS, '2026-W39').map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(docsForWeek(DOCS, LOADS, '2026-W40').map((d) => d.id)).toEqual(['d3']);
    expect(docsForWeek(DOCS, LOADS, '2026-W38').map((d) => d.id)).toEqual(['d4']);
    expect(docsForWeek(DOCS, LOADS, '2026-W41')).toEqual([]);
  });
  it('plik ZIP paczki W39 zawiera tylko 2 dokumenty W39', async () => {
    let blob: Blob | null = null;
    vi.stubGlobal('document', { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } });
    const createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: () => {} }));
    const r = await downloadDocumentsZip(docsForWeek(DOCS, LOADS, '2026-W39'), 'WATCH_TOWER_dokumenty_2026-W39.zip');
    vi.unstubAllGlobals();
    expect(r).toEqual({ count: 2, skipped: 0 });
    const zip = await JSZip.loadAsync(await (blob as unknown as Blob).arrayBuffer());
    const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir).sort();
    expect(files).toEqual(['documents/L39a/CMR_cmr1.pdf', 'documents/L39b/CMR_cmr2.pdf']);
  });
  it('widok dokumentów: paczka z docsForWeek i nazwą pliku z tygodniem (nie cała lista)', async () => {
    const src = (await import('node:fs')).readFileSync('src/views/DocsView.tsx', 'utf8');
    expect(src).toContain('downloadDocumentsZip(docsForWeek(documents, loads, week), `WATCH_TOWER_dokumenty_${week}.zip`)');
    expect(src).not.toContain("downloadDocumentsZip(documents,");
  });
});
