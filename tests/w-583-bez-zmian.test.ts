import { describe, expect, it } from 'vitest';
import { isNoopChange, kshPreviewFromRpc, sameValueKey } from '../src/lib/kshPreviewView';

/** #583 — panel listy zmian KSH ukrywa „zmiany”, w których Watch Tower i plik mają tę samą wartość. */
describe('W-583 lista zmian KSH bez fałszywych zmian', () => {
  const raw = {
    read_at: '2026-10-27T00:45:00Z',
    bytes: 1,
    hash: 'h',
    n: 6,
    changes: [
      { kind: 'changed', code: 'BS-01', load_id: 'a', field: 'hhl_order_no', field_label: 'Numer HHL–KSH', wt: '0035/10/S/2026', file: '0035/10/S/2026' },
      { kind: 'changed', code: 'SG-01', load_id: 'b', field: 'tractor_plate', field_label: 'Tablica ciągnika (PL)', wt: 'WPR6303P', file: ' wpr6303p ' },
      { kind: 'changed', code: 'SG-02', load_id: 'c', field: 'trailer_plate', field_label: 'Tablica naczepy', wt: 'GD  9792X', file: 'GD 9792X' },
      { kind: 'changed', code: 'BS-01', load_id: 'a', field: 'trailer_plate', field_label: 'Tablica naczepy', wt: null, file: 'PLAT' },
      { kind: 'changed', code: 'SG-03', load_id: 'd', field: 'load_date', field_label: 'Data załadunku', wt: '2026-10-27', file: '2026-10-28' },
      { kind: 'missing', code: 'SG-04', load_id: 'e', field: '', wt: null, file: null },
    ],
  };

  it('klucz porównania: trim, pojedyncze spacje, wielkość liter; pusty = brak', () => {
    expect(sameValueKey(' gd  9792x ')).toBe('GD 9792X');
    expect(sameValueKey(null)).toBe('');
    expect(sameValueKey('')).toBe(sameValueKey(undefined));
  });

  it('noop tylko dla changed z tą samą wartością', () => {
    expect(isNoopChange({ kind: 'changed', wt: 'A', file: 'a' })).toBe(true);
    expect(isNoopChange({ kind: 'changed', wt: null, file: '' })).toBe(true);
    expect(isNoopChange({ kind: 'changed', wt: null, file: 'PLAT' })).toBe(false);
    expect(isNoopChange({ kind: 'missing', wt: null, file: null })).toBe(false);
    expect(isNoopChange({ kind: 'added', wt: null, file: null })).toBe(false);
  });

  it('odczyt RPC pomija 3 fałszywe zmiany, zostawia prawdziwe i missing; licznik bez nich', () => {
    const p = kshPreviewFromRpc(raw)!;
    expect(p.changes.map((c) => `${c.code}:${c.field || c.kind}`)).toEqual([
      'BS-01:trailer_plate',
      'SG-03:load_date',
      'SG-04:missing',
    ]);
    expect(p.n).toBe(3);
  });

  it('tylko fałszywe zmiany → pusta lista i licznik 0', () => {
    const p = kshPreviewFromRpc({ ...raw, n: 1, changes: [raw.changes[0]] })!;
    expect(p.changes).toHaveLength(0);
    expect(p.n).toBe(0);
  });
});
