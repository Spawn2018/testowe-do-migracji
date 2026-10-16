/**
 * audyt-B B-04 — okno „Zmień status” (E25, 07.10 17:46): SCX tylko do przodu; cofnięcie — administrator HHL, z powodem.
 */
import { describe, expect, it } from 'vitest'
import { isStepBack, MANUAL_STATUSES, manualOptions, manualStatusOf, statusRank } from '../src/lib/statusManual'

describe('statusManual (B-04)', () => {
  it('ciąg E25: 14 statusów, „Rozładowany” = „Dostarczone”, „Opóźniony” według etapu', () => {
    expect(MANUAL_STATUSES).toHaveLength(14)
    expect(manualStatusOf('UNLOADING')).toBe('DELIVERED')
    expect(manualStatusOf('DELAYED', 'SE_ROAD')).toBe('IN_TRANSIT_SE')
    expect(manualStatusOf('SILENT', 'FERRY')).toBe('ON_FERRY')
    expect(statusRank('ON_FERRY')).toBeGreaterThan(statusRank('AT_PORT'))
  })
  it('SCX: bieżący i późniejsze — bez „Zaplanowany … Port PL” przy „Na promie”', () => {
    const o = manualOptions('ON_FERRY', 'FERRY', { hhlAdmin: false, canCancel: false })
    expect(o[0]).toBe('ON_FERRY')
    expect(o).not.toContain('PLANNED')
    expect(o).not.toContain('AT_PORT')
    expect(o).toContain('DELIVERED')
    expect(o).not.toContain('CANCELLED')
  })
  it('administrator HHL: cały ciąg (cofnięcie z powodem), „Anulowany”, gdy wolno', () => {
    const o = manualOptions('ON_FERRY', 'FERRY', { hhlAdmin: true, canCancel: true })
    expect(o).toEqual([...MANUAL_STATUSES, 'CANCELLED'])
  })
  it('cofnięcie: wcześniejszy status niż bieżący; anulowanie i ten sam status — nie', () => {
    expect(isStepBack('AT_PORT', 'ON_FERRY', 'FERRY')).toBe(true)
    expect(isStepBack('ON_FERRY', 'ON_FERRY', 'FERRY')).toBe(false)
    expect(isStepBack('DELIVERED', 'ON_FERRY', 'FERRY')).toBe(false)
    expect(isStepBack('CANCELLED', 'ON_FERRY', 'FERRY')).toBe(false)
    expect(isStepBack('APPROACHING_SITE', 'UNLOADING', 'DELIVERED')).toBe(true)
    expect(isStepBack('LOADING', 'DELAYED', 'SE_ROAD')).toBe(true)
  })
})
