/** III-12 / SCOPE 11.5 — wiersz klikalny jest też obsługiwany klawiaturą (Tab + Enter/Spacja). */
import { describe, it, expect, vi } from 'vitest';
import { clickableRow } from '../src/lib/clickableRow';

const ev = (key: string, same = true) => {
  const el = {};
  return { key, target: el, currentTarget: same ? el : {}, preventDefault: vi.fn() } as never;
};

describe('clickableRow', () => {
  it('fokus klawiaturą i ta sama akcja dla kliknięcia', () => {
    const fn = vi.fn();
    const p = clickableRow(fn);
    expect(p.tabIndex).toBe(0);
    p.onClick();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('Enter i Spacja wywołują akcję, inne klawisze nie', () => {
    const fn = vi.fn();
    const p = clickableRow(fn);
    p.onKeyDown(ev('Enter')); p.onKeyDown(ev(' ')); p.onKeyDown(ev('a')); p.onKeyDown(ev('Tab'));
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('klawisze z pola wewnątrz wiersza są ignorowane', () => {
    const fn = vi.fn();
    clickableRow(fn).onKeyDown(ev('Enter', false));
    expect(fn).not.toHaveBeenCalled();
  });
});
