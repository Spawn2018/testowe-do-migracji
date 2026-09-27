/** I-24 — eksport harmonogramu do PDF: poprawny plik, polskie znaki (czcionka osadzona), stronicowanie, bez danych kierowcy i kwot. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildLoadsPdf, PDF_COLUMNS } from '../src/lib/pdfExport';
import { buildSeedLoads } from '../src/data/seed';

const font = readFileSync('public/fonts/LiberationSans-Regular.ttf');

describe('I-24 eksport PDF', () => {
  it('350 transportów → PDF A4 poziomo, wiele stron, tytuł z polskimi znakami', async () => {
    const base = buildSeedLoads();
    const loads = Array.from({ length: 350 }, (_, i) => ({ ...base[i % base.length], code: `SG-${String(i).padStart(3, '0')}-Łódź` }));
    const bytes = await buildLoadsPdf(loads, font, { title: 'TOWER — harmonogram zażółć gęślą jaźń', generatedAt: new Date('2026-09-28T00:00:00Z') });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(10);
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect(w).toBeGreaterThan(h);
    expect(doc.getTitle()).toContain('zażółć');
  });
  it('kolumny bez danych osobowych kierowcy i bez kwot', () => {
    const labels = PDF_COLUMNS.map((c) => c.label.toLowerCase()).join('|');
    expect(labels).not.toMatch(/kierowca|telefon|koszt|przych|marż|pln|eur/);
  });
  it('pusta lista → jedna strona z nagłówkiem', async () => {
    const doc = await PDFDocument.load(await buildLoadsPdf([], font, { title: 'pusty' }));
    expect(doc.getPageCount()).toBe(1);
  });
});
