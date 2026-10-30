/** M10 — rejsy: przypisanie (HHL i przewoźnik; po wypłynięciu wyłącznie HHL), rozkład HHL, ryzyka automatu. */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import {
  autoRiskCode, autoStatusText, buildSeedSailings, cancelledSailingRisks, checkSailingDraft, effDeparture,
  ferryFromSailing, historicalSailings, sailingAssignDenied, selectableSailings,
} from '../src/lib/sailings';
import { sailingFromRow, riskFromRow } from '../src/data/mappers';
import { friendlyDbError } from '../src/lib/orderNumbers';
import type { Load, Sailing } from '../src/types';

const snap = buildDemoSnapshot();
const base = snap.loads.find((l) => l.status === 'READY' || l.status === 'PLANNED')!;
const NOW = '2026-09-23T14:32:00Z';
const S = (o: Partial<Sailing>): Sailing => ({ id: 's1', vessel: 'Wawel', route: 'GDN-NYN', departureAt: '2026-09-24T16:00:00Z', arrivalAt: '2026-09-25T10:00:00Z', delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'RECZNIE', ...o });

describe('M10 przypisanie rejsu', () => {
  it('HHL zawsze (poza odwołanym celem); KSH nigdy', () => {
    const past = S({ departureAt: '2026-09-22T16:00:00Z' });
    expect(sailingAssignDenied('HHL', { ...base, status: 'ON_FERRY' } as Load, past, S({ id: 's2' }), NOW)).toBeNull();
    expect(sailingAssignDenied('HHL', base, undefined, S({ status: 'ODWOLANY' }), NOW)).toBe('CANCELLED');
    expect(sailingAssignDenied('KSH', base, undefined, S({}), NOW)).toBe('ROLE');
  });
  it('przewoźnik: przed wypłynięciem tak; po wypłynięciu (rejs minął albo PROM i dalej) — wyłącznie HHL', () => {
    expect(sailingAssignDenied('SCX', base, S({}), S({ id: 's2' }), NOW)).toBeNull();
    expect(sailingAssignDenied('SCX', base, S({ departureAt: '2026-09-23T10:00:00Z' }), S({ id: 's2' }), NOW)).toBe('DEPARTED');
    expect(sailingAssignDenied('SCX', { ...base, status: 'ON_FERRY' } as Load, undefined, S({}), NOW)).toBe('DEPARTED');
    // odwołany bieżący rejs nie blokuje zmiany przez przewoźnika
    expect(sailingAssignDenied('SCX', base, S({ departureAt: '2026-09-23T10:00:00Z', status: 'ODWOLANY' }), S({ id: 's2' }), NOW)).toBeNull();
  });
  it('lista wyboru: przyszłe, nieodwołane GDN→NYN + bieżący; opóźnienie liczy się do odejścia', () => {
    const all = [S({ id: 'a' }), S({ id: 'b', status: 'ODWOLANY' }), S({ id: 'c', departureAt: '2026-09-22T16:00:00Z', arrivalAt: '2026-09-23T10:00:00Z' }), S({ id: 'd', route: 'NYN-GDN' }),
      S({ id: 'e', departureAt: '2026-09-23T12:00:00Z', arrivalAt: '2026-09-24T06:00:00Z', delayedDepartureAt: '2026-09-23T18:00:00Z', status: 'OPOZNIONY' })];
    expect(selectableSailings(all, NOW, 'c').map((s) => s.id)).toEqual(['c', 'e', 'a']);
    expect(effDeparture(all[4])).toBe('2026-09-23T18:00:00Z');
  });
  it('rezerwacja z rejsu: statek, godziny po opóźnieniu, status; odwołany → CANCELLED', () => {
    const f = ferryFromSailing(S({ delayedDepartureAt: '2026-09-24T19:00:00Z', delayedArrivalAt: '2026-09-25T13:00:00Z', status: 'OPOZNIONY' }), 'PF-1');
    expect(f).toMatchObject({ vessel: 'Wawel', departureAt: '2026-09-24T19:00:00Z', arrivalAt: '2026-09-25T13:00:00Z', bookingRef: 'PF-1', status: 'DELAYED' });
    expect(ferryFromSailing(S({ status: 'ODWOLANY' }), null).status).toBe('CANCELLED');
    expect(ferryFromSailing(undefined, null).status).toBe('NONE');
  });
});

