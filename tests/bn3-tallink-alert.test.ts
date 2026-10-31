/**
 * BN3 — Tallink Alert + Lisainfo ts.ee (decyzje 57, 59).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodeTallinkCmsHtml,
  matchTallinkAlertSailings,
  parseTallinkAlerts,
} from '../src/lib/ferry/tallinkAlert';
import { parsePortTallinnHtml } from '../src/lib/ferry/portTallinn';

const FIX = readFileSync(new URL('./fixtures/tallink-alert-cancel-mystar.html', import.meta.url), 'utf8');

describe('BN3 Tallink Alert', () => {
  it('dekoduje escapes CMS i wyciąga Alert (bez kampanii)', () => {
    const decoded = decodeTallinkCmsHtml(FIX);
    expect(decoded).toContain('data-analytics-group="Alert"');
    expect(decoded).toContain('MyStar');
    const { alerts, warnings } = parseTallinkAlerts(FIX, 'https://www.tallink.com/');
    expect(warnings).toEqual([]);
    expect(alerts.length).toBe(1);
    expect(alerts[0]!.kind).toBe('ODWOLANY');
    expect(alerts[0]!.vessel).toBe('M/F MyStar');
    expect(alerts[0]!.routes).toEqual(expect.arrayContaining(['TLL-HEL', 'HEL-TLL']));
    expect(alerts[0]!.windowStartYmd).toBe('2026-11-02');
    expect(alerts[0]!.windowEndYmd).toBe('2026-11-02');
  });

  it('jednoznaczne dopasowanie → match; dwa rejsy → ambiguous', () => {
    const alert = parseTallinkAlerts(FIX).alerts[0]!;
    const one = matchTallinkAlertSailings(alert, [{
      id: 's1', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
    }]);
    expect(one.match?.id).toBe('s1');
    expect(one.ambiguous).toBe(false);

    const two = matchTallinkAlertSailings(alert, [
      {
        id: 's1', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's2', vesselName: 'M/F MyStar', route: 'HEL-TLL',
        departureAt: '2026-11-02T14:00:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    ]);
    expect(two.match).toBeNull();
    expect(two.ambiguous).toBe(true);

    const recznie = matchTallinkAlertSailings(alert, [{
      id: 's3', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'RECZNIE',
    }]);
    expect(recznie.match).toBeNull();
  });
});

describe('BN3 Port of Tallinn Lisainfo', () => {
  it('Lisainfo z odwołaniem ustawia cancelled + treść', () => {
    const html = `
<table id="passenger-lines-outbound">
<tr data-terminal="d" data-from_to="helsinki" data-company="tallink">
<td data-sort_value="13:30">13:30</td>
<td data-sort_value="Megastar">Megastar</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="D">Terminal D</td>
<td data-sort_value="Tallink">Tallink</td>
<td data-sort_value="cancelled">Cancelled — technical reasons</td>
</tr>
</table>
<table id="passenger-lines-inbound"></table>`;
    const r = parsePortTallinnHtml(html, '2026-11-02');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.cancelled).toBe(true);
    expect(r.events[0]!.lisainfo).toMatch(/Cancelled/i);
    expect(r.events[0]!.vessel).toBe('M/F Megastar');
    expect(r.events[0]!.route).toBe('TLL-HEL');
  });
});
