import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALTIC_CENTER, isBalticCenter, newGeofenceDraft, notifyWho, placeForCountry } from '../src/lib/geofenceDraft';
import { SITES } from '../src/lib/status';
import { geofenceFromRow, geofenceToRpc } from '../src/data/mappers';
import type { OrgRow } from '../src/data/mappers';

const ORGS: OrgRow[] = [
  { id: '00000000-0000-0000-0000-0000000000a1', code: 'HHL', kind: 'FORWARDER' },
  { id: '00000000-0000-0000-0000-0000000000a2', code: 'KSH', kind: 'CLIENT' },
  { id: '00000000-0000-0000-0000-0000000000a3', code: 'SCX', kind: 'CARRIER' },
];

describe('L-12 kreator stref', () => {
  it('nowa strefa startuje w Śremie, nie na środku Bałtyku', () => {
    const g = newGeofenceDraft('Nowa strefa');
    expect(g.lat).toBe(SITES.loading.lat);
    expect(g.lng).toBe(SITES.loading.lng);
    expect(g.country).toBe('PL');
    expect(isBalticCenter(g.lat, g.lng)).toBe(false);
    expect(isBalticCenter(BALTIC_CENTER.lat, BALTIC_CENTER.lng)).toBe(true);
    expect(placeForCountry('SE')).toEqual({ lat: SITES.site.lat, lng: SITES.site.lng });
  });

  it('kogo powiadomić bierze ptaszki, nie rodzaj', () => {
    expect(notifyWho({ notifyHhl: true, notifyKsh: true, notifyScx: false })).toBe('KSH, HHL');
    expect(notifyWho({ notifyHhl: false, notifyKsh: false, notifyScx: false })).toBe('—');
  });

  it('kraj przechodzi z widoku do zapisu', () => {
    const g = geofenceFromRow({
      id: '00000000-0000-0000-0000-0000000000b1',
      name: 'Plac',
      kind: 'SITE',
      hysteresis_m: 200,
      dwell_seconds: 0,
      debounce_fixes: 1,
      notify_enter: true,
      notify_exit: false,
      notify_dwell: false,
      notify_orgs: [ORGS[0].id],
      active: true,
      lat: 65.8,
      lng: 21.7,
      radius_m: 800,
      country: 'SE',
    }, ORGS);
    expect(g.country).toBe('SE');
    expect(geofenceToRpc(g, 'p', ORGS, g.id).p_country).toBe('SE');
  });

  it('widok stref nie stawia nowej strefy na 60°N 18°E', () => {
    const src = readFileSync('src/views/GeofenceView.tsx', 'utf8');
    expect(src).not.toMatch(/lat:\s*60\b/);
    expect(src).toContain('newGeofenceDraft');
    expect(src).toContain('deleteGeofence');
    expect(src).toContain('GeofenceEditorMap');
  });
});
