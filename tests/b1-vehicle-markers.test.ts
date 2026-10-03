import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { demoFleetMarkers, prodFleetMarkers, type VehicleMarkerIn } from '../src/lib/vehicleMarkers'

const load = (id: string, progress = 0.4): VehicleMarkerIn => ({
  id, code: 'T-1', status: 'IN_TRANSIT_PL', progress, driver: 'A', plate: 'PO 1',
})

describe('B-1: znaczniki pojazdów', () => {
  it('produkcja bez pozycji GPS nie rysuje znacznika i nie używa postępu statusu', () => {
    const demo = demoFleetMarkers([load('x')], 0)
    const prod = prodFleetMarkers([load('x', 0.9)], new Map())
    expect(prod).toEqual([])
    expect(demo).toHaveLength(1)
    expect(prodFleetMarkers([load('x')], new Map([['x', { lat: demo[0].lat, lng: demo[0].lng }]]))[0]).toMatchObject({ lat: demo[0].lat, lng: demo[0].lng })
    const real = prodFleetMarkers([load('x', 0.1)], new Map([['x', { lat: 54.4, lng: 18.6 }]]))
    expect(real).toEqual([expect.objectContaining({ id: 'x', lat: 54.4, lng: 18.6 })])
    expect(real[0].lat).not.toBeCloseTo(demo[0].lat, 1)
  })

  it('zła współrzędna nie tworzy znacznika', () => {
    expect(prodFleetMarkers([load('x')], new Map([['x', { lat: Number.NaN, lng: 18 }]]))).toEqual([])
  })

  it('mapa produkcyjna nie woła pozycji przykładowej', () => {
    const src = readFileSync('src/components/map/CorridorMap.tsx', 'utf8')
    expect(src).toContain('PROD_BUILD ? prodFleetMarkers')
    expect(src).not.toContain('0.00012')
    expect(src).toContain("t(locale, 'b1_no_vehicle_positions')")
  })
})
