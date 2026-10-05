import { describe, expect, it } from 'vitest'
import { actionFromText, actionToText, conditionToDb, triggerFromDb, triggerToDb, workflowFromRow, workflowRunFromRow, workflowToDb } from '../src/data/workflowMap'
import { writeThrough, registerRemoteSink } from '../src/data/registry'
import type { DataMutation } from '../src/data/provider'

// 9.4 — Automatyzacje na danych z bazy: mapowanie reguł i przebiegów (0094) ↔ widok (makieta bez zmian)

describe('9.4: mapowanie reguł', () => {
  it('wyzwalacze kreatora ↔ baza', () => {
    expect(triggerToDb('POSITION_STALE')).toBe('SILENT_VEHICLE')
    expect(triggerToDb('UNLOADED')).toBe('MILESTONE_UNLOADED')
    expect(triggerToDb('GEOFENCE_ENTER')).toBe('GEOFENCE_ENTER')
    expect(triggerFromDb('SILENT_VEHICLE')).toBe('POSITION_STALE')
    expect(triggerFromDb('DELAY_DETECTED')).toBe('DELAY_DETECTED')
  })
  it('akcje: tekst ↔ JSON bazy; nieznana → błąd po polsku', () => {
    expect(actionFromText(' notify_hhl ')).toEqual({ type: 'notify', audience: 'HHL' })
    expect(actionFromText('notify_carrier')).toEqual({ type: 'notify', audience: 'CARRIER' })
    expect(actionFromText('risk:delay:high')).toEqual({ type: 'risk', kind: 'DELAY', severity: 'HIGH' })
    expect(actionFromText('email')).toEqual({ type: 'email', audience: 'HHL' })
    expect(() => actionFromText('create_task')).toThrow(/Nieznana akcja/)
    // B-5 (0165): SMS tylko według zasad stref — samo „sms” bez listy odrzucone
    expect(() => actionFromText('sms')).toThrow(/Nieznana akcja/)
    for (const a of [{ type: 'notify', audience: 'KSH' }, { type: 'risk', kind: 'DELAY', severity: 'HIGH' },
      { type: 'decision', decision_type: 'ETA_AFTER_LATEST' }, { type: 'email', audience: 'KSH' }, { type: 'email', audience: 'HHL', critical: true },
      { type: 'sms', list: 'LOAD_SREM', kind: 'ZONE_APPROACH' }])
      expect(actionFromText(actionToText(a))).toEqual(a)
  })
  it('warunek: pusty → true, JSON → obiekt, błędny → błąd', () => {
    expect(conditionToDb('')).toBe(true)
    expect(conditionToDb('{"==":[1,1]}')).toEqual({ '==': [1, 1] })
    expect(() => conditionToDb('a >')).toThrow(/JSON/)
  })
  it('wiersz bazy → reguła widoku (licznik = przebiegi OK) i z powrotem', () => {
    const w = workflowFromRow({ id: 'u1', name: 'Cichy pojazd', description: null, trigger_type: 'SILENT_VEHICLE', condition: true,
      actions: [{ type: 'notify', audience: 'CARRIER' }], enabled: false }, 3)
    expect(w).toEqual({ id: 'u1', name: 'Cichy pojazd', description: '', trigger: 'POSITION_STALE', condition: 'true', actions: ['notify_scx'], enabled: false, runCount: 3 })
    expect(workflowToDb({ enabled: true })).toEqual({ enabled: true })
    expect(workflowToDb({ trigger: w.trigger, actions: w.actions, condition: w.condition })).toEqual({
      trigger_type: 'SILENT_VEHICLE', actions: [{ type: 'notify', audience: 'CARRIER' }], condition: true })
  })
  it('przebiegi: DEAD/RETRY → ERROR z opisem błędu, QUEUED → SKIPPED „w kolejce”', () => {
    const r = (status: string, result: Record<string, unknown> | null = null) => workflowRunFromRow({ id: 7, workflow_id: 'u1', load_id: null, status, result, ran_at: '2026-09-28T10:00:00Z' })
    expect(r('OK')).toMatchObject({ id: 'wr-7', status: 'OK' })
    expect(r('DEAD', { error: 'x' })).toMatchObject({ status: 'ERROR', note: 'DEAD: x' })
    expect(r('QUEUED')).toMatchObject({ status: 'SKIPPED', note: 'w kolejce' })
    expect(r('SKIPPED', { reason: 'warunek niespełniony' }).note).toBe('warunek niespełniony')
  })
})

describe('9.4: zapis tylko dla reguł z serwera', () => {
  it('demo wf-1 nie trafia na serwer; uuid i nowa reguła — tak', () => {
    const got: DataMutation[] = []
    registerRemoteSink((m) => got.push(m))
    writeThrough({ type: 'workflow.update', id: 'wf-1', patch: { enabled: false } })
    writeThrough({ type: 'workflow.update', id: '6f1c2d3e-0000-4000-8000-000000000001', patch: { enabled: true } })
    writeThrough({ type: 'workflow.create', rule: { name: 'n', description: '', trigger: 'GEOFENCE_ENTER', condition: 'true', actions: ['notify_hhl'], enabled: false } })
    registerRemoteSink(null)
    expect(got.map((m) => m.type)).toEqual(['workflow.update', 'workflow.create'])
  })
})
