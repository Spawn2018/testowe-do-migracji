/** M5 — numery zleceń (W12): wymuszenie, „każda strona swój”, ryzyko i przypomnienie, kolumny harmonogramu. */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  friendlyDbError, orderGateMessage, orderNoReminders, orderNoRisks, orderNumberGate, editableOrderSide, ORDER_NO_LEAD_H,
} from '../src/lib/orderNumbers';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { useTowerStore } from '../src/store/useTowerStore';
import { setAuthProfile } from '../src/auth/profile';
import { SCHED_COLS, loadSchedPrefs } from '../src/lib/scheduleColumns';
import type { Load } from '../src/types';

const base = (p: Partial<Load>) => ({ hhlOrderNo: 'HHL/1', carrierOrderNo: 'SCX/1', ...p });

describe('M5 — lustro enforce_order_numbers()', () => {
  it('GOTOWY wymaga numeru HHL, załadunek — numeru przewoźnika', () => {
    expect(orderNumberGate(base({ hhlOrderNo: null }), 'READY')).toBe('NO_HHL_ORDER');
    expect(orderNumberGate(base({ hhlOrderNo: '  ' }), 'READY')).toBe('NO_HHL_ORDER');
    expect(orderNumberGate(base({ carrierOrderNo: null }), 'READY')).toBeNull();
    expect(orderNumberGate(base({ carrierOrderNo: null }), 'LOADING')).toBe('NO_CARRIER_ORDER');
    expect(orderNumberGate(base({ hhlOrderNo: null, carrierOrderNo: null }), 'PLANNED')).toBeNull();
    expect(orderNumberGate(base({}), 'DELIVERED')).toBeNull();
  });
  it('edycja: HHL → numer HHL, SCX → numer przewoźnika, KSH → żaden', () => {
    expect(editableOrderSide('HHL')).toBe('HHL');
    expect(editableOrderSide('SCX')).toBe('CARRIER');
    expect(editableOrderSide('KSH')).toBeNull();
  });
});

describe('M5 — błędy bazy → zrozumiały komunikat', () => {
  const cases: [string, RegExp][] = [
    ['status: Transport 3333 bez numeru zlecenia HHL nie może przejść do statusu READY', /brak numeru zlecenia HHL/],
    ['status: Transport 3333 bez numeru zlecenia przewoźnika nie może przejść do statusu AT_LOADING', /brak numeru zlecenia przewoźnika/],
    ['numer zlecenia: Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik', /wpisuje wyłącznie przewoźnik/],
    ['numer zlecenia: Przewoźnik nie może zmieniać: hhl_order_no', /Numer zlecenia HHL wpisuje wyłącznie HHL/],
    ['awizacja: Przewoźnik nie może zmieniać: plan_load_from, plan_load_to', /Okna planowe .* wyłącznie HHL/],
    ['Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL', /Data rozładunku zamrożona — transport jest na fakturze/],
    ['Status nie może się cofnąć: AT_SITE → FERRY', /Status nie może się cofnąć/],
    ['duplicate key value violates unique constraint "loads_hhl_order_no_uq"', /już użyty/],
  ];
  it.each(cases)('%s', (raw, re) => expect(friendlyDbError(raw, 'pl')).toMatch(re));
  it('komunikat GOTOWY = ten sam tekst w aplikacji i z bazy', () => {
    expect(friendlyDbError('bez numeru zlecenia HHL nie może', 'en')).toBe(orderGateMessage('NO_HHL_ORDER', 'en'));
    /* 8A (17.10): tylko po polsku — inny język dostaje tekst polski */
    expect(orderGateMessage('NO_HHL_ORDER', 'sv')).toBe(orderGateMessage('NO_HHL_ORDER', 'pl'));
  });
  it('nieznany błąd — bez zmian', () => expect(friendlyDbError('network down')).toBe('network down'));
});

describe('M5 — brak numeru przed terminem → ryzyko i przypomnienie', () => {
  const now = '2026-09-23T01:00:00+02:00';
  const mk = (code: string, date: string, p: Partial<Load>): Load =>
    ({ id: code, code, plannedLoadDate: date, status: 'PLANNED', hhlOrderNo: 'H', carrierOrderNo: 'S', ...p }) as Load;
  it(`alarm od ${ORDER_NO_LEAD_H} h przed załadunkiem; każda strona swoje ryzyko`, () => {
    const r = orderNoRisks([
      mk('A', '2026-09-24', { hhlOrderNo: null }),
      mk('B', '2026-09-24', { carrierOrderNo: null, status: 'READY' }),
      mk('C', '2026-09-30', { hhlOrderNo: null, carrierOrderNo: null }),
      mk('D', '2026-09-24', { hhlOrderNo: null, status: 'IN_TRANSIT_PL' }),
    ], now);
    expect(r.map((x) => `${x.loadId}:${x.owner}`)).toEqual(['A:HHL', 'B:SCX']);
    const n = orderNoReminders(r, now);
    expect(n.map((x) => x.roleScope)).toEqual([['HHL'], ['SCX']]);
  });
  it('dane demo: trzy numery na każdym transporcie (D12) — kokpit bez zmian do G4', () => {
    const s = buildDemoSnapshot();
    expect(s.risks.filter((r) => r.id.startsWith('risk-orderno-')).length).toBe(0);
    expect(s.loads.every((l) => l.hhlOrderNo && l.carrierOrderNo && l.orderNo)).toBe(true);
  });
});

