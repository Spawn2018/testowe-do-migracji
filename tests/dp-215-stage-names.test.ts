import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/messages';
import { routeStageLabel, routeStatusLabel, stageOnlyLabel, statusLabel } from '../src/lib/statusLabel';

/** DP-215 (#798) — neutralne nazwy etapów / kafelków; statusy bez zmian. */
describe('DP-215 neutralne nazwy etapów', () => {
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

  it('statusy s_* bez zmiany (lista do decyzji właściciela)', () => {
    expect(statusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl')).toBe('Droga PL');
    expect(statusLabel('AT_PORT', undefined, 'pl')).toBe('Port PL');
    expect(statusLabel('AT_PORT_SE', undefined, 'pl')).toBe('Port SE');
    expect(statusLabel('IN_TRANSIT_SE', undefined, 'pl')).toBe('Droga SE');
    expect(routeStatusLabel('AT_PORT', undefined, 'pl', 'GDN-NYN')).toBe('Port PL');
  });
});
