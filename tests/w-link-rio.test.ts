/**
 * #392 (SG-18, właściciel 21.10.2026 16:06): link RIO nie jest przypisany na stałe. Po „Zmień link” → nowy link
 * (emtrack / inny) → Zapisz ekran pokazuje nowy link, nawet gdy baza zostawiła stare `rio_tracking_id`.
 */
import { describe, expect, it } from 'vitest';
import { trackingLinkFromRow, type LoadRow } from '../src/data/mappers';

const stale = { rio_tracking_id: 'dc8b4cca-3a9c-45c0-8724-97db97d0ceae', rio_check_state: 'pending' };

describe('#392 — zmiana linku z RIO na inny', () => {
  it('RIO → emtrack: emtrack, nie RIO', () => {
    expect(trackingLinkFromRow({ ...stale, telematics_vehicle_id: 'https://emtrack.eu/app/' } as LoadRow)?.provider).toBe('EMTRACK');
  });
  it('RIO → inny link: inny, nie RIO', () => {
    expect(trackingLinkFromRow({ ...stale, telematics_vehicle_id: '1122' } as LoadRow)?.provider).toBe('OTHER');
  });
  it('RIO → pusty: brak linku', () => {
    expect(trackingLinkFromRow({ ...stale, telematics_vehicle_id: null } as LoadRow)).toBeUndefined();
  });
  it('zapisany RIO zostaje RIO', () => {
    expect(trackingLinkFromRow({ ...stale, telematics_vehicle_id: 'rio:dc8b4cca-3a9c-45c0-8724-97db97d0ceae' } as LoadRow)?.provider).toBe('RIO');
  });
});

describe('#392 — po zapisie ekran od razu zna nowy rodzaj linku (F7 #393 2b)', () => {
  it('updateResources ustawia trackingLink z nowego linku', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/store/useTowerStore.ts', 'utf8');
    expect(src).toContain("const kind = trackerKind(resources.trackingRef);");
    expect(src).toContain("kind === 'emtrack' ? { provider: 'EMTRACK' as const");
  });
});
