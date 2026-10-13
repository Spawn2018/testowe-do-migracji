import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { HIDDEN_IN_PROD, canSeeWorkflows, canSwitchView, isPreviewReadOnly, shows } from '../src/lib/prodFacade'
import { navForRole, canImportSchedule, canEditResources, canSubmitInvoice } from '../src/lib/permissions'
import { delayPillMinutes, docsCompleteBeforeLoad, otifShown, permitBannerState, prodBannerRisk } from '../src/lib/prodDash'
import { progressWeeksFromDb, progressWeeksLabel } from '../src/components/chart/DeliveryProgress'
import { nextDbSailing } from '../src/lib/sailings'
import { etaConfidenceFromMinutes } from '../src/data/mappers'
import { parseTiers, currentReadings } from '../src/auth/BafForm'
import type { Document, Load, Risk, Sailing } from '../src/types'

// I-2 „zero fasady”: produkcja pokazuje wyłącznie dane z bazy albo „brak źródła danych”.

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const SRC = walk('src').filter((p) => /\.(ts|tsx)$/.test(p)).map((p) => ({ p, s: readFileSync(p, 'utf8') }))

describe('I-2: rejestr funkcji ukrytych w produkcji', () => {
  it('każdy klucz HIDDEN_IN_PROD jest użyty przez shows(...) w src (poza delayCodes — brak w UI)', () => {
    const unused = Object.keys(HIDDEN_IN_PROD).filter((k) => k !== 'delayCodes' && !SRC.some((f) => f.s.includes(`shows('${k}'`)))
    expect(unused).toEqual([])
    expect(Object.keys(HIDDEN_IN_PROD).length).toBe(12)
  })
  it('shows(): demo widoczne, produkcja ukryte', () => {
    expect(shows('seaWeather', false)).toBe(true)
    expect(shows('seaWeather', true)).toBe(false)
  })
  it('I-2g: kody opóźnień nie występują w UI (delay_code / A_CLIENT)', () => {
    const hits = SRC.filter((f) => !f.p.endsWith('prodFacade.ts') && /delay_code|delayCode|A_CLIENT/.test(f.s)).map((f) => f.p)
    expect(hits).toEqual([])
  })
})

describe('I-2a: przełącznik widoku i import', () => {
  it('produkcja: tylko konto HHL; demo: zawsze', () => {
    expect(canSwitchView(true, 'HHL')).toBe(true)
    expect(canSwitchView(true, 'KSH')).toBe(false)
    expect(canSwitchView(true, 'SCX')).toBe(false)
    expect(canSwitchView(true, null)).toBe(false)
    expect(canSwitchView(false, null)).toBe(true)
  })
  it('import harmonogramu: wyłącznie HHL (także demo)', () => {
    expect(['HHL', 'KSH', 'SCX'].map((r) => canImportSchedule(r as never))).toEqual([true, false, false])
  })
  it('E9-7 / G-07: Podgląd bez zapisu tylko w supabase (HHL → KSH/SCX)', () => {
    expect(isPreviewReadOnly({ prod: true, viewRole: 'KSH', orgCode: 'HHL' })).toBe(true)
    expect(isPreviewReadOnly({ prod: true, viewRole: 'SCX', orgCode: 'HHL' })).toBe(true)
    expect(isPreviewReadOnly({ prod: true, viewRole: 'HHL', orgCode: 'HHL' })).toBe(false)
    expect(isPreviewReadOnly({ prod: true, viewRole: 'KSH', orgCode: 'KSH' })).toBe(false)
    expect(isPreviewReadOnly({ prod: false, viewRole: 'KSH', orgCode: 'HHL' })).toBe(false)
    // demo: pełne prawa wybranej roli (G-07) — PROD_BUILD=false w vitest
    expect(canEditResources('SCX')).toBe(true)
    expect(canSubmitInvoice('SCX')).toBe(true)
  })
  it('E9: SCX bez „Moje zadania” w menu', () => {
    expect(navForRole('SCX', false)).not.toContain('tasks')
    expect(navForRole('SCX', false)).toContain('risk')
  })
})

describe('9.4: Automatyzacje (dawniej I-2c)', () => {
  it('produkcja: wf tylko dla HHL_ADMIN; bez profilu i inne role — brak; demo HHL ma wf', () => {
    for (const r of ['HHL', 'KSH', 'SCX'] as const) expect(navForRole(r, true, null)).not.toContain('wf')
    expect(navForRole('HHL', true, 'HHL_ADMIN')).toContain('wf')
    expect(navForRole('HHL', true, 'HHL_OPS')).not.toContain('wf')
    expect(navForRole('HHL', false)).toContain('wf')
    expect(canSeeWorkflows(true, 'HHL_ADMIN')).toBe(true)
    expect(canSeeWorkflows(true, 'KSH_USER')).toBe(false)
    expect(canSeeWorkflows(false, null)).toBe(true)
  })
})

const L = (o: Partial<Load>): Load => ({ id: 'x', dims: { cargoClass: 'PERMIT_PL', weightT: 10 }, plannedDeliverDate: '2026-10-05', unloadedAt: null, delayed: false, ...o } as unknown as Load)

