/**
 * wyglad/P7-b — „Zestaw z ładunkiem” › „Zmień” (E32 pkt 7, E9 D-83).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkSet, setFieldValue } from '../src/lib/p7bSet';
import { saveSetOf } from '../src/lib/p7Source';

describe('P7-b — zestaw z ładunkiem', () => {
  it('przecinek albo kropka, metry', () => {
    expect(checkSet('21,69', '2.45', '3,75')).toEqual({ ok: true, set: { l: 21.69, w: 2.45, h: 3.75 } });
    expect(checkSet(' 21,7 ', '2,45', '3,8')).toEqual({ ok: true, set: { l: 21.7, w: 2.45, h: 3.8 } });
  });
  it('zły zapis → „Podaj trzy wymiary…” i tylko złe pola', () => {
    expect(checkSet('', '2,45', '3,75')).toEqual({ ok: false, error: 'fmt', bad: ['l'] });
    expect(checkSet('21,695', '2,45', '3,75')).toEqual({ ok: false, error: 'fmt', bad: ['l'] });
    expect(checkSet('21,', '-2', '3,75')).toEqual({ ok: false, error: 'fmt', bad: ['l', 'w'] });
    expect(checkSet('21,69 m', '2,45', '3 ,75')).toEqual({ ok: false, error: 'fmt', bad: ['l', 'h'] });
  });
  it('wymiar spoza granic → komunikat z granicami', () => {
    expect(checkSet('4,5', '2,45', '3,75')).toEqual({ ok: false, error: 'range', bad: ['l'] });
    expect(checkSet('21,69', '2,45', '6,2')).toEqual({ ok: false, error: 'range', bad: ['h'] });
    expect(checkSet('2169', '0,5', '3,75')).toEqual({ ok: false, error: 'range', bad: ['l', 'w'] });
  });
  it('bez porównania z ładunkiem (wymiary ładunku bywają wzięte z zestawu) — mniejszy zestaw przechodzi', () => {
    expect(checkSet('13,6', '2,45', '3,1').ok).toBe(true);
  });
  it('wartość pola z przecinkiem', () => {
    expect(setFieldValue(21.69)).toBe('21,69');
    expect(setFieldValue(3.4)).toBe('3,4');
    expect(setFieldValue(null)).toBe('');
  });
  it('„Zmień” tylko dla HHL (Administrator i Operacje — E9); KSH i SCX bez przycisku', () => {
    expect(saveSetOf('HHL')).not.toBeNull();
    expect(saveSetOf('KSH')).toBeNull();
    expect(saveSetOf('SCX')).toBeNull();
  });
  it('Escape w formularzu nie zamyka panelu transportu', () => {
    const src = readFileSync('src/components/drawer/PanelOverview.tsx', 'utf8');
    expect(src).toMatch(/e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\);/);
  });
});
