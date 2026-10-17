import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDemoSnapshot, demoProvider } from '../src/data/demoProvider';
import { DATA_SNAPSHOT_KEYS, emptySnapshot } from '../src/data/provider';
import { hasRemoteSink, isServerId, registerRemoteSink, writeThrough } from '../src/data/registry';
import {
  awizacjaPatchToDb, eventFromRow, eventToRow, geofenceFromRow, geofenceToRpc, loadFromRow, resourcesPatchToDb,
  statusFromDb, statusToDb, ferryFromRow, ferryPatchToDb, vesselToDb, type LoadRow, type OrgRow,
} from '../src/data/mappers';
import { useTowerStore } from '../src/store/useTowerStore';
import type { DataMutation } from '../src/data/provider';
import type { LoadStatus } from '../src/types';
import { stageTileOf } from '../src/lib/stageTiles';

const ORGS: OrgRow[] = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'HHL', kind: 'FORWARDER' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'KSH', kind: 'CLIENT' },
  { id: '33333333-3333-4333-8333-333333333333', code: 'SCX', kind: 'CARRIER' },
];
const LOAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('BK3 DemoProvider', () => {
  it('store initial data == DemoProvider snapshot (baseline source unchanged)', () => {
    const snap = buildDemoSnapshot();
    const st = useTowerStore.getState();
    for (const k of DATA_SNAPSHOT_KEYS) expect(st[k]).toEqual(snap[k]);
    expect(snap.loads.length).toBeGreaterThanOrEqual(72);
  });
  it('demo apply is a no-op and snapshot is deterministic', async () => {
    await expect(demoProvider.apply({ type: 'message.send', loadId: 'load-001', text: 'x' })).resolves.toBeUndefined();
    expect(await demoProvider.loadSnapshot()).toEqual(buildDemoSnapshot());
  });
  it('empty snapshot has every key and no data', () => {
    const e = emptySnapshot();
    for (const k of DATA_SNAPSHOT_KEYS) expect(e[k]).toEqual([]);
  });
});

describe('BK3 registry — demo data never leaves the browser', () => {
  it('no sink → writeThrough no-op; demo ids filtered even with a sink', () => {
    registerRemoteSink(null);
    expect(hasRemoteSink()).toBe(false);
    writeThrough({ type: 'load.status', loadId: LOAD_ID, status: 'READY' });
    const seen: DataMutation[] = [];
    registerRemoteSink((m) => seen.push(m));
    writeThrough({ type: 'load.status', loadId: 'load-001', status: 'READY' });
    writeThrough({ type: 'event.append', event: { loadId: 'load-002', type: 'NOTE', at: 'x', actor: 'HHL' } });
    writeThrough({ type: 'load.status', loadId: LOAD_ID, status: 'READY' });
    registerRemoteSink(null);
    expect(seen).toHaveLength(1);
    expect(isServerId('gf-01')).toBe(false);
    expect(isServerId(LOAD_ID)).toBe(true);
  });
  it('store actions on demo loads do not reach a registered sink', () => {
    const seen: DataMutation[] = [];
    registerRemoteSink((m) => seen.push(m));
    const id = useTowerStore.getState().loads[0].id;
    useTowerStore.getState().sendMessage(id, 'demo');
    useTowerStore.getState().appendEvent({ loadId: id, type: 'NOTE', at: '2026-09-25T00:00:00Z', actor: 'HHL' });
    registerRemoteSink(null);
    expect(seen).toHaveLength(0);
  });
  it('persist: Supabase mode uses a separate key and UI-only fields (source check)', () => {
    const src = readFileSync('src/store/useTowerStore.ts', 'utf8');
    expect(src).toMatch(/SUPABASE_MODE \? `\$\{STORE_PERSIST_KEY\}-supabase`/);
    expect(src).toMatch(/SUPABASE_MODE \? emptySnapshot\(\) : buildDemoSnapshot\(\)/);
  });
});

