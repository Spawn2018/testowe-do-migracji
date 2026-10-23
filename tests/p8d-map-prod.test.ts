/**
 * #413 F7 — mapowanie P8-d ↔ silnik + guardy produkcji (soft-delete, near).
 * Etap: E35 / hotfix #413.
 */
import { describe, expect, it } from 'vitest';
import { draftToWorkflow, workflowToOwn } from '../src/lib/p8dMap';
import { softDeleteTouched } from '../src/lib/p8dProd';
import { pickNearLoads } from '../src/lib/p8cProd';
import { emptyThen, type RuleDraft } from '../src/lib/p8dRules';
import type { WorkflowRule, WorkflowRun } from '../src/types';

const base = (when: RuleDraft['when']): RuleDraft => ({
  name: 'Reguła test',
  when,
  then: { ...emptyThen(), notify: ['HHL_OPS'] },
  enabled: true,
});

const roundTrip = (d: RuleDraft) => {
  const w = draftToWorkflow(d);
  const own = workflowToOwn({ ...w, id: 'wf-1', runCount: 0 }, [] as WorkflowRun[], 0);
  expect(own).not.toBeNull();
  expect(own!.when).toEqual(d.when);
  expect(own!.name).toBe('Reguła test');
  return w;
};

describe('#413 F7: draftToWorkflow ↔ workflowToOwn', () => {
  it('zone', () => {
    const w = roundTrip(base({ kind: 'zone', zoneId: 'geo-bod', minutes: 180 }));
    expect(w.trigger).toBe('GEOFENCE_DWELL');
    expect(JSON.parse(w.condition)).toEqual({ '==': [{ var: 'payload.geofence_id' }, 'geo-bod'] });
  });
  it('status DELIVERED → payload.status DB', () => {
    const w = roundTrip(base({ kind: 'status', status: 'DELIVERED' }));
    expect(w.trigger).toBe('STATUS_CHANGED');
    expect(JSON.parse(w.condition)).toEqual({ '==': [{ var: 'payload.status' }, 'DELIVERED'] });
  });
  it('status ANY', () => {
    const w = roundTrip(base({ kind: 'status', status: 'ANY' }));
    expect(w.condition).toBe('true');
  });
  it('issue AWIZ', () => {
    const w = roundTrip(base({ kind: 'issue', issue: 'AWIZ' }));
    expect(w.trigger).toBe('RISK_RAISED');
    expect(JSON.parse(w.condition)).toEqual({ '==': [{ var: 'payload.kind' }, 'LOADING_UNCONFIRMED'] });
  });
  it('daily LOAD_WITHIN → load.hours_to_load', () => {
    const w = roundTrip(base({ kind: 'daily', check: 'LOAD_WITHIN', hours: 48 }));
    expect(w.trigger).toBe('CRON_DAILY_06');
    expect(JSON.parse(w.condition)).toEqual({ '<=': [{ var: 'load.hours_to_load' }, 48] });
  });
  it('daily DELIVERY_WITHIN → load.hours_to_delivery', () => {
    const w = roundTrip(base({ kind: 'daily', check: 'DELIVERY_WITHIN', hours: 72 }));
    expect(JSON.parse(w.condition)).toEqual({ '<=': [{ var: 'load.hours_to_delivery' }, 72] });
  });
  it('daily DATES_UNCONFIRMED → load.plan_dates_status WSTEPNA', () => {
    const w = roundTrip(base({ kind: 'daily', check: 'DATES_UNCONFIRMED', hours: 48 }));
    expect(JSON.parse(w.condition)).toEqual({ '==': [{ var: 'load.plan_dates_status' }, 'WSTEPNA'] });
  });
  it('reverseMap statusFromDb (AT_LOADING → LOADING)', () => {
    const row: WorkflowRule = {
      id: 'x', name: 'S', description: '', trigger: 'STATUS_CHANGED',
      condition: JSON.stringify({ '==': [{ var: 'payload.status' }, 'AT_LOADING'] }),
      actions: ['notify_hhl'], enabled: true, runCount: 0,
    };
    expect(workflowToOwn(row, [], 0)?.when).toEqual({ kind: 'status', status: 'LOADING' });
  });
});

describe('#413 F7: soft-delete / near', () => {
  it('prodRemove: 0 wierszy → ok:false', () => {
    expect(softDeleteTouched([], null)).toBe(false);
    expect(softDeleteTouched(null, null)).toBe(false);
    expect(softDeleteTouched([{ id: 'a' }], null)).toBe(true);
    expect(softDeleteTouched([{ id: 'a' }], { message: 'x' })).toBe(false);
  });
  it('prodNear: wnętrze dużego koła + lastFixAt; bez fix — pomijamy', () => {
    const z = { lat: 65.8, lng: 21.7, radiusM: 50_000 };
    const inside = { code: 'SG-01', lat: 65.8, lng: 21.7, status: 'IN_TRANSIT_SE', etaDetail: { lastFixAt: '2026-10-23T10:00:00Z' } };
    const noFix = { code: 'SG-02', lat: 65.8, lng: 21.7, status: 'IN_TRANSIT_SE', etaDetail: { lastFixAt: null } };
    const far = { code: 'SG-03', lat: 50.0, lng: 20.0, status: 'IN_TRANSIT_PL', etaDetail: { lastFixAt: '2026-10-23T10:00:00Z' } };
    const near = pickNearLoads([inside, noFix, far], z, () => 'w drodze');
    expect(near.map((n) => n.code)).toEqual(['SG-01']);
  });
});
