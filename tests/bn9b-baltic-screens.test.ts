import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isOperatorOutboundRoute, routeEnds, routeShortLabel, waterTrackOf } from '../src/lib/ferryCatalog';
import { ferryRouteLabel } from '../src/lib/portName';
import { crossingLine, nearestCrossingByOperator } from '../src/lib/sailings';
import { routeStageLabel, routeStatusLabel, statusLabel } from '../src/lib/statusLabel';
import { extraWaterTracksFor } from '../src/lib/map/ferryLines';
import type { Sailing } from '../src/types';

const NOW = Date.parse('2026-10-30T08:00:00Z');
const S = (p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing => ({
  vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
  status: 'ZAPLANOWANY', source: 'RECZNIE', ...p,
});

describe('BN9-b — ekrany Korytarza bałtyckiego', () => {
  it('etykieta trasy z Terminalem A i z każdego kodu katalogu', () => {
    expect(routeEnds('TLLA-HEL')).toEqual({ from: 'TLL', to: 'HEL', fromTerminal: 'A' });
    expect(routeEnds('HELA-TLL')).toEqual({ from: 'HEL', to: 'TLL', toTerminal: 'A' });
    expect(routeShortLabel('TLLA-HEL')).toBe('TLLA → HEL');
    expect(routeShortLabel('HELA-TLL')).toBe('HEL → TLLA');
    expect(ferryRouteLabel('pl', 'TLLA-HEL')).toBe('Tallinn A → Helsinki');
    expect(ferryRouteLabel('pl', 'GDN-NYN')).toBe('Gdańsk → Nynäshamn');
    expect(ferryRouteLabel('pl', 'NIEZNANA')).toBe('NIEZNANA');
  });

  it('Terminal A liczy się jako trasa wyjazdowa Viking Line i Eckerö (Kokpit, pasek, Ryzyka)', () => {
    expect(isOperatorOutboundRoute('ECKERO', 'TLLA-HEL')).toBe(true);
    expect(isOperatorOutboundRoute('VIKING', 'TLLA-HEL')).toBe(true);
    expect(isOperatorOutboundRoute('ECKERO', 'HELA-TLL')).toBe(false);
    expect(isOperatorOutboundRoute('POLFERRIES', 'TLLA-HEL')).toBe(false);
    const s = S({ id: 'e1', route: 'TLLA-HEL', departureAt: '2026-10-30T16:30:00Z', operator: 'Eckerö Line', vessel: 'Finlandia' });
    expect(crossingLine(s)).toBe('ECKERO');
    expect(nearestCrossingByOperator([s], NOW).ECKERO?.map((x) => x.id)).toEqual(['e1']);
  });

  it('oś statusów: nazwy portów dla nowych przepraw, Stena/Polferries bez zmian (25A)', () => {
    expect(routeStatusLabel('AT_PORT', undefined, 'pl', 'TLLA-HEL')).toBe('Port wypłynięcia — Tallinn A');
    expect(routeStatusLabel('AT_PORT_SE', undefined, 'pl', 'TLL-HEL')).toBe('Port przypłynięcia — Helsinki');
    for (const st of ['AT_PORT', 'AT_PORT_SE', 'IN_TRANSIT_PL', 'IN_TRANSIT_SE'] as const) {
      expect(routeStatusLabel(st, undefined, 'pl', 'GDN-NYN')).toBe(statusLabel(st, undefined, 'pl'));
      expect(routeStatusLabel(st, undefined, 'pl', null)).toBe(statusLabel(st, undefined, 'pl'));
    }
  });

  /* DP-137 / F7 #708: enum IN_TRANSIT_SE i synthetic_port_se zostają; UI FI ≠ „Droga SE”. */
  it('DP-137: IN_TRANSIT_SE / Port SE na trasie FI → Droga do placu / Port przypłynięcia', () => {
    expect(routeStatusLabel('IN_TRANSIT_SE', 'SE_ROAD', 'pl', 'TLL-HEL')).toBe('Droga do placu');
    expect(routeStatusLabel('IN_TRANSIT_SE', 'SE_ROAD', 'pl', 'MUU-VUO')).toBe('Droga do placu');
    expect(routeStatusLabel('IN_TRANSIT_SE', undefined, 'pl', 'TLLA-HEL')).toBe('Droga do placu');
    expect(routeStatusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl', 'TLL-HEL')).toBe('Droga do portu');
    expect(routeStatusLabel('AT_PORT_SE', 'APPROACH', 'pl', 'MUU-VUO')).toBe('Port przypłynięcia — Vuosaari');
    expect(routeStatusLabel('IN_TRANSIT_SE', 'SE_ROAD', 'pl', 'GDN-NYN')).toBe('Droga SE');
    expect(routeStageLabel('SE_ROAD', 'pl', 'TLL-HEL')).toBe('Droga do placu');
    expect(routeStageLabel('APPROACH', 'pl', 'TLL-HEL')).toBe('Port przypłynięcia — Helsinki');
    expect(routeStageLabel('SE_ROAD', 'pl', 'GDN-NYN')).toBe('Droga SE');
  });

  it('mapa: tory nowych przepraw zawsze w warstwie promu, Terminal A na torze Tallinn–Helsinki', () => {
    expect(waterTrackOf('TLLA-HEL')).toBe('TLL-HEL');
    expect(extraWaterTracksFor(['TLLA-HEL']).map((x) => x.id)).toEqual(['TLL-HEL']);
    const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
    /* DP-7: tory z jednego źródła (`ferryLaneLines`) */
    expect(pool).toMatch(/drawFerryLanes\(ferryLeg\)/);
    expect(readFileSync('src/lib/map/ferryLanes.ts', 'utf8')).toMatch(/Object\.values\(WATER_TRACKS_EXTRA\)/);
    /* linie drogowe (pomarańczowe) — poza BN9-b */
    expect(pool).not.toMatch(/here_road_geometry/);
  });
});
