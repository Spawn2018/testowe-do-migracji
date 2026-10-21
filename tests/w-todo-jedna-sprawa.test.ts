/**
 * wyglad/W-todo-jedna-sprawa (#384, właściciel 21.10.2026 11:30, SG-12): ryzyko, które ma otwartą decyzję,
 * nie jest osobną sprawą bez przycisków. „Późna zmiana daty” (risk_id decyzji) i „Decyzja po terminie”
 * (detail.decision_id) chowają się pod kartą decyzji; bez decyzji na liście ryzyko zostaje.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Risk } from '../src/types';
import { buildTodo, type TodoDecision } from '../src/lib/p6Todo';
import { decisionFromRow } from '../src/components/risks/useDecisions';
import { riskFromRow } from '../src/data/mappers';

const NOW = '2026-10-21T09:30:00Z';
const risk = (p: Partial<Risk>): Risk => ({
  id: 'r', type: 'OPS', severity: 'MEDIUM', title: 'x', detail: '', owner: 'HHL', meta: '', nextAction: '', ageHours: 1, ...p,
}) as Risk;
const dec = (p: Partial<TodoDecision>): TodoDecision => ({
  id: 'd', typeCode: 'KSH_DATE_LT_5D', titleKey: null, title: 'SG-12: późna zmiana daty', dueAt: '2026-10-21T09:31:00Z',
  escalatedAt: null, loadId: 'L12', decider: 'SCX', deciderRole: 'CARRIER', status: 'NEW', options: [], ...p,
});

describe('#384 — jedna sprawa zamiast ryzyka bez przycisków', () => {
  it('„Późna zmiana daty” z decyzją (risk_id) — tylko karta decyzji', () => {
    const cards = buildTodo({
      risks: [risk({ id: 'late', kind: 'LATE_DATE_CHANGE', loadId: 'L12', title: 'SG-12: późna zmiana daty — załadunek 07.10.2026' })],
      decisions: [dec({ id: 'd1', riskId: 'late' })],
      nowIso: NOW,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].issues.map((i) => i.src)).toEqual(['DECISION']);
  });

  it('„Decyzja po terminie” wskazująca decyzję z listy — chowa się pod decyzją', () => {
    const cards = buildTodo({
      risks: [risk({ id: 'od', loadId: 'L12', titleKey: 'rk_decision_overdue', decisionId: 'd2', title: 'Decyzja po terminie: SG-12' })],
      decisions: [dec({ id: 'd2', typeCode: 'DELIVERY_UNCONFIRMED' })],
      nowIso: NOW,
    });
    expect(cards[0].issues.map((i) => i.id)).toEqual(['d2']);
  });

  it('bez decyzji na liście ryzyko zostaje (nic nie znika po cichu)', () => {
    const cards = buildTodo({
      risks: [risk({ id: 'late', kind: 'LATE_DATE_CHANGE', loadId: 'L12' })],
      decisions: [dec({ id: 'dX', loadId: 'L99', riskId: 'inne' })],
      nowIso: NOW,
    });
    expect(cards.flatMap((c) => c.issues.map((i) => i.id))).toContain('late');
  });

  it('dane z bazy: risk_id decyzji i detail.decision_id ryzyka', () => {
    expect(decisionFromRow({
      id: 'd', type_code: 'KSH_DATE_LT_5D', status: 'NEW', title: 't', due_at: null, escalated_at: null, load_id: 'L', risk_id: 'r1',
      decision_types: null,
    }).riskId).toBe('r1');
    expect(readFileSync('src/components/risks/useDecisions.ts', 'utf8')).toContain('load_id,risk_id,decision_types(');
    const r = riskFromRow({
      id: 'r2', load_id: 'L', kind: 'JOB_FAILURE', severity: 'HIGH', title: 'Decyzja po terminie', title_key: 'rk_decision_overdue',
      detail: { decision_id: 'd9', type: 'DELIVERY_UNCONFIRMED' }, detected_at: NOW,
    }, NOW);
    expect(r.decisionId).toBe('d9');
  });
});