describe('M10 rozkład (HHL)', () => {
  it('walidacja: statek, godziny, przypłynięcie po odejściu, bez duplikatu', () => {
    const all = [S({})];
    const d = { vessel: 'Wawel', route: 'GDN-NYN' as const, departureAt: '2026-09-26T16:00:00Z', arrivalAt: '2026-09-27T10:00:00Z' };
    expect(checkSailingDraft(d, all)).toBeNull();
    expect(checkSailingDraft({ ...d, vessel: ' ' }, all)).toBe('VESSEL');
    expect(checkSailingDraft({ ...d, arrivalAt: '' }, all)).toBe('TIMES');
    expect(checkSailingDraft({ ...d, arrivalAt: d.departureAt }, all)).toBe('ORDER');
    expect(checkSailingDraft({ ...d, departureAt: '2026-09-24T16:00:00Z' }, all)).toBe('DUPLICATE');
  });
  it('dane startowe: codzienne rejsy na zmianę Wawel / Nova Star + odwołany rejs SG-32 powiązany z transportem', () => {
    const ss = buildSeedSailings();
    expect(new Set(ss.map((s) => s.vessel))).toEqual(new Set(['Wawel', 'Nova Star']));
    const sg32 = snap.loads.find((l) => l.code === 'SG-32')!;
    expect(sg32.sailingId).toBe('sail-2026-09-24-N-X');
    expect(snap.sailings.find((s) => s.id === sg32.sailingId)?.status).toBe('ODWOLANY');
  });
  it('odwołanie → ryzyko dla każdego przypisanego transportu przed promem', () => {
    const s = S({ id: 'sx', status: 'ODWOLANY' });
    const loads = [{ ...base, id: 'L1', code: 'X-1', sailingId: 'sx' }, { ...base, id: 'L2', code: 'X-2', sailingId: 'sx', status: 'ON_FERRY' }, { ...base, id: 'L3', code: 'X-3', sailingId: null }] as Load[];
    const r = cancelledSailingRisks(s, loads);
    expect(r.map((x) => x.loadId)).toEqual(['L1']);
    expect(r[0]).toMatchObject({ type: 'FERRY', code: 'SAILING_CANCELLED', severity: 'HIGH' });
  });
});

describe('M10 dane z bazy', () => {
  it('rejs z wiersza sailings (statek „M/F …”)', () => {
    const s = sailingFromRow({ id: 'u', route: 'GDN-NYN', departure_at: 'a', arrival_at: 'b', delayed_departure_at: null, delayed_arrival_at: null, status: 'OPOZNIONY', source: 'RECZNIE', vessels: { name: 'M/F Nova Star' } });
    expect(s).toMatchObject({ vessel: 'Nova Star', status: 'OPOZNIONY', source: 'RECZNIE' });
  });
  it('rodzaje ryzyk z klucza deduplikacji: AUTO_STATUS, LOADING_UNCONFIRMED, rejs przegapiony / odwołany, PROM po czasie', () => {
    expect(autoRiskCode('AUTO_STATUS', 'AUTOSTATUS:x:FERRY')).toBe('AUTO_STATUS');
    expect(autoRiskCode('LOADING_UNCONFIRMED', 'LEFT_LOADING_UNCONFIRMED:x')).toBe('LOADING_UNCONFIRMED');
    expect(autoRiskCode('FERRY', 'MISSED_SAILING:x:s')).toBe('MISSED_SAILING');
    expect(autoRiskCode('FERRY', 'SAILING_CANCELLED:x:s')).toBe('SAILING_CANCELLED');
    expect(autoRiskCode('FERRY', 'FERRY_OVERDUE:x:s')).toBe('FERRY_OVERDUE');
    expect(autoRiskCode('FERRY', null)).toBeUndefined();
    const r = riskFromRow({ id: 'r', load_id: 'l', kind: 'AUTO_STATUS', severity: 'HIGH', title: 't', detail: {}, detected_at: NOW, dedup_key: 'AUTOSTATUS:l:FERRY' }, NOW);
    expect(r).toMatchObject({ type: 'OPS', code: 'AUTO_STATUS' });
  });
  it('oś zdarzeń: zmiana automatyczna z powodem', () => {
    expect(autoStatusText({ from: 'AT_PORT_GDANSK', to: 'FERRY', powod: 'odejście przypisanego rejsu' })).toBe('AT_PORT_GDANSK → FERRY · odejście przypisanego rejsu');
    expect(autoStatusText(undefined)).toBeNull();
  });
});

