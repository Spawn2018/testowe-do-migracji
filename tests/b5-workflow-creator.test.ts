/**
 * B-5 (decyzja właściciela 05.10, ostateczna — odwraca „brak przycisku”): przycisk „Nowa automatyzacja” tylko dla
 * HHL_ADMIN i kreator reguł (wyzwalacz w 4 grupach, warunki, akcje: powiadomienie, decyzja, e-mail, SMS stref),
 * edycja/usuwanie, ostrzeżenie o duplikacie przed zapisem. Wykonanie w silniku — tests/db/workflows.sh (0165).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuthProfile } from '../src/auth/profile';
import {
  actionsFromText, actionsToText, draftCondition, draftFromRule, emptyDraft, groupOf, localDuplicateCheck, logicToRows,
  rowsToLogic, validateDraft,
} from '../src/lib/workflowCreator';
import { actionFromText } from '../src/data/workflowMap';
import type { WorkflowRule } from '../src/types';

vi.mock('../src/lib/prodFacade', async (orig) => ({ ...(await orig<typeof import('../src/lib/prodFacade')>()), PROD_BUILD: true }));

const profile = (role: string) => ({ user_id: 'u', email: 'a@log-mar.pl', full_name: 'A', role, org_code: 'HHL', org_name: 'HHL', locale: 'pl', active: true }) as never;

/* wyglad/P8-d (E35, decyzja 08.10.2026, 12:14): w demo Automatyzacje to strona E35 (tests/p8d-rules.test.ts,
   e8-phone-gate „wyglad/P8-d”); widok B-5 zostaje w produkcji do podłączenia źródła reguł w P8 — tu sprawdzany
   w trybie produkcji (VITE_AUTH_MODE=supabase, rulesReady() = false). */
describe('B-5: przycisk „Nowa automatyzacja” (produkcja)', () => {
  beforeEach(() => { vi.stubEnv('VITE_AUTH_MODE', 'supabase'); });
  afterEach(() => { setAuthProfile(null); vi.unstubAllEnvs(); });
  it('HHL_ADMIN: przycisk, edycja i aktywne włączniki', async () => {
    setAuthProfile(profile('HHL_ADMIN'));
    const { WorkflowsView } = await import('../src/views/WorkflowsView');
    const html = renderToStaticMarkup(createElement(WorkflowsView));
    expect(html).toContain('data-wf-new');
    expect(html).toContain('>Nowa automatyzacja<');
    expect(html).toContain('wf-edit');
    const sw = [...html.matchAll(/<button[^>]*class="sw"[^>]*>/g)].map((m) => m[0]);
    expect(sw.length).toBeGreaterThan(0);
    for (const s of sw) expect(s).not.toContain('disabled');
  });
  it('inna rola (HHL_DISPATCH): bez przycisku i edycji, włączniki zablokowane', async () => {
    setAuthProfile(profile('HHL_DISPATCH'));
    const { WorkflowsView } = await import('../src/views/WorkflowsView');
    const html = renderToStaticMarkup(createElement(WorkflowsView));
    expect(html).not.toContain('data-wf-new');
    expect(html).not.toContain('wf-edit');
    for (const s of [...html.matchAll(/<button[^>]*class="sw"[^>]*>/g)].map((m) => m[0])) expect(s).toContain('disabled');
  });
  it('kod: kreator w oknie z czterema grupami wyzwalaczy, akcjami, usuwaniem i historią', () => {
    const src = readFileSync(new URL('../src/views/WorkflowsView.tsx', import.meta.url), 'utf8');
    for (const k of ['data-wf-creator', 'data-wf-act="notify"', 'data-wf-act="decision"', 'data-wf-act="email"', 'data-wf-act="sms"', 'data-wf-delete', 'data-wf-dup', 'b5_history']) expect(src).toContain(k);
    expect(src).toMatch(/GROUPS: TriggerGroup\[\] = \['event', 'status', 'risk', 'deadline'\]/);
  });
});

