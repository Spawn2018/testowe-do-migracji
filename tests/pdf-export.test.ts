/** I-24 — eksport harmonogramu do PDF: poprawny plik, polskie znaki (czcionka osadzona), stronicowanie, bez danych kierowcy i kwot. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildLoadsPdf, PDF_COLUMNS, pdfColumns } from '../src/lib/pdfExport';
import { tp } from '../src/i18n/messages';
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
  it('10.8: nagłówki i status w języku interfejsu (PL/EN/SV), bez surowych kodów statusu', () => {
    const l = { ...buildSeedLoads()[0], status: 'IN_TRANSIT_PL' as const, stage: 'TO_PORT' as const };
    const val = (loc: 'pl' | 'en' | 'sv', i: number) => pdfColumns(loc)[i];
    expect(val('pl', 3).label).toBe('Załadunek');
    expect(val('en', 3).label).toBe('Loading');
    expect(val('sv', 3).label).toBe('Lastning');
    for (const loc of ['pl', 'en', 'sv'] as const) {
      const s = val(loc, 2).value(l);
      expect(s, loc).toBeTruthy();
      expect(s, loc).not.toBe('IN_TRANSIT_PL');
    }
    expect(val('en', 2).value(l)).not.toBe(val('pl', 2).value(l));
  });
  it('10.8: czasy wg D8 — załadunek Europe/Warsaw, ETA Boden Europe/Stockholm, dni kalendarzowe bez przesunięcia', () => {
    const l = { ...buildSeedLoads()[0], plannedLoadDate: '2026-10-01', plannedDeliverDate: '2026-10-05', etaBoden: '2026-10-05T08:30:00Z' };
    const c = pdfColumns('pl');
    expect(c[3].value(l)).toBe('01.10.2026');
    expect(c[4].value(l)).toBe('05.10.2026');
    expect(c[5].value(l)).toMatch(/05\.10\.2026,? 10:30/);
    expect(c[5].value({ ...l, etaBoden: null })).toBe('');
  });
  it('10.8: stopka i tytuł w PL/EN/SV ze strefą Europe/Warsaw; PDF budowany w każdym języku', async () => {
    for (const loc of ['pl', 'en', 'sv'] as const) {
      const f = tp(loc, 'i24_pdf_footer', { at: '28.09.2026, 11:30', tz: 'Europe/Warsaw', n: '3', p: '1', pages: '2' });
      expect(f).toContain('Europe/Warsaw');
      expect(f).toContain('1/2');
      const title = tp(loc, 'i24_pdf_title', { n: '3' });
      const doc = await PDFDocument.load(await buildLoadsPdf(buildSeedLoads().slice(0, 3), font, { title, locale: loc }));
      expect(doc.getTitle()).toBe(title);
    }
    expect(tp('en', 'i24_pdf_footer', { at: 'x', tz: 'Europe/Warsaw', n: '1', p: '1', pages: '1' })).not.toMatch(/[ąćęłńóśźż]/i);
  });
});
