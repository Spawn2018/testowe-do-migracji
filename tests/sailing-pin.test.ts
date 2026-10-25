/** #557 cz. 2 — „Przypnij rejs” w karcie transportu (tylko Administrator HHL, przy ostrzeżeniu o złym rejsie). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canPinSailing, hasOpenMismatch, proposedText, suggestFromRpc } from '../src/lib/sailingPin';
import type { Risk, Sailing } from '../src/types';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const risk = (loadId: string, titleKey: string): Risk => ({
  id: `r-${loadId}-${titleKey}`, type: 'FERRY' as Risk['type'], severity: 'HIGH' as Risk['severity'], title: '', detail: '',
  loadId, owner: 'HHL', meta: '', nextAction: '', ageHours: 0, titleKey,
});

const sail: Sailing = {
  id: 's-wawel', vessel: 'Wawel', route: 'GDN-NYN' as Sailing['route'],
  departureAt: '2026-10-24T16:00:00Z', arrivalAt: '2026-10-25T06:00:00Z',
  delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY' as Sailing['status'], source: 'POLFERRIES',
};

describe('Przypnij rejs', () => {
  it('ostrzeżenie dotyczy tylko tego transportu i tylko klucza złego rejsu', () => {
    const rs = [risk('L1', 'rk_sailing_mismatch'), risk('L2', 'rk_sailing_cancelled')];
    expect(hasOpenMismatch(rs, 'L1')).toBe(true);
    expect(hasOpenMismatch(rs, 'L2')).toBe(false);
    expect(hasOpenMismatch(rs, 'L3')).toBe(false);
  });

  it('przycisk: Administrator, własny widok, otwarte ostrzeżenie — wszystkie trzy naraz', () => {
    expect(canPinSailing({ admin: true, readOnly: false, mismatch: true })).toBe(true);
    expect(canPinSailing({ admin: false, readOnly: false, mismatch: true })).toBe(false);
    expect(canPinSailing({ admin: true, readOnly: true, mismatch: true })).toBe(false);
    expect(canPinSailing({ admin: true, readOnly: false, mismatch: false })).toBe(false);
  });

  it('odpowiedź RPC: tylko pola kontraktu; błąd → brak propozycji', () => {
    expect(suggestFromRpc({ ok: true, mismatch: true, assigned_sailing_id: 'a', proposed_sailing_id: 's-wawel', proposed_label: 'Wawel 24.10 16:00' }))
      .toEqual({ mismatch: true, assignedSailingId: 'a', proposedSailingId: 's-wawel', proposedLabel: 'Wawel 24.10 16:00' });
    expect(suggestFromRpc({ ok: false, reason: 'unknown_load' })).toBeNull();
    expect(suggestFromRpc(null)).toBeNull();
    expect(suggestFromRpc({ ok: true, mismatch: true, proposed_sailing_id: '' })?.proposedSailingId).toBeNull();
  });

  it('nazwa rejsu: z rozkładu w czasie polskim; poza rozkładem — etykieta bazy z dopiskiem UTC', () => {
    const s = { mismatch: true, assignedSailingId: null, proposedSailingId: 's-wawel', proposedLabel: 'Wawel 24.10 16:00' };
    expect(proposedText(s, [sail])).toMatch(/^Wawel · .*24\.10.*18:00/);
    expect(proposedText(s, [])).toBe('Wawel 24.10 16:00 UTC');
    expect(proposedText({ ...s, proposedSailingId: null }, [sail])).toBeNull();
  });

  it('RPC i potwierdzenie w karcie (bez okien przeglądarki)', () => {
    const lib = read('src/lib/sailingPin.ts');
    expect(lib).toMatch(/rpc\('sailing_mismatch_suggest', \{ p_load_id: loadId \}\)/);
    expect(lib).toMatch(/rpc\('sailing_mismatch_assign', \{ p_load_id: loadId, p_sailing_id: sailingId \}\)/);
    const c = read('src/components/drawer/SailingPin.tsx');
    expect(c).not.toMatch(/window\.confirm|confirm\(\s*['"`]/);
    expect(c).toMatch(/refreshFromServer\(\{ keepSelection: true \}\)/);
    const po = read('src/components/drawer/PanelOverview.tsx');
    expect(po).toMatch(/canPinSailing\(\{ admin: hhlAdminDates\(role\), readOnly: isPreviewReadOnly\(\{ viewRole: role \}\), mismatch: hasOpenMismatch\(risks, load\.id\) \}\)/);
  });
});