describe('D-20261020-1501-01 — rejsy historyczne tylko dla Administratora HHL', () => {
  const past = S({ id: 'h1', departureAt: '2026-09-20T16:00:00Z', arrivalAt: '2026-09-21T10:00:00Z' });
  const onSea = S({ id: 'h2', departureAt: '2026-09-23T10:00:00Z', arrivalAt: '2026-09-24T06:00:00Z' });
  it('Administrator HHL przypisuje rejs, który dopłynął; Operacje HHL i SCX — nie; odwołany — nikt', () => {
    expect(sailingAssignDenied('HHL', base, undefined, past, NOW, 'HHL_ADMIN')).toBeNull();
    expect(sailingAssignDenied('HHL', base, undefined, past, NOW, 'HHL_OPS')).toBe('DEPARTED');
    expect(sailingAssignDenied('SCX', base, undefined, past, NOW, 'CARRIER_DISPATCH')).toBe('DEPARTED');
    expect(sailingAssignDenied('SCX', base, undefined, S({ id: 's9' }), NOW, 'CARRIER_DISPATCH')).toBeNull();
    expect(sailingAssignDenied('HHL', base, undefined, S({ id: 'x', status: 'ODWOLANY', departureAt: '2026-09-20T16:00:00Z' }), NOW, 'HHL_ADMIN')).toBe('CANCELLED');
    expect(sailingAssignDenied('KSH', base, undefined, S({ status: 'ODWOLANY' }), NOW)).toBe('ROLE');
  });
  it('lista historyczna (#666 decyzja 52): już wypłynęły (także w drodze), bez odwołanych, najnowsze pierwsze', () => {
    const all = [past, onSea, S({ id: 'h3', departureAt: '2026-09-18T16:00:00Z', arrivalAt: '2026-09-19T10:00:00Z' }),
      S({ id: 'h4', departureAt: '2026-09-17T16:00:00Z', arrivalAt: '2026-09-18T10:00:00Z', status: 'ODWOLANY' }), S({ id: 'f1' })];
    /* onSea (h2) wypłynął 10:00, NOW 14:32 — wchodzi do historycznych; f1 jeszcze nie wypłynął */
    expect(historicalSailings(all, NOW).map((s) => s.id)).toEqual(['h2', 'h1', 'h3']);
  });
  it('5A (25.10): rejsy historyczne bez limitu dni — także sprzed pół roku; limit tylko jawnie', () => {
    const old = S({ id: 'h0', departureAt: '2026-03-01T16:00:00Z', arrivalAt: '2026-03-02T10:00:00Z' });
    expect(historicalSailings([past, old], NOW).map((s) => s.id)).toEqual(['h1', 'h0']);
    expect(historicalSailings([past, old], NOW, 'POLFERRIES', 60).map((s) => s.id)).toEqual(['h1']);
  });
});

