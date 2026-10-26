import { describe, expect, it } from 'vitest';
import {
  groupPreview, isMissingRpc, kshPreviewFromRpc, previewCounts, previewKindCodes, previewNotes, previewReadAt,
  previewTotal, previewValue,
} from '../src/lib/kshPreviewView';

const raw = {
  read_at: '2026-10-26T07:05:00Z',
  bytes: 123,
  hash: 'abc',
  n: 7,
  changes: [
    { code: 'SG-10', load_id: 'l10', field: 'load_date', field_label: 'Data załadunku', wt: '27.10.2026', file: '28.10.2026', manual_after_import: false },
    { code: 'SG-07', load_id: 'l7', field: 'driver', field_label: 'Kierowca', wt: 'Kierowca A', file: null, manual_after_import: true },
    { code: 'SG-07', load_id: null, field: 'tractor', field_label: 'Ciągnik', wt: '', file: 'AB 12345', manual_after_import: false, pending_write: true },
    { code: 'SG-9', load_id: null, field: 'qty', field_label: 'Ilość', wt: '2', file: '3', manual_after_import: true },
    { code: 'SG-20', load_id: null, kind: 'added', field: null, wt: null, file: null, manual_after_import: false },
    { code: 'SG-03', load_id: 'l3', kind: 'missing', field: '', wt: null, file: null, manual_after_import: false },
    { code: 'SG-03', load_id: 'l3', kind: 'missing', field: '', wt: null, file: null, manual_after_import: false },
    { code: '', field: 'x' },
    { code: 'SG-11', field: null },
  ],
};

describe('W-567 lista zmian z pliku KSH', () => {
  const p = kshPreviewFromRpc(raw)!;

  it('odczyt RPC: null i zły kształt → null; pomija wiersze bez kodu/pola', () => {
    expect(kshPreviewFromRpc(null)).toBeNull();
    expect(kshPreviewFromRpc({ n: 1 })).toBeNull();
    expect(p.changes).toHaveLength(7);
    expect(p.changes[0].kind).toBe('changed');
    expect(p.changes[2].pendingWrite).toBe(true);
    expect(p.changes[0].pendingWrite).toBe(false);
    expect(p.n).toBe(7);
  });

  it('grupuje po kodzie (naturalnie), pola w kolejności z RPC, bez added/missing', () => {
    const g = groupPreview(p.changes);
    expect(g.map((x) => x.code)).toEqual(['SG-07', 'SG-9', 'SG-10']);
    expect(g[0].rows.map((r) => r.field)).toEqual(['driver', 'tractor']);
    expect(g[0].loadId).toBe('l7');
  });

  it('filtr „tylko poprawione ręcznie”', () => {
    const g = groupPreview(p.changes, true);
    expect(g.map((x) => x.code)).toEqual(['SG-07', 'SG-9']);
    expect(g[0].rows).toHaveLength(1);
  });

  it('liczniki: transporty i pola tylko zmian pól; nowe i brakujące osobno', () => {
    const c = previewCounts(p.changes);
    expect(c).toEqual({ transports: 3, fields: 4, manual: 2, pending: 1, added: 1, missing: 1 });
    expect(previewTotal(c)).toBe(6);
  });

  it('kody nowe w pliku i brakujące w pliku — bez powtórzeń', () => {
    expect(previewKindCodes(p.changes, 'added')).toEqual([{ code: 'SG-20', loadId: null }]);
    expect(previewKindCodes(p.changes, 'missing')).toEqual([{ code: 'SG-03', loadId: 'l3' }]);
  });

  it('uwagi: ręczne i czekające na zapis', () => {
    expect(previewNotes(p.changes[1])).toEqual(['manual']);
    expect(previewNotes(p.changes[2])).toEqual(['pending']);
    expect(previewNotes(p.changes[0])).toEqual([]);
  });

  it('puste wartości jako „—”, czas odczytu w Europe/Warsaw', () => {
    expect(previewValue(null)).toBe('—');
    expect(previewValue('  ')).toBe('—');
    expect(previewValue('AB 1')).toBe('AB 1');
    expect(previewReadAt('2026-10-26T07:05:00Z')).toBe('26.10.2026, 08:05');
    expect(previewReadAt(null)).toBe('—');
  });

  it('brak funkcji w bazie rozpoznany', () => {
    expect(isMissingRpc('Could not find the function public.ksh_sync_preview_get without parameters')).toBe(true);
    expect(isMissingRpc('PGRST202')).toBe(true);
    expect(isMissingRpc('permission denied')).toBe(false);
  });
});
