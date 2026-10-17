import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { notificationFromRow } from '../src/data/mappers';
import { bellAge, bellGroups, bellTitle, looksLikeTemplateCode, withLoadCode } from '../src/lib/bellList';

const L1 = '963e19dd-fe83-4690-9306-5c7fc4b95468';
const L2 = '2fc65160-0000-4000-8000-000000000002';
/** Ładunki jak na produkcji 06.10 (ostatni wpis każdego szablonu IN_APP). */
const PROD: [string, Record<string, unknown>, string | null][] = [
  ['RISK_OPEN', { kind: 'ROAD_SE', title: 'Warunki drogowe E4: wypadek, bardzo duży wpływ na ruch', risk_id: 'r1', severity: 'HIGH', title_key: 'rk_road_se' }, L1],
  ['RISK_RESOLVED', { kind: 'ROAD_SE', title: 'Warunki drogowe E4: roboty drogowe', risk_id: 'r2', severity: 'MEDIUM' }, L1],
  ['RISK_SEVERITY', { kind: 'RESOURCE_MISSING', title: 'dac580f6: brak awizacji przed załadunkiem', risk_id: 'r3', severity: 'CRITICAL' }, L2],
  ['DECISION_OPEN', { type: 'NO_POSITION', event: 'OPEN', title: 'Brak pozycji pojazdu WGM00653 od 15 min', status: 'NEW', decision_id: 'd1' }, L1],
  ['DECISION_ESCALATED', { type: 'NO_AWIZACJA', level: 'critical', title: '2fc65160: brak awizacji przed załadunkiem', status: 'NEW', decision_id: 'd2' }, L2],
  ['DECISION_RESOLVED', { type: 'ETA_AFTER_LATEST', title: 'Opóźnienie 3960 min wobec planu dostawy (próg 30)', status: 'RESOLVED', resolution: 'ESCALATE_CARRIER', decision_id: 'd3' }, L1],
  ['RESOURCE_DEADLINE', { due: '2026-10-04T22:00:00+00:00', code: 'SG-03', resource: 'VEHICLE', severity: 'CRITICAL' }, L2],
  ['ORDER_NO_MISSING', { due: '2026-10-07T22:00:00+00:00', code: 'SG-03', side: 'HHL' }, L2],
  ['LOAD_CHAT_MESSAGE', { preview: 'A teraz zobaczymy jak nam pójdzie.', load_code: '0005/09/S/2026', author_org: 'HHL', author_display: 'x@y.pl' }, L1],
  ['ZONE_ENTER', { event: 'GEOFENCE_ENTER', load_id: L1, geofence_id: 'g1', geofence_name: 'Bufor 50 km przed Boden' }, L1],
  ['ZONE_EXIT', { event: 'GEOFENCE_EXIT', load_id: L1, geofence_id: 'g2', geofence_name: null }, L1],
  ['LOAD_STATUS_CHANGED', { to: 'IN_TRANSIT_SE', from: 'READY', load_id: L1, order_no: '15062/2026/OSL/GDA/P', hhl_order_no: '0005/09/S/2026' }, L1],
  ['WORKFLOW_ALERT', { code: '15062/2026/OSL/GDA/P', rule: 'Dojazd na plac', text: null, event: 'GEOFENCE_ENTER', rule_code: 'START-1' }, L1],
  ['INVOICE_DISPUTED', { note: 'błędna wartość frachtu', number: 'WT-TEST-P6-20261005', status: 'SPORNA', invoice_id: 'i1' }, null],
];
const codes = new Map([[L1, 'SG-11'], [L2, 'SG-03']]);
const rows = PROD.map(([template, payload, load_id], i) =>
  notificationFromRow({ id: i + 1, template, payload: { ...payload, locale: 'pl' }, load_id, created_at: new Date(Date.UTC(2026, 9, 6, 12, 0) - i * 60000).toISOString(), read_at: null } as never));

