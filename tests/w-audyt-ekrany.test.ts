// wyglad/W-audyt-ekrany (właściciel 21.10.2026, 20:14, pkt 2): ekrany Finanse, Faktury, Dokumenty
// zgodne z obrazami raportu audytu (E4 img/e4-after, E31 img/e31-after).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('E4: Faktury', () => {
  it('„Kto co widzi i co robi”: nagłówek wiersza do lewej, z odstępem i linią jak komórki', () => {
    const css = read('src/components/finance/finance.css');
    const rule = /\.fin-table tbody th\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/text-align:left/);
    expect(rule).toMatch(/padding:9px 10px/);
    expect(rule).toMatch(/border-bottom:1px solid var\(--rule-2\)/);
  });
  it('wiersz „jeszcze nie wystawiona”: netto, VAT i brutto tym samym krojem co wiersze faktur', () => {
    const src = read('src/views/BillsPanel.tsx');
    const at = src.indexOf('<tr key={w.weekKey} data-bill-pending={w.weekKey}>');
    const row = src.slice(at, src.indexOf('<StatusTag status="DO_WYSTAWIENIA"', at));
    expect(row.match(/<span className="mono">/g)?.length).toBe(3);
    expect(row).not.toMatch(/<b>\{formatPlNumber/);
  });
});

describe('E31: Dokumenty › Wymagania przy transporcie', () => {
  it('„Kto wgrywa” i „Termin” w jednej linii — łamią się tylko „Uwagi”', () => {
    const css = read('src/components/docs/docs.css');
    const rule = /([^\n{}]*)\{white-space:nowrap\}/.exec(css.slice(css.indexOf('.doc-req td:first-child')))?.[1] ?? '';
    for (const n of [2, 3, 4, 5]) expect(rule).toContain(`.doc-req td:nth-child(${n})`);
    expect(rule).not.toContain('nth-child(6)');
  });
});
