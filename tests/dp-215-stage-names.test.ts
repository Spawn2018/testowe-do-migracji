import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/messages';
import { routeStageLabel, routeStatusLabel, stageOnlyLabel, statusLabel } from '../src/lib/statusLabel';

/** DP-215 (#798) — etapy/kafelki + statusy (właściciel 04.11 21:10). */
describe('DP-215 neutralne nazwy etapów i statusów', () => {
  it('kafelki paska E28', () => {
    expect(t('pl', 'p4_tile_ROAD_PL')).toBe('Droga do portu');
    expect(t('pl', 'p4_tile_PORT_PL')).toBe('Port wyjścia');
    expect(t('pl', 'p4_tile_FERRY')).toBe('Prom');
    expect(t('pl', 'p4_tile_PORT_SE')).toBe('Port docelowy');
    expect(t('pl', 'p4_tile_ROAD_SE')).toBe('Droga do placu');
  });

  it('stage_* i stageOnlyLabel (także GDN-NYN)', () => {
    expect(t('pl', 'stage_TO_PORT')).toBe('Droga do portu');
    expect(t('pl', 'stage_GDANSK')).toBe('Port wyjścia');
    expect(t('pl', 'stage_APPROACH')).toBe('Port docelowy');
    expect(t('pl', 'stage_SE_ROAD')).toBe('Droga do placu');
    expect(stageOnlyLabel('GDANSK', 'pl')).toBe('Port wyjścia');
    expect(stageOnlyLabel('APPROACH', 'pl')).toBe('Port docelowy');
    expect(routeStageLabel('GDANSK', 'pl', 'TLL-HEL')).toMatch(/^Port wypłynięcia/);
    expect(routeStageLabel('APPROACH', 'pl', 'TLL-HEL')).toMatch(/^Port przypłynięcia/);
    expect(routeStageLabel('GDANSK', 'pl', null)).toBe('Port wyjścia');
  });

  it('statusy: Polferries / Stena / bez rejsu — konwencja jak EE (właściciel 04.11 21:10)', () => {
    expect(statusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl')).toBe('Droga do portu');
    expect(statusLabel('AT_PORT', undefined, 'pl')).toBe('Port wypłynięcia');
    expect(statusLabel('AT_PORT_SE', undefined, 'pl')).toBe('Port przypłynięcia');
    expect(statusLabel('IN_TRANSIT_SE', undefined, 'pl')).toBe('Droga do placu');
    expect(routeStatusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl', null)).toBe('Droga do portu');
    expect(routeStatusLabel('AT_PORT', undefined, 'pl', null)).toBe('Port wypłynięcia');
    expect(routeStatusLabel('AT_PORT_SE', undefined, 'pl', null)).toBe('Port przypłynięcia');
    expect(routeStatusLabel('IN_TRANSIT_SE', undefined, 'pl', null)).toBe('Droga do placu');
    expect(routeStatusLabel('AT_PORT', undefined, 'pl', 'GDN-NYN')).toBe('Port wypłynięcia — Gdańsk');
    expect(routeStatusLabel('AT_PORT_SE', undefined, 'pl', 'GDN-NYN')).toBe('Port przypłynięcia — Nynäshamn');
    expect(routeStatusLabel('IN_TRANSIT_PL', undefined, 'pl', 'GDN-NYN')).toBe('Droga do portu');
    expect(routeStatusLabel('IN_TRANSIT_SE', undefined, 'pl', 'GDN-NYN')).toBe('Droga do placu');
    expect(routeStatusLabel('AT_PORT', undefined, 'pl', 'GDY-KAA')).toBe('Port wypłynięcia — Gdynia');
    expect(routeStatusLabel('AT_PORT_SE', undefined, 'pl', 'GDY-KAA')).toBe('Port przypłynięcia — Karlskrona');
  });
});
