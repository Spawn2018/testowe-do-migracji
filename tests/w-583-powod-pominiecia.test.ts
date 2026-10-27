import { describe, expect, it } from 'vitest';
import { kshPreviewFromRpc, previewNotes } from '../src/lib/kshPreviewView';

/** #583 / #586 — lista zmian KSH pokazuje, dlaczego import NIE zapisze wartości z pliku (`skip_reason`). */
describe('W-583 powód pominięcia w liście zmian KSH', () => {
  const p = kshPreviewFromRpc({
    read_at: '2026-10-27T11:20:00Z',
    bytes: 1,
    hash: 'h',
    n: 4,
    changes: [
      { kind: 'changed', code: 'BS-01', load_id: 'a', field: 'trailer_plate', field_label: 'Tablica naczepy', wt: null, file: 'PLAT', skip_reason: 'wartość w pliku nie jest tablicą — pominięta' },
      { kind: 'changed', code: 'SG-05', load_id: 'b', field: 'total_weight_t', field_label: 'Waga całkowita', wt: '20.74', file: null, skip_reason: '  pusta komórka w pliku — pominięta ' },
      { kind: 'changed', code: 'SG-06', load_id: 'c', field: 'load_date', field_label: 'Data załadunku', wt: '2026-10-27', file: '2026-10-28', skip_reason: '' },
      { kind: 'changed', code: 'SG-07', load_id: 'd', field: 'driver_name', field_label: 'Kierowca', wt: 'A', file: 'B', manual_after_import: true, skip_reason: null },
    ],
  })!;

  it('odczyt skip_reason: tekst przycięty; pusty i brak → null', () => {
    expect(p.changes.map((c) => c.skipReason)).toEqual([
      'wartość w pliku nie jest tablicą — pominięta',
      'pusta komórka w pliku — pominięta',
      null,
      null,
    ]);
  });

  it('uwagi: „skip” tylko przy powodzie, razem z innymi znacznikami', () => {
    expect(previewNotes(p.changes[0])).toEqual(['skip']);
    expect(previewNotes(p.changes[2])).toEqual([]);
    expect(previewNotes(p.changes[3])).toEqual(['manual']);
    expect(previewNotes({ manualAfterImport: true, pendingWrite: true, skipReason: 'x' })).toEqual(['manual', 'pending', 'skip']);
  });
});
