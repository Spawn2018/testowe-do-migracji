/**
 * P11 pkt 6 (paczka B, e17 / e25; POROWNANIE P11-zgodnosc, „Dane demo”): w demo transporty na placu, rozładowane
 * i dostarczone mają zdarzenia strefy placu jak z silnika stref — wjazd („Na placu” z automatu), postój potwierdzony
 * po 15 min, wyjazd w chwili rozładunku („Wyjazd z placu po 3 h 44 min”).
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { statusHits } from '../src/lib/statusAxis';
import { deliveredCheckFromEvents } from '../src/lib/p4cSource';

describe('demo — zdarzenia strefy placu', () => {
  const snap = buildDemoSnapshot();
  const evs = (id: string) => snap.events.filter((e) => e.loadId === id);
  const site = (id: string, type: string) => evs(id).filter((e) => e.type === type && (e.payload as { geofence_id?: string } | undefined)?.geofence_id === 'gf-11');

  it('dostarczone i rozładowane: wjazd → postój po 15 min → wyjazd w chwili rozładunku; „Na placu” przed „Dostarczone”', () => {
    const done = snap.loads.filter((l) => l.status === 'DELIVERED' || l.status === 'UNLOADING');
    expect(done.length).toBeGreaterThan(5);
    for (const l of done) {
      const [enter] = site(l.id, 'GEOFENCE_ENTER');
      const [dwell] = site(l.id, 'GEOFENCE_DWELL');
      const [exit] = site(l.id, 'GEOFENCE_EXIT');
      expect(enter && dwell && exit, l.code).toBeTruthy();
      expect(Date.parse(dwell.at) - Date.parse(enter.at), l.code).toBe(15 * 60_000);
      expect(Date.parse(exit.at), l.code).toBe(Date.parse(l.unloadedAt!));
      expect((exit.payload as { dwell_min: number }).dwell_min, l.code).toBeGreaterThanOrEqual(180);
      const hits = statusHits(evs(l.id));
      const at = (s: string) => hits.find((h) => h.status === s)?.at;
      expect(Date.parse(at('APPROACHING_SITE')!), l.code).toBeLessThan(Date.parse(at('DELIVERED')!));
      /* długi postój — bez sprawy „czy dostarczono?” */
      expect(deliveredCheckFromEvents(l, snap.events, snap.geofences, 'HHL'), l.code).toBeNull();
    }
  });

  it('na placu (T-12): wjazd 15:10, postój potwierdzony 15:25, bez wyjazdu', () => {
    const t12 = snap.loads.find((l) => l.code === 'T-12')!;
    expect(t12.status).toBe('APPROACHING_SITE');
    expect(Date.parse(site(t12.id, 'GEOFENCE_ENTER')[0].at)).toBe(Date.parse('2026-09-23T15:10:00+02:00'));
    expect(Date.parse(site(t12.id, 'GEOFENCE_DWELL')[0].at)).toBe(Date.parse('2026-09-23T15:25:00+02:00'));
    expect(site(t12.id, 'GEOFENCE_EXIT')).toHaveLength(0);
  });
});