/* 0242 (D-1501) — ekran zgodny z bazą: Operacje HHL jak przewoźnik, komunikaty bazy po polsku */
describe('W-rejs-komunikaty — Operacje HHL i teksty 0242', () => {
  const NOW2 = '2026-09-24T12:00:00Z';
  const base2 = { id: 'l1', status: 'READY' } as Load;
  const past2 = { id: 'p', departureAt: '2026-09-23T10:00:00Z', arrivalAt: '2026-09-24T08:00:00Z', status: 'PLANOWY' } as unknown as Sailing;
  const fut2 = { id: 'f', departureAt: '2026-09-26T10:00:00Z', arrivalAt: '2026-09-27T08:00:00Z', status: 'PLANOWY' } as unknown as Sailing;
  it('Operacje HHL nie zmieniają rejsu po wypłynięciu (także zdjęcie rejsu)', () => {
    expect(sailingAssignDenied('HHL', { ...base2, status: 'ON_FERRY' } as Load, past2, null, NOW2, 'HHL_OPS')).toBe('DEPARTED');
    expect(sailingAssignDenied('HHL', base2, past2, fut2, NOW2, 'HHL_OPS')).toBe('DEPARTED');
    expect(sailingAssignDenied('HHL', base2, undefined, fut2, NOW2, 'HHL_OPS')).toBeNull();
  });
  it('Administrator HHL może zmienić rejs po wypłynięciu', () => {
    expect(sailingAssignDenied('HHL', { ...base2, status: 'ON_FERRY' } as Load, past2, fut2, NOW2, 'HHL_ADMIN')).toBeNull();
  });
  it('odwołany rejs nie blokuje przepięcia na przyszły', () => {
    const cancelled = { ...past2, status: 'ODWOLANY' } as Sailing;
    expect(sailingAssignDenied('HHL', base2, cancelled, fut2, NOW2, 'HHL_OPS')).toBeNull();
  });
  it('teksty wyjątków 0242 zamienione na zrozumiałe', () => {
    expect(friendlyDbError('Przewoźnik i Operacje HHL przypisują tylko rejs, który jeszcze nie wypłynął')).toMatch(/Rejs historyczny przypisuje Administrator HHL/);
    expect(friendlyDbError('Rejs odwołany — nie można przypisać')).toBe('Ten rejs jest odwołany — wybierz inny.');
    expect(friendlyDbError('Nie znaleziono rejsu')).toMatch(/odśwież listę rejsów/);
    expect(friendlyDbError('Zmiana rejsu po wypłynięciu — wyłącznie HHL Administrator')).toBe('Rejs po wypłynięciu może zmienić wyłącznie Administrator HHL.');
  });
  it('Operacje HHL: docelowy wypłynięty bez bieżącego → DEPARTED; zdjęcie przed promem → wolno', () => {
    expect(sailingAssignDenied('HHL', base2, undefined, past2, NOW2, 'HHL_OPS')).toBe('DEPARTED');
    expect(sailingAssignDenied('HHL', base2, fut2, null, NOW2, 'HHL_OPS')).toBeNull();
  });
  it('anulowany i rozliczany transport: przewoźnik i Operacje HHL nie zmieniają rejsu (jak baza: status >= FERRY)', () => {
    for (const st of ['CANCELLED', 'READY_TO_INVOICE', 'INVOICED'] as const) {
      expect(sailingAssignDenied('SCX', { ...base2, status: st } as Load, fut2, null, NOW2)).toBe('DEPARTED');
      expect(sailingAssignDenied('HHL', { ...base2, status: st } as Load, fut2, null, NOW2, 'HHL_OPS')).toBe('DEPARTED');
      expect(sailingAssignDenied('HHL', { ...base2, status: st } as Load, fut2, null, NOW2, 'HHL_ADMIN')).toBeNull();
    }
  });
});
