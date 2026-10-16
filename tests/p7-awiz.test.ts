/**
 * wyglad/P7-a — E32 (img/e32-after): jedna definicja kompletnej awizacji, termin 48/12 h, dni tygodnia,
 * konwój KR (D-20261009-1309-01 R1), tabela symboli (D-83, WYMIARY_PILOT_ZEZWOLENIA) i strażnik I-0 źródła danych.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { awizDeadline, awizMissing, awizState, convoyOf, dayLong, dayShort, dmHm, hourWindow, isoWeek, NO_PILOTS, pilotsMissingCount, segmentNow, warsawInstant } from '../src/lib/p7Awiz'
import { demoSymbolSpec } from '../src/lib/p7Demo'
import { pt, ptHas } from '../src/i18n/p7'

const FULL = { driverName: 'Jan Testowy', driverPhone: '600000001', tractorPlate: 'TE 00001', trailerPlate: 'TE 00002' }

describe('E32 pkt 6 — kompletna awizacja (jedna definicja)', () => {
  it('pusta: kierowca, telefon, ciągnik, naczepa', () => {
    const m = awizMissing({}, false, null)
    expect(m).toEqual(['driver', 'phone', 'tractor', 'trailer'])
    expect(awizState({}, m)).toBe('none')
    expect(m.map((k) => pt('pl', `p7_miss_${k}`)).join(', ')).toBe('kierowca, telefon, ciągnik, naczepa')
  })
  it('bez telefonu i naczepy → „Brakuje: telefon, naczepa”, stan „część”', () => {
    const r = { driverName: 'Jan Testowy', tractorPlate: 'TE 00001' }
    const m = awizMissing(r, false, null)
    expect(m).toEqual(['phone', 'trailer'])
    expect(awizState(r, m)).toBe('part')
  })
  it('komplet; spacje to brak', () => {
    expect(awizMissing(FULL, false, null)).toEqual([])
    expect(awizState(FULL, [])).toBe('ok')
    expect(awizMissing({ ...FULL, trailerPlate: '  ' }, false, null)).toEqual(['trailer'])
  })
  it('przepięcie naczepy wymaga odcinka SE (E6)', () => {
    expect(awizMissing({ ...FULL, trailerSwap: true }, false, null)).toEqual(['driverSe', 'phoneSe', 'tractorSe'])
    expect(awizMissing({ ...FULL, trailerSwap: true, driverDeliveryName: 'Erik Test', driverDeliveryPhone: '700000001', tractorDeliveryPlate: 'ABC 001' }, false, null)).toEqual([])
  })
  it('piloci tylko przy „PL + SE”: numer rejestracyjny oraz imię i nazwisko (D-20261009-1233-01)', () => {
    expect(awizMissing(FULL, true, null)).toEqual(['pilotPl', 'pilotSe'])
    expect(pilotsMissingCount(awizMissing(FULL, true, NO_PILOTS))).toBe(2)
    const half = { pl: { plate: 'WX 00001', name: null }, se: { plate: null, name: 'Karl Test' } }
    expect(awizMissing(FULL, true, half)).toEqual(['pilotPlName', 'pilotSePlate'])
    expect(pilotsMissingCount(awizMissing(FULL, true, half))).toBe(2)
    expect(awizMissing(FULL, false, half)).toEqual([])
    for (const k of ['pilotPl', 'pilotPlPlate', 'pilotPlName', 'pilotSe', 'pilotSePlate', 'pilotSeName', 'driverSe', 'phoneSe', 'tractorSe']) expect(ptHas(`p7_miss_${k}`)).toBe(true)
  })
})

describe('E32 — termin awizacji 48 h / 12 h przed dniem załadunku (0143)', () => {
  it('SG-15 z makiety: załadunek czw. 08.10.2026 → pilne od 07.10.2026, 12:00', () => {
    const d = awizDeadline('2026-10-08', '2026-10-07T11:00:00Z')!
    expect(dmHm(d.urgentAt)).toBe('07.10.2026, 12:00')
    expect(dmHm(d.warnAt)).toBe('06.10.2026, 00:00')
    expect(d.phase).toBe('urgent')
  })
  it('z godziną załadunku z planu — od tej godziny (jak l3_anchor w 0143)', () => {
    const d = awizDeadline('2026-10-08', '2026-10-07T11:00:00Z', '2026-10-08T08:00:00+02:00')!
    expect(d.byHour).toBe(true)
    expect(dmHm(d.urgentAt)).toBe('07.10.2026, 20:00')
    expect(d.phase).toBe('warn')
    expect(awizDeadline('2026-10-08', '2026-10-07T11:00:00Z')!.byHour).toBe(false)
  })
  it('fazy: wcześnie → ostrzeżenie → pilne', () => {
    expect(awizDeadline('2026-10-08', '2026-10-05T10:00:00Z')!.phase).toBe('early')
    expect(awizDeadline('2026-10-08', '2026-10-06T10:00:00Z')!.phase).toBe('warn')
    expect(awizDeadline('bez daty', '2026-10-06T10:00:00Z')).toBeNull()
  })
  it('północ w Polsce przy zmianie czasu (CEST / CET)', () => {
    expect(new Date(warsawInstant('2026-10-08')).toISOString()).toBe('2026-10-07T22:00:00.000Z')
    expect(new Date(warsawInstant('2026-11-10')).toISOString()).toBe('2026-11-09T23:00:00.000Z')
  })
})

describe('E32 pkt 4 — daty z dniem tygodnia', () => {
  it('„czw. 08.10.2026” (rok zawsze — właściciel 16.10.2026), tydzień, godziny', () => {
    expect(dayShort('2026-10-08')).toBe('czw. 08.10.2026')
    expect(dayLong('2026-10-14')).toBe('śr. 14.10.2026')
    expect(dayLong('2026-10-18')).toBe('niedz. 18.10.2026')
    expect(dayShort(null)).toBe('—')
    expect(isoWeek('2026-10-08')).toBe(41)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(hourWindow('2026-10-08T06:00:00Z', '2026-10-08T14:00:00Z')).toBe('08:00–16:00')
    expect(hourWindow(null, null)).toBeNull()
  })
  it('odcinek „teraz” (E6)', () => {
    expect(segmentNow({ status: 'IN_TRANSIT_PL', stage: 'TO_PORT' } as never)).toBe('PL')
    expect(segmentNow({ status: 'IN_TRANSIT_SE', stage: 'SE_ROAD' } as never)).toBe('SE')
    expect(segmentNow({ status: 'PLANNED', stage: 'PREP' } as never)).toBeNull()
  })
})

describe('Tabela symboli i konwój KR', () => {
  it('KR i PL-B wymagają pilotów, SG nie; PL-B po szerokości 3,40 m', () => {
    const dims = (w: number) => ({ widthM: w }) as never
    expect(demoSymbolSpec({ code: 'K-01', dims: dims(3.6) })).toMatchObject({ symbol: 'KR', pilots: true, permit: 'TRASA', set: { l: 23.69, w: 3.52, h: 3.9 } })
    expect(demoSymbolSpec({ code: 'P-01', dims: dims(3.4) })).toMatchObject({ symbol: 'PL-B', pilots: true, permit: 'FIRMA' })
    expect(demoSymbolSpec({ code: 'P-02', dims: dims(2.45) })).toMatchObject({ symbol: 'PL-A', pilots: false })
    expect(demoSymbolSpec({ code: 'SG-15', dims: dims(2.45) })).toMatchObject({ symbol: 'SG', pilots: false, set: { l: 21.69, w: 2.45, h: 3.75 } })
    expect(demoSymbolSpec({ code: 'X-01', dims: dims(2.45) })).toBeNull()
  })
  it('konwój: ten sam symbol i ta sama data załadunku, co najmniej dwa transporty', () => {
    const L = (id: string, code: string, d: string | null) => ({ id, code, plannedLoadDate: d })
    const loads = [L('1', 'KR-10', '2026-10-22'), L('2', 'KR-2', '2026-10-22'), L('3', 'KR-3', '2026-10-23'), L('4', 'SG-1', '2026-10-22')]
    const kr = (l: { code: string }) => l.code.startsWith('KR')
    expect(convoyOf(loads[0], loads, kr).map((l) => l.code)).toEqual(['KR-2', 'KR-10'])
    expect(convoyOf(loads[2], loads, kr)).toEqual([])
    expect(convoyOf(loads[3], loads, kr)).toEqual([])
  })
})

describe('I-0 / F8 — źródło danych P7-a', () => {
  const src = readFileSync('src/lib/p7Source.ts', 'utf8')
  it('przykłady demo tylko za warunkiem trybu wpisanym wprost; produkcja: null / false', () => {
    const lines = src.split('\n').filter((l) => /return .*demo[A-Z]/.test(l))
    expect(lines.length).toBe(4) // wyglad/P7-b (E32 pkt 7): + saveSetOf
    for (const line of lines) {
      expect(line).toMatch(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase' \? /)
    }
    /* audyt-AF F-07: w demo według rodzaju konta (Operacje HHL bez poprawiania); produkcja nadal false */
    expect(src).toMatch(/role === 'HHL' && getAuthProfile\(\)\?\.role !== 'HHL_OPS' : false/)
  })
  it('bez zapytań i zapisów do bazy w nowych plikach', () => {
    /* AwizacjaModal.tsx poza listą: zapis awizacji i „Otwórz w RIO” (PR #203, E44) należą do wykonawcy */
    for (const f of ['src/lib/p7Source.ts', 'src/lib/p7Demo.ts', 'src/lib/p7Awiz.ts', 'src/components/drawer/PanelOverview.tsx']) {
      const s = readFileSync(f, 'utf8')
      expect(s, f).not.toMatch(/\.rpc\(|\.from\(['"]|createClient|getSupabase|supabaseClient/)
    }
  })
  it('przykładowe numery pilotów i nazwiska zmyślone (G-09)', () => {
    const demo = readFileSync('src/lib/p7Demo.ts', 'utf8')
    for (const m of demo.match(/plate: '([^']+)'/g) ?? []) expect(m).toMatch(/'(WX 0000\d|ABC 00\d)'/)
  })
})
