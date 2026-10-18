/**
 * P11 pkt 6 (paczka B, e17 / e25; POROWNANIE P11-zgodnosc, „Dane demo”): w demo transporty na placu, rozładowane
 * i dostarczone mają zdarzenia strefy placu jak z silnika stref — wjazd na plac
 * („Na placu” z automatu), postój potwierdzony po 15 min, wyjazd w chwili rozładunku („Wyjazd z placu po 3 h 44 min”).
 * Uwagi F7 #304: wjazd przy „Na placu” = „czeka przed placem od …” z bloku ETA; czas na placu = Ceny › Postój · rozładunek;
 * pierwszy „Na placu” (karta „czy dostarczono?”) — wjazd i wyjazd po 6 min; ślad z przewozu nie zaczyna się na placu.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { buildStatusAxis, statusHits } from '../src/lib/statusAxis';
import { deliveredCheckFromEvents, deliveredCheckOf } from '../src/lib/p4cSource';
import { demoDeliveredCheck } from '../src/lib/p4cDemo';
import { demoFeeSuggestions } from '../src/lib/p5Demo';
import { demoHistoryEvents } from '../src/lib/p6bDemo';

const CLOCK = '2026-09-23T16:32:00+02:00';
const MIN = 60_000;

describe('demo — zdarzenia strefy placu', () => {
  const snap = buildDemoSnapshot();
  const evs = (id: string) => snap.events.filter((e) => e.loadId === id);
  const zone = (id: string, type: string, gf = 'gf-11') =>
    evs(id).filter((e) => e.type === type && (e.payload as { geofence_id?: string } | undefined)?.geofence_id === gf);
  const t = (iso: string) => Date.parse(iso);
  const onSite = snap.loads
    .filter((l) => l.status === 'APPROACHING_SITE')
    .sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true }));
  const first = onSite[0];

  it('dostarczone i rozładowane: wjazd → postój po 15 min → wyjazd w chwili rozładunku, 3 h 44 min jak w Cenach', () => {
    const done = snap.loads.filter((l) => l.status === 'DELIVERED' || l.status === 'UNLOADING');
    expect(done.length).toBeGreaterThan(5);
    for (const l of done) {
      const [enter] = zone(l.id, 'GEOFENCE_ENTER');
      const [dwell] = zone(l.id, 'GEOFENCE_DWELL');
      const [exit] = zone(l.id, 'GEOFENCE_EXIT');
      expect(enter && dwell && exit, l.code).toBeTruthy();
      expect(t(dwell.at) - t(enter.at), l.code).toBe(15 * MIN);
      expect(t(exit.at), l.code).toBe(t(l.unloadedAt!));
      expect((exit.payload as { dwell_min: number }).dwell_min, l.code).toBe(224);
      expect(t(exit.at) - t(enter.at), l.code).toBe(224 * MIN);
      /* Ceny › „Postój · rozładunek Boden” — ten sam wjazd, wyjazd i czas */
      const fee = demoFeeSuggestions(l).find((f) => f.kind === 'DWELL' && f.place === 'UNLOAD')!;
      expect(fee.minutes, l.code).toBe(224);
      expect(t(fee.enterAt!), l.code).toBe(t(enter.at));
      expect(t(fee.exitAt!), l.code).toBe(t(exit.at));
      const hits = statusHits(evs(l.id));
      const at = (s: string) => hits.find((h) => h.status === s)?.at;
      expect(t(at('APPROACHING_SITE')!), l.code).toBeLessThan(t(at('DELIVERED')!));
    }
  });

  it('rozładowane: długi postój — bez karty „czy dostarczono?”', () => {
    const unloading = snap.loads.filter((l) => l.status === 'UNLOADING');
    expect(unloading.length).toBeGreaterThan(0);
    for (const l of unloading) {
      expect(zone(l.id, 'GEOFENCE_EXIT'), l.code).toHaveLength(1);
      expect(deliveredCheckFromEvents(l, snap.events, snap.geofences, 'SCX'), l.code).toBeNull();
    }
  });

  it('na placu: wjazd o godzinie „czeka przed placem od …” z bloku ETA (T-12 15:10, T-18 11:40)', () => {
    expect(onSite.length).toBeGreaterThanOrEqual(3);
    for (const l of onSite) {
      const [enter] = zone(l.id, 'GEOFENCE_ENTER');
      expect(t(enter.at), l.code).toBe(t(l.etaDetail!.waitSince!));
      const auto = evs(l.id).find((e) => e.type === 'STATUS_AUTO')!;
      expect(t(auto.at), l.code).toBe(t(enter.at));
    }
    const code = (c: string) => snap.loads.find((l) => l.code === c)!;
    expect(t(zone(code('T-12').id, 'GEOFENCE_ENTER')[0].at)).toBe(t('2026-09-23T15:10:00+02:00'));
    expect(t(zone(code('T-12').id, 'GEOFENCE_DWELL')[0].at)).toBe(t('2026-09-23T15:25:00+02:00'));
    expect(t(zone(code('T-18').id, 'GEOFENCE_ENTER')[0].at)).toBe(t('2026-09-23T11:40:00+02:00'));
    for (const l of onSite.slice(1)) expect(zone(l.id, 'GEOFENCE_EXIT'), l.code).toHaveLength(0);
  });

  it('pierwszy „Na placu” (karta „czy dostarczono?”): wjazd i wyjazd po 6 min, ta sama chwila co na karcie', () => {
    const [enter] = zone(first.id, 'GEOFENCE_ENTER');
    const [exit] = zone(first.id, 'GEOFENCE_EXIT');
    expect(t(exit.at) - t(enter.at)).toBe(6 * MIN);
    expect(zone(first.id, 'GEOFENCE_DWELL')).toHaveLength(0);
    const card = demoDeliveredCheck(first, snap.loads, snap.geofences, CLOCK, 'SCX')!;
    expect(card.minutes).toBe(6);
    expect(t(card.exitAt)).toBe(t(exit.at));
    const fromEvents = deliveredCheckFromEvents(first, snap.events, snap.geofences, 'SCX')!;
    expect(fromEvents.minutes).toBe(6);
    expect(t(fromEvents.exitAt)).toBe(t(card.exitAt));
  });

  it('ślad z przewozu: od „Załadunek · GPS”, nie od wjazdu na plac', () => {
    const withSite = snap.loads.filter((l) => ['APPROACHING_SITE', 'UNLOADING', 'DELIVERED'].includes(l.status));
    for (const l of withSite) {
      const loaded = evs(l.id).find((e) => e.type === 'LOADED')!;
      const axis = buildStatusAxis(l, evs(l.id));
      expect(axis.firstFixAt, l.code).toBe(loaded.at);
      expect(t(axis.firstFixAt!), l.code).toBeLessThan(t(zone(l.id, 'GEOFENCE_ENTER')[0].at));
      if (axis.deliveredAt) expect(t(axis.firstFixAt!), l.code).toBeLessThan(t(axis.deliveredAt));
    }
  });

  /* F7 #304 runda 2: przy zegarze późniejszym niż zegar demo (zdarzenia z przyszłości przestają być odfiltrowane) */
  const LATE = '2026-11-20T11:00:00+01:00';

  it('późniejszy zegar: karta „czy dostarczono?” D-01 z wyjazdu ze strefy (16:07, 6 min), nie „zegar − 25 min”', () => {
    const [exit] = zone(first.id, 'GEOFENCE_EXIT');
    for (const clock of [CLOCK, LATE]) {
      const card = demoDeliveredCheck(first, snap.loads, snap.geofences, clock, 'SCX', snap.events)!;
      expect(t(card.exitAt), clock).toBe(t(exit.at));
      expect(card.minutes, clock).toBe(6);
    }
    /* zegar przed wyjazdem — karty jeszcze nie ma */
    expect(demoDeliveredCheck(first, snap.loads, snap.geofences, '2026-09-23T16:03:00+02:00', 'SCX', snap.events)).toBeNull();
  });

  it('późniejszy zegar: strona szwedzka w Historii (wyjazd z portu, bufor 50 km) przed wjazdem na plac', () => {
    const withSite = snap.loads.filter((l) => ['APPROACHING_SITE', 'UNLOADING', 'DELIVERED'].includes(l.status));
    for (const l of withSite) {
      const hist = demoHistoryEvents(l, LATE);
      const enter = t(zone(l.id, 'GEOFENCE_ENTER')[0].at);
      const portOut = hist.find((e) => e.type === 'STATUS_AUTO' && (e.payload as { to?: string } | undefined)?.to === 'IN_TRANSIT_SE');
      const buffer = hist.find((e) => e.type === 'GEOFENCE_ENTER' && (e.payload as { geofence_id?: string } | undefined)?.geofence_id === 'gf-10');
      expect(portOut && buffer, l.code).toBeTruthy();
      expect(t(portOut!.at), l.code).toBeLessThan(t(buffer!.at));
      expect(t(buffer!.at), l.code).toBeLessThan(enter);
    }
  });

  /* F7 #304 runda 3 (P): karta w panelu idzie przez `deliveredCheckOf` — zdarzenia muszą do niej dojść */
  it('panel: `deliveredCheckOf` przekazuje zdarzenia — karta D-01 z wyjazdu 16:07 także przy zegarze 20.11', () => {
    const [exit] = zone(first.id, 'GEOFENCE_EXIT');
    for (const clock of [CLOCK, LATE]) {
      const card = deliveredCheckOf(first, snap.loads, snap.geofences, clock, 'SCX', snap.events)!;
      expect(t(card.exitAt), clock).toBe(t(exit.at));
      expect(card.minutes, clock).toBe(6);
    }
  });
});
