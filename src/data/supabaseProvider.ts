/**
 * BK3 — SupabaseProvider (produkcja). Klient Supabase wstrzykiwany (przeglądarka:
 * sesja użytkownika z klucza anon; test live: ta sama sesja z magic linku) —
 * widoczność wyłącznie przez RLS, nigdy service role w przeglądarce.
 * Ładowany leniwie z bramki logowania → paczka demo go nie zawiera.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataMutation, DataProvider, DataSnapshot } from './provider';
import { emptySnapshot } from './provider';
import type { FerryBooking } from '../types';
import { isServerId } from './registry';
import {
  awizacjaPatchToDb, documentFromRow, eventFromRow, eventToRow, ferryPatchToDb, geofenceFromRow, geofenceToRpc,
  PRICE_VIEW_COLUMNS, applyPriceViews, type PriceViewRow,
  loadFromRow, messageFromRow, resourcesPatchToDb, riskFromRow, statusToDb, vesselToDb,
  type DocumentRow, type EventRow, type GeofenceRow, type LoadRow, type MessageRow, type OrgRow, type RiskRow,
} from './mappers';

export const PROJECT_CODE = 'STEGRA_BODEN';
const LOAD_COLUMNS =
  'id,order_no,carrier_org_id,status,plan_load_date,plan_load_from,plan_load_to,plan_delivery_date,plan_delivery_from,' +
  'plan_delivery_to,tractor_plate,trailer_plate,driver_name,driver_phone,escort_vehicles,ferry_booking_ref,sailing_id,' +
  'combo_length_m,combo_width_m,combo_height_m,combo_weight_t,delay_minutes,eta_site,hhl_order_no,carrier_order_no,actual_delivery_at,' +
  'shipment_items(shipment_code,item_type,length_m,width_m,height_m,total_weight_t,unit_weight_t,qty,assembly_seq),' +
  'sailings(departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status,vessels(name))';

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? ([] as unknown as T));
}

export interface SupabaseProviderOptions {
  now?: () => string;
  eventLimit?: number;
}

export function createSupabaseProvider(sb: SupabaseClient, opts: SupabaseProviderOptions = {}): DataProvider & {
  context(): { orgs: OrgRow[]; projectId: string | null };
} {
  const now = opts.now ?? (() => new Date().toISOString());
  let orgs: OrgRow[] = [];
  let projectId: string | null = null;

  async function ensureContext() {
    if (orgs.length && projectId) return;
    const [o, p] = await Promise.all([
      sb.from('organizations').select('id,code,kind'),
      sb.from('projects').select('id,code').eq('code', PROJECT_CODE).maybeSingle(),
    ]);
    orgs = must(o, 'organizations') as OrgRow[];
    projectId = (must(p, 'projects') as { id: string } | null)?.id ?? null;
  }

  async function loadSnapshot(): Promise<DataSnapshot> {
    await ensureContext();
    const at = now();
    const [loads, events, messages, geos, risks, docs, costV, revV] = await Promise.all([
      sb.from('loads').select(LOAD_COLUMNS).order('plan_load_date', { ascending: true, nullsFirst: false }),
      sb.from('load_events').select('id,load_id,event_type,occurred_at,payload').order('occurred_at', { ascending: false }).limit(opts.eventLimit ?? 500),
      sb.from('load_messages').select('id,load_id,body,created_at,author_org').order('created_at', { ascending: true }),
      sb.from('v_geofences_circle').select('*').order('sort_order'),
      sb.from('risk_signals').select('id,load_id,kind,severity,title,detail,detected_at').is('resolved_at', null).order('detected_at', { ascending: false }),
      sb.from('documents').select('id,load_id,category,file_name,mime_type,size_bytes,valid_until,visible_to,uploaded_at,storage_path'),
      // M2: ceny wyłącznie z widoków rolowych v2 (0010) — koszt: HHL + przewoźnik, przychód: HHL + klient
      sb.from('v_load_price_carrier').select(PRICE_VIEW_COLUMNS),
      sb.from('v_load_price_client').select(PRICE_VIEW_COLUMNS),
    ]);
    const costBy = new Map((must(costV, 'v_load_price_carrier') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    const revBy = new Map((must(revV, 'v_load_price_client') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    return {
      ...emptySnapshot(), // faktury / automatyzacje / powiadomienia: Etap 4 — puste, nie demo
      loads: (must(loads, 'loads') as unknown as LoadRow[]).map((r, i) => applyPriceViews(loadFromRow(r, orgs, i, at), costBy.get(r.id), revBy.get(r.id))),
      events: (must(events, 'load_events') as EventRow[]).map(eventFromRow),
      messages: (must(messages, 'load_messages') as MessageRow[]).map(messageFromRow),
      geofences: (must(geos, 'v_geofences_circle') as GeofenceRow[]).map((g) => geofenceFromRow(g, orgs)),
      risks: (must(risks, 'risk_signals') as RiskRow[]).map((r) => riskFromRow(r, at)),
      documents: (must(docs, 'documents') as DocumentRow[]).map(documentFromRow).filter((d) => d !== null),
    };
  }

  async function updateLoad(loadId: string, patch: Record<string, unknown>, what: string) {
    if (!Object.keys(patch).length) return;
    const res = await sb.from('loads').update(patch).eq('id', loadId).select('id');
    const rows = must(res, what) as { id: string }[];
    if (!rows.length) throw new Error(`${what}: brak uprawnień lub transport niewidoczny`);
  }

  /** Rejs po (statek, rozkładowa godzina odejścia) — `undefined` = nie ruszaj `sailing_id`. */
  async function resolveSailing(p: Partial<FerryBooking>): Promise<string | null | undefined> {
    if (!('vessel' in p) && !('departureAt' in p)) return undefined;
    const name = vesselToDb(p.vessel ?? null);
    if (!name || !p.departureAt) return p.vessel === null ? null : undefined;
    const res = await sb.from('sailings').select('id,vessels!inner(name)')
      .eq('vessels.name', name).eq('departure_at', p.departureAt).limit(1);
    const rows = must(res, 'rejs') as { id: string }[];
    return rows[0]?.id; // brak rejsu w `sailings` → nie zmieniaj przypisania (M10)
  }

  async function apply(m: DataMutation): Promise<{ id?: string } | void> {
    switch (m.type) {
      case 'load.status': {
        const db = statusToDb(m.status);
        if (db) await updateLoad(m.loadId, { status: db }, 'status');
        return;
      }
      case 'load.resources': return updateLoad(m.loadId, resourcesPatchToDb(m.patch), 'zasoby');
      case 'load.awizacja': return updateLoad(m.loadId, awizacjaPatchToDb(m.patch), 'awizacja');
      case 'load.ferry': return updateLoad(m.loadId, ferryPatchToDb(m.patch, await resolveSailing(m.patch)), 'prom');
      case 'event.append': {
        const res = await sb.from('load_events').insert(eventToRow(m.event)).select('id').single();
        return { id: String((must(res, 'zdarzenie') as { id: number }).id) };
      }
      case 'message.send': {
        const res = await sb.from('load_messages').insert({ load_id: m.loadId, body: m.text }).select('id').single();
        return { id: String((must(res, 'wiadomość') as { id: number }).id) };
      }
      case 'geofence.save': {
        await ensureContext();
        if (!projectId) throw new Error('strefa: brak projektu');
        const serverId = isServerId(m.geofence.id) ? m.geofence.id : null;
        const res = await sb.rpc('upsert_geofence_circle', geofenceToRpc(m.geofence, projectId, orgs, serverId));
        return { id: String(must(res, 'strefa')) };
      }
    }
  }

  return { kind: 'supabase', loadSnapshot, apply, context: () => ({ orgs, projectId }) };
}
