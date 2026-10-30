/** W-topbar-promy (właściciel 30.10, 15:48): pasek promów na komputerze i rozmyte tło na telefonie. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('W-topbar-promy', () => {
  it('komputer: jeden rejs w pasku + „+N” z listą (bez stosu wszystkich rejsów)', () => {
    const src = read('src/components/shell/Topbar.tsx');
    expect(src).toMatch(/function OpsFerries/);
    expect(src).toMatch(/<OpsFerries rows=\{ops\.ferryRows\} \/>/);
    expect(src).not.toMatch(/ops\.ferryRows\.map/);
    expect(src).toMatch(/data-ops-more/);
  });
  it('telefon: tło dzwonka (`bell-scrim`) przy liście promów i menu konta, bez przycisku „✕”', () => {
    expect(read('src/components/shell/Topbar.tsx')).toMatch(/className="bell-scrim"[^>]*data-top-scrim="ferry"/);
    const acc = read('src/components/shell/AccountMenu.tsx');
    expect(acc).toMatch(/className="bell-scrim"[^>]*data-top-scrim="account"/);
    expect(acc).not.toMatch(/bell-x/);
    const css = read('src/index.css');
    expect(css).toMatch(/\.ferry-chip-wrap \.ferry-chip\[aria-expanded="true"\],\.acc-wrap \.acc-chip\[aria-expanded="true"\]\{position:relative;z-index:56\}/);
  });
});
