/**
 * #384 — skutki rozstrzygnięć decyzji w Historii po polsku (DECISION_EFFECT / HOLD / SAILING / KEEP_TOWER),
 * z wybraną opcją i komentarzem; wcześniej „Zmiana w transporcie”.
 */
import { describe, expect, it } from 'vitest';
import type { LoadEvent } from '../src/types';
import { histCat, histRow, visibleFor } from '../src/lib/p6History';

const ev = (type: string, payload: Record<string, unknown>): LoadEvent => ({
  id: type, loadId: 'L', type, at: '2026-10-21T10:00:00Z', actor: 'Jan Kowalski // SCX', payload,
}) as unknown as LoadEvent;

describe('#384 — Historia: rozstrzygnięcia decyzji', () => {
  it('Przyjmuję z komentarzem', () => {
    const r = histRow(ev('DECISION_EFFECT', { option: 'ACCEPT', note: 'ok, jedziemy', effect: 'ACCEPT' }), 'pl');
    expect(r.head).toBe('Decyzja rozstrzygnięta');
    expect(r.tail).toBe('Przyjmuję · ok, jedziemy');
  });
  it('Proponuję inny termin, wartość z Watch Tower, wstrzymanie, rejs', () => {
    expect(histRow(ev('DECISION_EFFECT', { option: 'PROPOSE_DATE', note: '23.10 rano' }), 'pl').tail).toBe('Proponuję inny termin · 23.10 rano');
    expect(histRow(ev('DECISION_KEEP_TOWER', { detail: {} }), 'pl').head).toBe('Decyzja: zostaje wartość z Watch Tower');
    expect(histRow(ev('DECISION_HOLD', { option: 'STILL_EN_ROUTE', note: 'w drodze' }), 'pl').head).toBe('Decyzja wstrzymana');
    expect(histRow(ev('DECISION_SAILING', { option: 'NEXT_SAME' }), 'pl').head).toBe('Decyzja: zmiana rejsu');
  });
  it('nie „Zmiana w transporcie”', () => {
    for (const t of ['DECISION_EFFECT', 'DECISION_HOLD', 'DECISION_SAILING', 'DECISION_KEEP_TOWER']) {
      expect(histRow(ev(t, {}), 'pl').head).not.toBe('Zmiana w transporcie');
    }
  });
  it('F7 #387: KSH nie widzi decyzji; SCX tylko rozstrzygnięcia SCX; HHL wszystkie', () => {
    const scx = { ...ev('DECISION_EFFECT', { option: 'ACCEPT', note: 'x' }), actor: 'Jan Kowalski // SCX' } as LoadEvent;
    const hhl = { ...ev('DECISION_EFFECT', { option: 'DISPUTE', note: 'spór' }), actor: 'Anna Nowak // HHL' } as LoadEvent;
    expect(histCat('DECISION_HOLD')).toBe('DECYZJA');
    expect(visibleFor(scx, 'KSH')).toBe(false);
    expect(visibleFor(hhl, 'KSH')).toBe(false);
    expect(visibleFor(scx, 'SCX')).toBe(true);
    expect(visibleFor(hhl, 'SCX')).toBe(false);
    expect(visibleFor(hhl, 'HHL')).toBe(true);
  });
});
