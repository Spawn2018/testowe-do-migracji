/** D14 — mapa ścieżek ↔ widoków (HashRouter). */
import { describe, expect, it } from 'vitest';
import { VIEW_PATH, buildRoute, parseRoute } from '../src/lib/routes';

describe('D14 trasy', () => {
  it('każdy widok ma unikalną ścieżkę i wraca z parseRoute', () => {
    const paths = Object.values(VIEW_PATH);
    expect(new Set(paths).size).toBe(paths.length);
    for (const [view, path] of Object.entries(VIEW_PATH)) expect(parseRoute(path)).toEqual({ kind: 'view', view });
  });
  it('wymagane adresy ze zlecenia', () => {
    expect(parseRoute('/harmonogram')).toEqual({ kind: 'view', view: 'sched' });
    expect(parseRoute('/mapa')).toEqual({ kind: 'view', view: 'map' });
    expect(parseRoute('/faktury')).toEqual({ kind: 'view', view: 'inv' });
    expect(parseRoute('/ustawienia')).toEqual({ kind: 'view', view: 'settings' });
    expect(parseRoute('/transport/SG-32')).toEqual({ kind: 'transport', code: 'SG-32' });
    expect(parseRoute('/transport/sg-32/')).toEqual({ kind: 'transport', code: 'SG-32' });
  });
  it('root i nieznane ścieżki (np. fragment powrotu z logowania) rozróżnione', () => {
    expect(parseRoute('/')).toEqual({ kind: 'root' });
    expect(parseRoute('')).toEqual({ kind: 'root' });
    expect(parseRoute('/access_token=abc&type=magiclink')).toEqual({ kind: 'unknown' });
    expect(parseRoute('/driver/demo-active')).toEqual({ kind: 'unknown' });
  });
  it('buildRoute: szuflada ma pierwszeństwo przed widokiem', () => {
    expect(buildRoute('sched', null)).toBe('/harmonogram');
    expect(buildRoute('sched', 'SG-32')).toBe('/transport/SG-32');
  });
});
