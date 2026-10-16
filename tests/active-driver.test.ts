/**
 * wyglad/E6-tel — „Zadzwoń” wybiera kierowcę, który teraz wykonuje transport (właściciel 16.10.2026, 13:34; E6).
 */
import { describe, expect, it } from 'vitest'
import { activeDriver, activeLeg } from '../src/lib/activeDriver'

const res = (o: Record<string, unknown> = {}) => ({
  driverName: 'Jan Odbiór', driverPhone: '501 111 222', tractorPlate: 'PO 1111A',
  driverDeliveryName: 'Erik Dostawa', driverDeliveryPhone: '+46 70 123 45 67', tractorDeliveryPlate: 'ABC 123',
  trailerSwap: true, ...o,
})
const load = (status: string, stage: string, o: Record<string, unknown> = {}) => ({ status, stage, resources: res(o) }) as never

describe('activeLeg (E6, 16.10 13:34)', () => {
  it('bez przepięcia — zawsze jeden kierowca (PL)', () => {
    for (const s of ['PLANNED', 'IN_TRANSIT_PL', 'ON_FERRY', 'IN_TRANSIT_SE', 'DELIVERED']) {
      expect(activeLeg(load(s, 'SE_ROAD', { trailerSwap: false }))).toBe('PL')
    }
  })
  it('z przepięciem — PL do portu w Polsce włącznie, SE od promu (właściciel 16.10, 13:58)', () => {
    for (const s of ['PLANNED', 'READY', 'LOADING', 'IN_TRANSIT_PL', 'AT_PORT']) expect(activeLeg(load(s, 'TO_PORT'))).toBe('PL')
    for (const s of ['ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED']) expect(activeLeg(load(s, 'SE_ROAD'))).toBe('SE')
  })
  it('status bez odcinka — decyduje etap paska', () => {
    expect(activeLeg(load('DELAYED', 'SE_ROAD'))).toBe('SE')
    expect(activeLeg(load('SILENT', 'APPROACH'))).toBe('SE')
    expect(activeLeg(load('DELAYED', 'TO_PORT'))).toBe('PL')
    expect(activeLeg(load('SILENT', 'FERRY'))).toBe('SE')
    expect(activeLeg(load('SILENT', 'GDANSK'))).toBe('PL')
  })
})

describe('activeDriver', () => {
  it('przepięcie, droga SE → kierowca SE, numer bez spacji, ciągnik SE', () => {
    const d = activeDriver(load('IN_TRANSIT_SE', 'SE_ROAD'))
    expect(d).toMatchObject({ leg: 'SE', swap: true, name: 'Erik Dostawa', dial: '+46701234567', display: '+46 701 234 567', tractor: 'ABC 123' })
  })
  it('przepięcie, droga PL → kierowca PL', () => {
    expect(activeDriver(load('IN_TRANSIT_PL', 'TO_PORT'))).toMatchObject({ leg: 'PL', name: 'Jan Odbiór', dial: '+48501111222', display: '+48 501 111 222', tractor: 'PO 1111A' })
    expect(activeDriver(load('ON_FERRY', 'FERRY')).leg).toBe('SE')
  })
  it('kierowca SE bez telefonu → brak numeru (nie dzwoni do kierowcy PL)', () => {
    const d = activeDriver(load('IN_TRANSIT_SE', 'SE_ROAD', { driverDeliveryPhone: '  ' }))
    expect(d.leg).toBe('SE')
    expect(d.dial).toBeNull()
    expect(d.name).toBe('Erik Dostawa')
  })
  it('bez przepięcia, wpisany tylko w polach odcinka SE → te pola', () => {
    const d = activeDriver(load('IN_TRANSIT_SE', 'SE_ROAD', { trailerSwap: false, driverName: null, driverPhone: null }))
    expect(d).toMatchObject({ leg: 'PL', swap: false, name: 'Erik Dostawa', dial: '+46701234567' })
  })
  it('numer krajowy SE z krajem SE → +46', () => {
    const d = activeDriver(load('IN_TRANSIT_SE', 'SE_ROAD', { driverDeliveryPhone: '070 123 45 67', driverDeliveryPhoneCountry: 'SE' }))
    expect(d.dial).toBe('+46701234567')
  })
})