describe('B-5: model kreatora', () => {
  it('akcje kreatora ↔ teksty ↔ JSON bazy', () => {
    const a = { notify: ['HHL', 'KSH'] as const, decision: 'ETA_AFTER_LATEST', email: ['HHL'] as const, emailCritical: true, zones: ['LOAD_SREM'] as const, smsKind: 'ZONE_APPROACH' as const, other: ['risk:FERRY:HIGH'] };
    const txt = actionsToText({ ...a, notify: [...a.notify], email: [...a.email], zones: [...a.zones] });
    expect(txt).toEqual(['notify_hhl', 'notify_ksh', 'decision:ETA_AFTER_LATEST', 'email:HHL:critical', 'smszone:LOAD_SREM:ZONE_APPROACH', 'risk:FERRY:HIGH']);
    expect(actionsToText(actionsFromText(txt))).toEqual(txt);
    expect(txt.map(actionFromText)).toEqual([
      { type: 'notify', audience: 'HHL' }, { type: 'notify', audience: 'KSH' }, { type: 'decision', decision_type: 'ETA_AFTER_LATEST' },
      { type: 'email', audience: 'HHL', critical: true }, { type: 'sms', list: 'LOAD_SREM', kind: 'ZONE_APPROACH' },
      { type: 'risk', kind: 'FERRY', severity: 'HIGH' }]);
  });
  it('warunki: wiersze ↔ JSONLogic (liczby, „and”, puste = zawsze)', () => {
    expect(rowsToLogic([])).toBe(true);
    const one = rowsToLogic([{ field: 'load.hours_to_load', op: '<', value: '48' }]);
    expect(one).toEqual({ '<': [{ var: 'load.hours_to_load' }, 48] });
    const two = rowsToLogic([{ field: 'payload.kind', op: '==', value: 'WEATHER' }, { field: 'payload.severity', op: '==', value: 'HIGH' }]);
    expect(two).toEqual({ and: [{ '==': [{ var: 'payload.kind' }, 'WEATHER'] }, { '==': [{ var: 'payload.severity' }, 'HIGH'] }] });
    expect(logicToRows(two)).toEqual([{ field: 'payload.kind', op: '==', value: 'WEATHER' }, { field: 'payload.severity', op: '==', value: 'HIGH' }]);
    expect(logicToRows({ or: [true] })).toBeNull();
  });
  it('grupy wyzwalaczy: zdarzenie / status / ryzyko / termin', () => {
    expect(groupOf('GEOFENCE_ENTER')).toBe('event');
    expect(groupOf('POSITION_STALE')).toBe('event');
    expect(groupOf('STATUS_CHANGED')).toBe('status');
    expect(groupOf('RISK_RAISED')).toBe('risk');
    expect(groupOf('CRON_DAILY_06')).toBe('deadline');
  });
  it('walidacja: nazwa, co najmniej jedna akcja, poprawny JSON w trybie zaawansowanym', () => {
    const d = emptyDraft();
    expect(validateDraft(d)).toBe('b5_need_name');
    expect(validateDraft({ ...d, name: 'x' })).toBe('b5_need_action');
    expect(validateDraft({ ...d, name: 'x', actions: { ...d.actions, notify: ['HHL'] } })).toBeNull();
    expect(validateDraft({ ...d, name: 'x', actions: { ...d.actions, notify: ['HHL'] }, advanced: true, conditionJson: '{' })).toBe('b5_cond_bad_json');
  });
  it('edycja: reguła → szkic (warunek prosty w wierszach, złożony w trybie zaawansowanym)', () => {
    const r: WorkflowRule = { id: 'x', name: 'N', description: '', trigger: 'POSITION_STALE', condition: '{"==":[{"var":"load.status"},"FERRY"]}', actions: ['notify_scx'], enabled: false, runCount: 0 };
    const d = draftFromRule(r);
    expect(d.trigger).toBe('SILENT_VEHICLE');
    expect(d.rows).toEqual([{ field: 'load.status', op: '==', value: 'FERRY' }]);
    expect(d.advanced).toBe(false);
    expect(draftCondition(d)).toBe('{"==":[{"var":"load.status"},"FERRY"]}');
    expect(draftFromRule({ ...r, condition: '{"or":[{"var":"a"},{"var":"b"}]}' }).advanced).toBe(true);
  });
  it('ostrzeżenie o duplikacie przed zapisem: inna reguła i wbudowany alarm', () => {
    const rules: WorkflowRule[] = [{ id: 'a', name: 'Istniejąca', description: '', trigger: 'DELAY_DETECTED', condition: 'true', actions: ['notify_hhl'], enabled: true, runCount: 0 }];
    const w = localDuplicateCheck(rules, 'DELAY_DETECTED', '{"==":[{"var":"load.status"},"FERRY"]}', ['notify_hhl']);
    expect(w.some((x) => x.kind === 'RULE' && x.rule === 'Istniejąca')).toBe(true);
    expect(w.some((x) => x.kind === 'BUILTIN')).toBe(true);
    expect(localDuplicateCheck(rules, 'DELAY_DETECTED', 'true', ['notify_hhl'], 'a').some((x) => x.kind === 'RULE')).toBe(false);
    expect(localDuplicateCheck([], 'MILESTONE_LOADED', 'true', ['notify_ksh'])).toEqual([]);
  });
});
