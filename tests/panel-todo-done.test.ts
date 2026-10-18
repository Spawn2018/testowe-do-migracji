/**
 * Panel transportu › Przegląd › „Do zrobienia” — tylko aktualny stan (właściciel 18.10.2026, 11:35 i 11:46).
 * Sprawa „brak awizacji / tablic / numeru zlecenia” znika, gdy dane są wpisane; alarmy przed załadunkiem i w drodze —
 * gdy transport jest dostarczony, zafakturowany albo anulowany. Inne sprawy bez zmian. Dane zmyślone (G-09).
 */
import { describe, expect, it } from 'vitest';
import type { Load, Risk } from '../src/types';
import { openTodoRisks, todoDoneOnLoad } from '../src/lib/todoRules';
import { buildDemoSnapshot } from '../src/data/demoProvider';

const base = buildDemoSnapshot().loads[0];
const load = ({ res, ...p }: Partial<Load> & { res?: Partial<Load['resources']> }): Load => ({
  ...base, id: 'L-T1', status: 'PLANNED', hhlOrderNo: null, carrierOrderNo: null, ...p,
  resources: { ...base.resources, driverName: null, driverPhone: null, tractorPlate: null, trailerPlate: null, ...res },
}) as Load;
const risk = (titleKey: string, p: Partial<Risk> = {}): Risk => ({
  id: `r-${titleKey}`, type: 'OPS', severity: 'HIGH', title: 'x', detail: '', owner: 'SCX', meta: '', nextAction: '',
  ageHours: 1, loadId: 'L-T1', titleKey, ...p,
}) as Risk;

describe('todoDoneOnLoad — sprawa zrobiona według danych transportu', () => {
  it('brak awizacji (rk_res_driver): znika dopiero przy kierowcy, telefonie, ciągniku i naczepie', () => {
    const r = risk('rk_res_driver');
    expect(todoDoneOnLoad(r, load({}))).toBe(false);
    expect(todoDoneOnLoad(r, load({ res: { driverName: 'Jan Testowy', tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(false);
    expect(todoDoneOnLoad(r, load({ res: { driverName: 'Jan Testowy', driverPhone: '+48 000 000 001', tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(true);
    expect(todoDoneOnLoad(r, load({ res: { driverName: '  ', driverPhone: '+48 000 000 001', tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(false);
  });

  it('brak tablic (rk_res_vehicle), brak kierowcy w demo (rk_seed_res)', () => {
    expect(todoDoneOnLoad(risk('rk_res_vehicle'), load({ res: { tractorPlate: 'TE 00001' } }))).toBe(false);
    expect(todoDoneOnLoad(risk('rk_res_vehicle'), load({ res: { tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(true);
    expect(todoDoneOnLoad(risk('rk_seed_res'), load({ res: { tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(false);
    expect(todoDoneOnLoad(risk('rk_seed_res'), load({ res: { driverName: 'Jan Testowy', tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' } }))).toBe(true);
  });

  it('numery zleceń: znika po wpisaniu numeru', () => {
    expect(todoDoneOnLoad(risk('rk_order_no_hhl'), load({}))).toBe(false);
    expect(todoDoneOnLoad(risk('rk_order_no_hhl'), load({ hhlOrderNo: 'HHL/2026/0001' }))).toBe(true);
    expect(todoDoneOnLoad(risk('rk_order_no_carrier'), load({ hhlOrderNo: 'HHL/2026/0001' }))).toBe(false);
    expect(todoDoneOnLoad(risk('rk_order_no_carrier'), load({ carrierOrderNo: 'SCX-26-0001' }))).toBe(true);
  });

  it('po dostawie albo anulowaniu: alarmy przed załadunkiem i w drodze nieaktualne; inne sprawy zostają', () => {
    for (const status of ['DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED'] as const) {
      for (const k of ['rk_res_driver', 'rk_res_vehicle', 'rk_res_docs', 'rk_order_no_hhl', 'rk_auto_status_blocked', 'rk_silent_vehicle']) {
        expect(todoDoneOnLoad(risk(k), load({ status })), `${status} ${k}`).toBe(true);
      }
      /* decyzja po terminie (np. postój, różnica faktury) i faktura po terminie — nadal sprawa */
      expect(todoDoneOnLoad(risk('rk_decision_overdue'), load({ status }))).toBe(false);
      expect(todoDoneOnLoad(risk('rk_invoice_overdue'), load({ status }))).toBe(false);
    }
    for (const status of ['PLANNED', 'LOADING', 'IN_TRANSIT_PL', 'UNLOADING'] as const) {
      expect(todoDoneOnLoad(risk('rk_res_driver'), load({ status })), status).toBe(false);
    }
  });

  it('bez transportu albo bez klucza — bez zmian', () => {
    expect(todoDoneOnLoad(risk('rk_res_driver'), undefined)).toBe(false);
    expect(todoDoneOnLoad({ titleKey: undefined }, load({ status: 'DELIVERED' }))).toBe(false);
  });
});

describe('openTodoRisks — wejście sekcji „Do zrobienia” w panelu', () => {
  it('usuwa tylko sprawy zrobione; sprawy bez transportu i innego transportu zostają', () => {
    const done = load({ hhlOrderNo: 'HHL/2026/0001' });
    const risks = [
      risk('rk_order_no_hhl'),
      risk('rk_order_no_carrier'),
      risk('rk_order_no_hhl', { id: 'other', loadId: 'L-INNY' }),
      risk('rk_source_down', { id: 'sys', loadId: undefined }),
    ];
    expect(openTodoRisks(risks, [done]).map((r) => r.id)).toEqual(['r-rk_order_no_carrier', 'other', 'sys']);
  });
});