describe('M5 — store: każda strona swój numer, GOTOWY bez numeru zablokowany', () => {
  beforeEach(() => useTowerStore.setState({ ...buildDemoSnapshot(), role: 'HHL', locale: 'pl', toasts: [] } as never));
  const sg36 = () => useTowerStore.getState().loads.find((l) => l.code === 'SG-34')!;
  it('HHL usuwa swój numer → ryzyko + przypomnienie (termin < 48 h); GOTOWY → komunikat, status bez zmian', () => {
    const id = sg36().id;
    expect(useTowerStore.getState().setOrderNo(id, 'HHL', '')).toBe(true);
    expect(sg36().hhlOrderNo).toBeNull();
    const st = useTowerStore.getState();
    expect(st.risks.some((r) => r.id === `risk-orderno-hhl-${id}` && r.owner === 'HHL')).toBe(true);
    expect(st.exceptions.some((e) => e.id === `ex-risk-orderno-hhl-${id}`)).toBe(true);
    expect(st.notifications.some((n) => n.id === `n-risk-orderno-hhl-${id}` && n.roleScope?.join() === 'HHL')).toBe(true);
    const before = sg36().status;
    useTowerStore.setState({ toasts: [] });
    useTowerStore.getState().setLoadStatus(id, 'READY', 'HHL');
    expect(sg36().status).toBe(before);
    expect(useTowerStore.getState().toasts[0]?.message).toMatch(/brak numeru zlecenia HHL/);
  });
  it('HHL wpisuje swój numer → ryzyko znika; numer przewoźnika: Administrator HHL tak, Operacje HHL nie (D-20261020-1501-01)', () => {
    const st = useTowerStore.getState();
    st.setOrderNo(sg36().id, 'HHL', null);
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'HHL', ' HHL/2026/1310 ')).toBe(true);
    expect(sg36().hhlOrderNo).toBe('HHL/2026/1310');
    expect(useTowerStore.getState().risks.some((r) => r.id === `risk-orderno-hhl-${sg36().id}`)).toBe(false);
    const prev = sg36().carrierOrderNo;
    setAuthProfile({ user_id: 'u1', email: 'x@example.com', full_name: 'Test', role: 'HHL_OPS' as never, org_code: 'HHL', org_name: 'H&H Logistics', locale: 'pl', active: true });
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'CARRIER', 'X')).toBe(false);
    expect(sg36().carrierOrderNo).toBe(prev);
    setAuthProfile(null);
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'CARRIER', 'SCX-26-0001')).toBe(true);
    expect(sg36().carrierOrderNo).toBe('SCX-26-0001');
    useTowerStore.getState().setOrderNo(sg36().id, 'CARRIER', prev ?? null);
  });
  it('SCX nie zmieni numeru HHL; KSH żadnego', () => {
    useTowerStore.setState({ role: 'SCX' });
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'HHL', 'X')).toBe(false);
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'CARRIER', 'SCX-26-9999')).toBe(true);
    useTowerStore.setState({ role: 'KSH' });
    expect(useTowerStore.getState().setOrderNo(sg36().id, 'CARRIER', 'Y')).toBe(false);
  });
});

describe('M5 — kolumny harmonogramu', () => {
  it('trzy numery zaraz za kodem wysyłki', () => {
    expect(SCHED_COLS.slice(0, 3).map((c) => c.id)).toEqual(['code', 'ord_hhl', 'ord_scx']);
  });
  it('zapisane preferencje sprzed M5: nowe kolumny wstawione za kodem, nie na koniec', () => {
    const old = SCHED_COLS.map((c) => c.id).filter((id) => !id.startsWith('ord_'));
    localStorage.setItem('watch-tower-schedule-cols-v1', JSON.stringify({ order: old, hidden: [], widths: {} }));
    expect(loadSchedPrefs().order.slice(0, 3)).toEqual(['code', 'ord_hhl', 'ord_scx']);
    localStorage.removeItem('watch-tower-schedule-cols-v1');
  });
});