describe('AUD-02 dzwonek: tytuł PL, czas względny, grupowanie, bez kodów szablonów', () => {
  it('każdy szablon z produkcji: tytuł „SG-xx · …” bez kodu szablonu i bez technicznego przedrostka', () => {
    const groups = bellGroups(rows, 'HHL', (id) => codes.get(id), 'pl');
    expect(groups).toHaveLength(rows.length);
    for (const g of groups) {
      expect(looksLikeTemplateCode(g.title), g.title).toBe(false);
      expect(looksLikeTemplateCode(g.body), g.body).toBe(false);
      expect(g.title).not.toMatch(/[0-9a-f]{8}:/);
      /* E41 (P2): pauza po nazwie, nie kropka środkowa. */
      if (g.latest.loadId) expect(g.title).toMatch(/^SG-(11|03) — \S/);
    }
    const t = groups.map((g) => g.title);
    if (process.env.AUD02_DUMP) {
      const now = Date.UTC(2026, 9, 6, 12, 15);
      writeFileSync(process.env.AUD02_DUMP, groups.map((g) => `${g.latest.kind}\t${g.title}\t${g.body}\t${bellAge(g.latest.at, now, 'pl')}\t${g.latest.href?.path ?? ''}`).join('\n') + '\n');
    }
    expect(t).toContain('SG-11 — Nowe ryzyko: Warunki drogowe E4: wypadek, bardzo duży wpływ na ruch');
    expect(t.find((x) => x.includes('Bufor 50 km przed Boden'))).toMatch(/^SG-11 — /);
    expect(t.some((x) => /^SG-(11|03) — SG-/.test(x))).toBe(false);
    expect(t.find((x) => x.includes('wagi ryzyka'))).toBe('SG-03 — Zmiana wagi ryzyka (krytyczna): brak awizacji przed załadunkiem');
    expect(groups.find((g) => g.latest.kind === 'DECISION_OPEN')?.body).not.toMatch(/e-mail/);
  });
  it('kod transportu z ładunku, gdy transportu nie ma w magazynie', () => {
    const g = bellGroups(rows, 'HHL', () => undefined, 'pl');
    expect(g.find((x) => x.latest.kind === 'RESOURCE_DEADLINE')?.title).toMatch(/^SG-03 — brak/);
  });
  it('grupowanie: ten sam transport + ten sam rodzaj = jedna pozycja z licznikiem i najwyższą wagą; najnowsza treść', () => {
    const base = { template: 'RISK_OPEN', load_id: L1, read_at: null };
    const many = [5, 3, 1].map((m, i) => notificationFromRow({ ...base, id: 100 + i, created_at: `2026-10-06T12:0${m}:00Z`, payload: { title: `Zdarzenie ${m}`, severity: i === 1 ? 'CRITICAL' : 'MEDIUM', locale: 'pl' } } as never));
    const other = notificationFromRow({ ...base, id: 200, template: 'RISK_RESOLVED', created_at: '2026-10-06T12:02:00Z', payload: { title: 'X', locale: 'pl' } } as never);
    const otherLoad = notificationFromRow({ ...base, id: 201, load_id: L2, created_at: '2026-10-06T12:04:00Z', payload: { title: 'Y', locale: 'pl' } } as never);
    const g = bellGroups([...many, other, otherLoad], 'HHL', (id) => codes.get(id), 'pl');
    expect(g).toHaveLength(3);
    expect(g[0].count).toBe(3);
    expect(g[0].ids).toEqual(['srv-100', 'srv-101', 'srv-102']);
    expect(g[0].title).toBe('SG-11 — Nowe ryzyko: Zdarzenie 5');
    expect(g[0].severity).toBe('CRITICAL');
    expect(g[0].body).toMatch(/^3 zdarzenia tego rodzaju/);
  });
  it('czas względny: „15 min temu”, nie „15m”', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(bellAge('2026-10-06T11:45:00Z', now, 'pl')).toBe('15 min temu');
    expect(bellAge('2026-10-06T11:59:40Z', now, 'pl')).toBe('teraz');
    expect(bellAge('2026-10-06T09:00:00Z', now, 'pl')).toBe('3 godz. temu');
    expect(bellAge('2026-10-05T10:00:00Z', now, 'pl')).toBe('wczoraj');
    expect(bellAge('2026-10-01T10:00:00Z', now, 'pl')).toBe('5 dni temu');
    expect(bellAge('2026-10-06T11:45:00Z', now, 'en')).toBe('15 min temu'); /* 8A (17.10): tylko po polsku */
    expect(bellAge('2026-10-06T11:45:00Z', now, 'sv')).toBe('15 min temu');
  });
  it('nieznany szablon → „Powiadomienie”, nigdy kod', () => {
    expect(bellTitle('SOME_NEW_TEMPLATE', 'SG-01', 'pl')).toBe('SG-01 — Powiadomienie');
    const n = notificationFromRow({ id: 9, template: 'SOME_NEW_TEMPLATE', payload: { locale: 'pl' }, load_id: null, created_at: '2026-10-06T12:00:00Z', read_at: null } as never);
    expect(bellGroups([n], 'HHL', () => undefined, 'pl')[0].title).not.toMatch(/SOME_NEW_TEMPLATE/);
  });
  it('klik → cel L-4 (najnowsza pozycja), reszta grupy przeczytana; ryzyko → widok ryzyk', () => {
    const risk = rows[0];
    expect(risk.href?.path).toBeTruthy();
    expect(risk.href?.path).not.toMatch(/szczegoly-wpisu/);
    const src = readFileSync('src/components/shell/NotificationBell.tsx', 'utf8');
    expect(src).toMatch(/openNotification\(g\.latest\.id\)/);
    expect(src).toMatch(/for \(const id of g\.ids\.slice\(1\)\) markNotificationRead\(id\)/);
    expect(src).not.toMatch(/function relTime/);
    expect(withLoadCode('/transport/brak?zakladka=status', 'SG-11')).toBe('/transport/SG-11?zakladka=status');
    expect(withLoadCode('/transport/15062%2F2026?zakladka=status', 'SG-11')).toBe('/transport/SG-11?zakladka=status');
    expect(withLoadCode('/decyzje/d1', 'SG-11')).toBe('/decyzje/d1');
    expect(withLoadCode('/transport/brak', undefined)).toBe('/transport/brak');
    expect(readFileSync('src/store/useTowerStore.ts', 'utf8')).toMatch(/withLoadCode\(href\.path, loadCode\)/);
  });
  it('E21 (P2): „Nieznany kod źródła drogowego” nie wchodzi do dzwonka', () => {
    const n = notificationFromRow({
      id: 77, template: 'RISK_OPEN', load_id: L1, created_at: '2026-10-06T12:00:00Z', read_at: null,
      payload: { title: 'Nieznany kod źródła drogowego — w panelu: zdarzenie drogowe', locale: 'pl', kind: 'ROAD_SE' },
    } as never);
    expect(bellGroups([n], 'HHL', () => 'SG-11', 'pl')).toHaveLength(0);
  });
});