describe('I-2b: kokpit z bazy', () => {
  it('baner: najpoważniejsze CRITICAL/HIGH + liczba; brak → null', () => {
    const rs = [{ id: 'a', severity: 'HIGH', ageHours: 1 }, { id: 'b', severity: 'CRITICAL', ageHours: 2 }, { id: 'c', severity: 'LOW', ageHours: 9 }] as Risk[]
    expect(prodBannerRisk(rs)).toMatchObject({ top: { id: 'b' }, count: 2 })
    expect(prodBannerRisk([rs[2]])).toBeNull()
  })
  it('OTIF bez dostarczonych = „—”; dokumenty: PERMIT_PL tylko z plikiem, STANDARD nie zwalnia', () => {
    expect(otifShown(0)).toBe(false)
    const docs = [{ loadId: 'p1', category: 'PERMIT_PL', status: 'UPLOADED', name: 'z.pdf' }] as Document[]
    expect(docsCompleteBeforeLoad([L({ id: 's', dims: { cargoClass: 'STANDARD' } as never }), L({ id: 'p1' }), L({ id: 'p2' })], docs)).toBe(1)
    expect(permitBannerState(L({ id: 's', dims: { cargoClass: 'STANDARD' } as never }), docs)).toEqual({ kind: 'missing' })
    expect(permitBannerState(L({ id: 'p1' }), docs)).toEqual({ kind: 'uploaded_unchecked', fileName: 'z.pdf' })
    expect(permitBannerState(L({ id: 'p2' }), docs)).toEqual({ kind: 'missing' })
  })
  it('oś postępu: tygodnie z planu, wykonanie z unloadedAt; pusty harmonogram → brak osi', () => {
    const w = progressWeeksFromDb([L({ plannedDeliverDate: '2026-10-05' }), L({ plannedDeliverDate: '2026-10-19', unloadedAt: '2026-10-06T10:00:00Z' })], new Date('2026-10-07'))
    expect(w).toHaveLength(3)
    expect(w.map((x) => x.plan)).toEqual([10, 10, 20])
    expect(w.map((x) => x.act)).toEqual([10, 10, 10])
    expect(progressWeeksLabel(w)).toBe('41–43')
    expect(progressWeeksFromDb([], new Date())).toEqual([])
  })
})

describe('I-2d/e: ETA i prom z bazy', () => {
  it('pigułka opóźnienia: produkcja = loads.delay_minutes, bez zastępczych 95', () => {
    expect(delayPillMinutes({ delayed: true, delayMinutesDb: null }, null, true)).toBeNull()
    expect(delayPillMinutes({ delayed: true, delayMinutesDb: 42 }, 10, true)).toBe(42)
    expect(delayPillMinutes({ delayed: true }, null, false)).toBe(95)
    expect(delayPillMinutes({ delayed: false, delayMinutesDb: 42 }, null, true)).toBeNull()
  })
  it('ufność z pasma minut: ≤60 HIGH, ≤240 MED, inaczej / brak LOW', () => {
    expect([30, 60, 61, 240, 241, null].map((m) => etaConfidenceFromMinutes(m))).toEqual(['HIGH', 'HIGH', 'MED', 'MED', 'LOW', 'LOW'])
  })
  it('najbliższy rejs z sailings: pomija odwołane i przeszłe, uwzględnia opóźnienie', () => {
    const s = (id: string, dep: string, status = 'ZAPLANOWANY', delayed: string | null = null) =>
      ({ id, route: 'GDN-NYN', vessel: 'V', departureAt: dep, arrivalAt: dep, delayedDepartureAt: delayed, delayedArrivalAt: null, status }) as unknown as Sailing
    const now = Date.parse('2026-10-01T12:00:00Z')
    expect(nextDbSailing([s('a', '2026-10-01T10:00:00Z'), s('b', '2026-10-02T10:00:00Z', 'ODWOLANY'), s('c', '2026-10-03T10:00:00Z'), s('d', '2026-10-01T11:00:00Z', 'OPOZNIONY', '2026-10-01T13:00:00Z')], now)?.id).toBe('d')
    expect(nextDbSailing([], now)).toBeNull()
  })
})

describe('I-2f: formularz BAF/SEFS', () => {
  it('tablice „próg;mnożnik”: przecinek dziesiętny, błędny wiersz → null', () => {
    expect(parseTiers('18,50;1.00\n19.5 1,02')).toEqual([{ lte: 18.5, mult: 1 }, { lte: 19.5, mult: 1.02 }])
    expect(parseTiers('abc')).toBeNull()
    expect(parseTiers('')).toBeNull()
  })
  it('odczyty aktualne pomijają skorygowane', () => {
    const r = (id: number, corrects: number | null) => ({ id, corrects_id: corrects }) as never
    expect(currentReadings([r(1, null), r(2, 1), r(3, null)]).map((x: { id: number }) => x.id)).toEqual([2, 3])
  })
})
