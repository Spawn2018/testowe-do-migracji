/**
 * D-20261018-1100-01 — jedna sprawa L14 = jedna karta.
 * Po RESOLVED karta znika, choć zdarzenie GEOFENCE_EXIT z krótkim postojem zostaje.
 * DELIVERED_CHECK nie wchodzi drugi raz jako decyzja w „Do zrobienia”.
 */
import { describe, expect, it } from 'vitest';
import type { Load, LoadEvent } from '../src/types';
import { deliveredCheckFromDecision, deliveredCheckFromEvents } from '../src/lib/p4cSource';
import { buildTodo, type TodoDecision, type TodoIssue } from '../src/lib/p6Todo';

const load = { id: 'L1', code: 'SG-06', status: 'AT_SITE' } as Load;
const exitEv = {
  id: 'e1', loadId: 'L1', type: 'GEOFENCE_EXIT', at: '2026-10-08T10:07:00Z',
  payload: { dwell_min: 6, geofence_kind: 'SITE', geofence_name: 'Plac Stegra' },
} as LoadEvent;

describe('A2 L14 — karta ze sprawy, nie ze zdarzenia', () => {
  it('sprawa RESOLVED → brak karty, mimo wyjazdu po 6 min', () => {
    expect(deliveredCheckFromEvents(load, [exitEv], [], 'SCX')).not.toBeNull();
    expect(deliveredCheckFromDecision(load, {
      id: 'dec-1', status: 'RESOLVED',
      detail: { exit_at: '2026-10-08T10:07:00Z', dwell_min: 6, zone: 'Plac Stegra', threshold_min: 10 },
    }, 'SCX')).toBeNull();
  });

  it('otwarta sprawa → jedna karta CHECK, bez drugiej pozycji DECISION', () => {
    const card = deliveredCheckFromDecision(load, {
      id: 'dec-1', status: 'NEW',
      detail: { exit_at: '2026-10-08T10:07:00Z', dwell_min: 6, zone: 'Plac Stegra', threshold_min: 10 },
    }, 'SCX');
    expect(card?.id).toBe('dec-1');
    expect(card?.minutes).toBe(6);
    const decision: TodoDecision = {
      id: 'dec-1', typeCode: 'DELIVERED_CHECK', titleKey: 'dec_type_DELIVERED_CHECK', title: 'Czy dostarczono?',
      dueAt: null, escalatedAt: null, loadId: 'L1', decider: 'SCX', deciderRole: 'CARRIER', status: 'NEW', options: [],
    };
    const check: TodoIssue = {
      id: 'dec-1', src: 'CHECK', loadId: 'L1', owner: 'SCX', severity: 'HIGH',
      dueAt: null, overdue: false, merged: 1, go: 'NONE', ageHours: 0, check: card!,
    };
    const cards = buildTodo({ risks: [], decisions: [decision], extras: [check], nowIso: '2026-10-08T12:00:00Z' });
    const issues = cards.flatMap((c) => c.issues);
    expect(issues.filter((i) => i.src === 'CHECK')).toHaveLength(1);
    expect(issues.filter((i) => i.src === 'DECISION')).toHaveLength(0);
  });
});
