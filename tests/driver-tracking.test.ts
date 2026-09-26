/** M9 — aplikacja kierowcy: zgoda, próg wysyłki pozycji, zdarzenia etapów (STATUSY_AUTOMATYCZNE §6). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVER_CONSENT_KEY, MAX_ACCURACY_M, distanceM, driverLocaleFrom, milestoneAction, readDriverConsent,
  shouldSendFix, watchDriverPosition, writeDriverConsent, type DriverFix,
} from '../src/lib/driverTracking';
import { useTowerStore, DRIVER_TOKENS } from '../src/store/useTowerStore';
import { registerRemoteSink } from '../src/data/registry';
import type { DataMutation } from '../src/data/provider';

const fix = (o: Partial<DriverFix>): DriverFix => ({ lat: 54.40372, lng: 18.6813, at: '2026-09-26T10:00:00Z', accuracy: 10, speedKmh: 40, heading: 90, ...o });

describe('M9 zgoda i język kierowcy', () => {
  beforeEach(() => localStorage.clear());
  it('pierwsze uruchomienie = brak decyzji; zapis zgody i odmowy', () => {
    expect(readDriverConsent()).toBeNull();
    writeDriverConsent('denied');
    expect(readDriverConsent()).toBe('denied');
    writeDriverConsent('granted');
    expect(localStorage.getItem(DRIVER_CONSENT_KEY)).toBe('granted');
  });
  it('język z telefonu: sv / en, domyślnie pl', () => {
    expect(driverLocaleFrom('sv-SE')).toBe('sv');
    expect(driverLocaleFrom('en-GB')).toBe('en');
    expect(driverLocaleFrom('pl-PL')).toBe('pl');
    expect(driverLocaleFrom('de-DE')).toBe('pl');
    expect(driverLocaleFrom(null)).toBe('pl');
  });
});

describe('M9 próg wysyłki pozycji', () => {
  it('pierwszy fix zawsze; słaby fix nigdy', () => {
    expect(shouldSendFix(null, fix({}))).toBe(true);
    expect(shouldSendFix(null, fix({ accuracy: MAX_ACCURACY_M + 1 }))).toBe(false);
  });
  it('co minutę albo po 150 m (nie częściej niż co 10 s)', () => {
    const a = fix({});
    expect(shouldSendFix(a, fix({ at: '2026-09-26T10:00:30Z' }))).toBe(false); // 30 s, bez ruchu
    expect(shouldSendFix(a, fix({ at: '2026-09-26T10:01:00Z' }))).toBe(true); // 60 s
    expect(shouldSendFix(a, fix({ at: '2026-09-26T10:00:20Z', lat: 54.40572 }))).toBe(true); // ~220 m
    expect(shouldSendFix(a, fix({ at: '2026-09-26T10:00:05Z', lat: 54.40572 }))).toBe(false); // < 10 s
    expect(shouldSendFix(a, fix({ at: '2026-09-26T09:59:00Z' }))).toBe(false); // czas wstecz
  });
  it('odległość w metrach (haversine)', () => {
    expect(Math.round(distanceM({ lat: 54.40372, lng: 18.6813 }, { lat: 54.40372 + 0.001, lng: 18.6813 }))).toBe(111);
  });
  it('watchPosition z wysoką dokładnością; zatrzymanie czyści obserwację; brak API → błąd, nie wyjątek', () => {
    const geo = { watchPosition: vi.fn(() => 7), clearWatch: vi.fn(), getCurrentPosition: vi.fn() } as unknown as Geolocation;
    const stop = watchDriverPosition(() => undefined, () => undefined, geo);
    expect((geo.watchPosition as ReturnType<typeof vi.fn>).mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true });
    stop();
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
    const onErr = vi.fn();
    watchDriverPosition(() => undefined, onErr, undefined);
    expect(onErr).toHaveBeenCalledWith(0, expect.any(String));
  });
});

describe('M9 zdarzenia etapów (§6)', () => {
  it('„Załadowany” → MILESTONE_LOADED bez zmiany statusu; „Rozładowany” → UNLOADED; prom nie ustawia statusu', () => {
    expect(milestoneAction('LOADED')).toEqual({ event: 'MILESTONE_LOADED', status: null });
    expect(milestoneAction('UNLOADED')).toEqual({ event: null, status: 'UNLOADING' });
    expect(milestoneAction('ON_FERRY').status).toBeNull();
  });

  it('store: „Rozładowany” wysyła status razem z datą rozładunku; pozycja idzie do report_position', () => {
    const sent: DataMutation[] = [];
    registerRemoteSink((m) => sent.push(m));
    /* transport z id serwera (uuid) — writeThrough pomija id demo */
    const base = useTowerStore.getState().loads.find((l) => l.status === 'IN_TRANSIT_SE')!;
    const loadId = '33333333-0000-4000-8000-000000000009';
    useTowerStore.setState((s) => ({ loads: [...s.loads, { ...base, id: loadId }] }));
    const token = 'test-uuid';
    (DRIVER_TOKENS as Record<string, string>)[token] = loadId;
    const st = useTowerStore.getState();
    st.driverMilestone(token, 'LOADED');
    expect(sent.some((m) => m.type === 'event.append' && m.event.type === 'MILESTONE_LOADED' && m.event.loadId === loadId)).toBe(true);
    expect(sent.some((m) => m.type === 'load.status')).toBe(false);
    st.driverMilestone(token, 'UNLOADED');
    const s = sent.find((m) => m.type === 'load.status');
    expect(s && s.type === 'load.status' && s.status === 'UNLOADING' && typeof s.unloadedAt === 'string').toBe(true);
    const l = useTowerStore.getState().loads.find((x) => x.id === loadId)!;
    expect(l.unloadedAt).toBeTruthy();
    st.driverReportFix(token, fix({}));
    const p = sent.find((m) => m.type === 'position.report');
    expect(p).toMatchObject({ type: 'position.report', loadId, lat: 54.40372, accuracy: 10 });
    registerRemoteSink(null);
  });
});