describe('BK3 mappers', () => {
  it('status round-trip for every DB-backed app status; flags stay local', () => {
    // E25 (P4): UNLOADING/UNLOADED → DELIVERED; nowe READY_TO_INVOICE / INVOICED
    // E25 / D-20261014-0315-01 H1: AT_PORT_NYNASHAMN → AT_PORT_SE (Port SE)
    const app: LoadStatus[] = [
      'PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING', 'READY', 'LOADING', 'IN_TRANSIT_PL',
      'AT_PORT', 'ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'DELIVERED',
      'READY_TO_INVOICE', 'INVOICED',
    ];
    for (const s of app) expect(statusFromDb(statusToDb(s)!)).toBe(s);
    expect(statusToDb('UNLOADING')).toBe('DELIVERED');
    expect(statusFromDb('UNLOADED')).toBe('DELIVERED');
    expect(statusToDb('DELAYED')).toBeNull();
    expect(statusToDb('SILENT')).toBeNull();
    expect(statusFromDb('AT_PORT_NYNASHAMN')).toBe('AT_PORT_SE');
  });
  it('AT_PORT_NYNASHAMN → AT_PORT_SE → kafelek PORT_SE (H1)', () => {
    expect(statusFromDb('AT_PORT_NYNASHAMN')).toBe('AT_PORT_SE');
    expect(stageTileOf({ status: 'AT_PORT_SE', stage: 'APPROACH' })).toBe('PORT_SE');
  });
  it('load row → Load (code from shipment item, carrier org, windows, no demo pricing)', () => {
    const row: LoadRow = {
      id: LOAD_ID, order_no: 'ZL-1', carrier_org_id: ORGS[2].id, status: 'FERRY',
      plan_load_date: '2026-10-01', plan_load_from: '2026-10-01T06:00:00Z', plan_load_to: '2026-10-01T14:00:00Z',
      plan_delivery_date: '2026-10-04', plan_delivery_from: null, plan_delivery_to: null,
      tractor_plate: 'PO 1', trailer_plate: null, driver_name: null, driver_phone: null, escort_vehicles: 1,
      ferry_booking_ref: 'B-1', sailing_id: 'sail-1',
      sailings: { departure_at: '2026-10-02T17:00:00Z', arrival_at: '2026-10-03T11:00:00Z', delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', vessels: { name: 'M/F Wawel' } },
      combo_length_m: '21.5', combo_width_m: null, combo_height_m: null, combo_weight_t: null, delay_minutes: 0, eta_site: null,
      shipment_items: [
        { shipment_code: 'SG-02', item_type: 'Belka', length_m: '18', width_m: '3', height_m: '3.2', total_weight_t: '20', unit_weight_t: null, qty: 1, assembly_seq: 2 },
        { shipment_code: 'SG-01', item_type: 'Kolumna', length_m: '16', width_m: '3', height_m: '3', total_weight_t: '18', unit_weight_t: null, qty: 1, assembly_seq: 1 },
      ],
    };
    const l = loadFromRow(row, ORGS, 0, '2026-10-02T18:00:00Z');
    expect(l.code).toBe('SG-01');
    expect(l.status).toBe('ON_FERRY');
    expect(l.carrierId).toBe('org-scx');
    expect(l.ferry).toMatchObject({ vessel: 'Wawel', bookingRef: 'B-1', status: 'BOOKED', departureAt: '2026-10-02T17:00:00Z', arrivalAt: '2026-10-03T11:00:00Z' });
    expect(l.resources.escort).toBe(true);
    expect(l.resources.setLengthM).toBe(21.5);
    expect(l.awizacja.confirmed).toBe(true);
    expect(l.pricing.costTotal).toBe(0);
    expect(l.dims.lengthM).toBe(16);
  });
  it('patch mappers only touch carrier-granted columns', () => {
    expect(resourcesPatchToDb({ driverName: 'A', escort: false, setWeightT: 40 })).toEqual({ driver_name: 'A', escort_vehicles: 0, combo_weight_t: 40 });
    expect(awizacjaPatchToDb({ confirmed: true, loadWindowStart: 'x' })).toEqual({ plan_load_from: 'x' });
    const granted = readFileSync('supabase/migrations/0001_core.sql', 'utf8');
    for (const col of ['driver_name', 'escort_vehicles', 'combo_weight_t', 'plan_load_from', 'status', 'ferry_booking_ref']) expect(granted).toContain(col);
  });
  it('ferry comes from sailings (AN1): delayed times win, status mapped, writes only booking ref / sailing_id', () => {
    const s = { departure_at: '2026-10-02T17:00:00Z', arrival_at: '2026-10-03T11:00:00Z', delayed_departure_at: '2026-10-02T19:00:00Z', delayed_arrival_at: null, status: 'OPOZNIONY', vessels: { name: 'M/F Nova Star' } };
    expect(ferryFromRow({ ferry_booking_ref: null, sailings: s })).toMatchObject({ vessel: 'Nova Star', departureAt: '2026-10-02T19:00:00Z', arrivalAt: '2026-10-03T11:00:00Z', status: 'DELAYED' });
    expect(ferryFromRow({ ferry_booking_ref: 'X', sailings: { ...s, status: 'ODWOLANY' } }).status).toBe('CANCELLED');
    expect(ferryFromRow({ ferry_booking_ref: null, sailings: null })).toMatchObject({ vessel: null, status: 'NONE' });
    expect(ferryPatchToDb({ vessel: 'Wawel', departureAt: 'x', bookingRef: 'B' })).toEqual({ ferry_booking_ref: 'B' });
    expect(ferryPatchToDb({ vessel: 'Wawel' }, 'sail-9')).toEqual({ sailing_id: 'sail-9' });
    expect(vesselToDb('Nova Star')).toBe('M/F Nova Star');
  });
  it('events keep actor/note in payload', () => {
    const row = eventToRow({ loadId: LOAD_ID, type: 'NOTE', at: '2026-01-01T00:00:00Z', actor: 'SCX', note: 'n', payload: { a: 1 } });
    expect(row.payload).toEqual({ a: 1, actor: 'SCX', note: 'n' });
    const ev = eventFromRow({ id: 5, load_id: LOAD_ID, event_type: 'NOTE', occurred_at: 'x', payload: row.payload as Record<string, unknown> });
    expect(ev).toMatchObject({ id: 'ev-5', actor: 'SCX', note: 'n', payload: { a: 1 } });
  });
  it('geofence ↔ RPC args (notify orgs, trigger, dwell)', () => {
    const g = geofenceFromRow({ id: LOAD_ID, name: 'Port', kind: 'PORT_OUT', hysteresis_m: 200, dwell_seconds: 900, debounce_fixes: 2, notify_enter: false, notify_exit: false, notify_dwell: true, notify_orgs: [ORGS[0].id, ORGS[2].id], active: true, lat: 54.38, lng: 18.71, radius_m: 800 }, ORGS);
    expect(g).toMatchObject({ notifyHhl: true, notifyKsh: false, notifyScx: true, trigger: 'DWELL_EXCEEDED', dwellMin: 15 });
    const args = geofenceToRpc(g, 'p', ORGS, LOAD_ID);
    expect(args.p_notify_orgs).toEqual([ORGS[0].id, ORGS[2].id]);
    expect(args).toMatchObject({ p_dwell_seconds: 900, p_notify_dwell: true, p_radius_m: 800 });
  });
});

describe('BK3 demo bundle guard', () => {
  it('lazy Supabase chunks are gated by the literal VITE_AUTH_MODE check (dead-code eliminated in demo build)', () => {
    for (const f of ['src/App.tsx', 'src/views/OptionsView.tsx']) {
      const src = readFileSync(f, 'utf8');
      /* audyt 17.10: każdy lazy ma lazyRetry; strażnik dotyczy kawałków Supabase (`auth/`) */
      const lazyLines = src.split('\n').filter((l) => /lazy\((lazyRetry\()?\(\) => import\('\.\.?\/(\.\.\/)?auth\//.test(l));
      expect(lazyLines.length).toBeGreaterThan(0);
      for (const l of lazyLines) expect(l).toContain("import.meta.env.VITE_AUTH_MODE === 'supabase' &&");
    }
  });
});
