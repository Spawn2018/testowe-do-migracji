/**
 * BK3 — SupabaseProvider (produkcja). Klient Supabase wstrzykiwany (przeglądarka:
 * sesja użytkownika z klucza anon; test live: ta sama sesja z magic linku) —
 * widoczność wyłącznie przez RLS, nigdy service role w przeglądarce.
 * Ładowany leniwie z bramki logowania → paczka demo go nie zawiera.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataMutation, DataProvider, DataSnapshot, UserPrefsPatch } from './provider';
import { emptySnapshot } from './provider';
import type { FerryBooking, Notification } from '../types';
import { isServerId } from './registry';
import { safeStorageTarget } from './storagePath';
import { workflowFromRow, workflowRunFromRow, workflowToDb, type WorkflowDbRow, type WorkflowRunDbRow } from './workflowMap';
import {
  awizacjaPatchToDb, documentFromRow, eventFromRow, eventToRow, ferryPatchToDb, geofenceFromRow, geofenceToRpc,
  PRICE_VIEW_COLUMNS, PRICE_VIEW_COLUMNS_LEGACY, PRICE_VIEW_COLUMNS_NO_BASIS, applyPriceViews, type PriceViewRow,
  BILL_COLUMNS, billFromRow, billToRpc, type BillRow, notificationFromRow, type NotificationRow,
  loadFromRow, messageFromRow, resourcesPatchToDb, riskFromRow, statusToDb, vesselToDb,
  type DocumentRow, type EventRow, type GeofenceRow, type LoadRow, type MessageRow, type OrgRow, type RiskRow,
  SAILING_COLUMNS, sailingFromRow, sailingToRow, type SailingDbRow,
} from './mappers';
import { setOpsThresholdCache } from '../lib/opsThresholdDefaults';
import { deliveredCheckFromDecision } from '../lib/p4cSource';
import { setPermitsFromServer, setPoliciesFromServer, type PermitView, type PolicyView } from '../lib/p5Source';
import { setPilotsFromServer, setSymbolSpecsFromServer, type SymbolSpecRow } from '../lib/p7Source';
import { transportLabel } from '../lib/transportName';
import type { Load, LoadEvent, OrgKind } from '../types';

export const PROJECT_CODE = 'STEGRA_BODEN';
const LOAD_COLUMNS =
  'id,carrier_org_id,status,plan_load_date,plan_load_from,plan_load_to,plan_delivery_date,plan_delivery_from,' +
  'plan_delivery_to,tractor_plate,trailer_plate,escort_vehicles,ferry_booking_ref,sailing_id,telematics_vehicle_id,symbol,permit_kind,' +
  'rio_tracking_id,rio_asset_name,rio_tracker_on,rio_valid_from,rio_valid_to,rio_check_state,rio_check_at,rio_last_fix_at,' +
  'plan_dates_status,plan_dates_confirmed_at,' +
  'combo_length_m,combo_width_m,combo_height_m,combo_weight_t,delay_minutes,eta_site,eta_confidence_min,eta_basis,eta_computed_at,actual_delivery_at,' +
  'shipment_items(shipment_code,item_type,cargo_class,length_m,width_m,height_m,total_weight_t,unit_weight_t,qty,assembly_seq),' +
  'sailings(departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status,vessels(name))';

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? ([] as unknown as T));
}

/**
 * 22.10.2026 (właściciel 21:38): statusy SG-03 i innych zafakturowanych zniknęły z osi Status — zrzut brał tylko
 * 500 najnowszych zdarzeń całego projektu, a od 20.10 starsze (październikowe statusy z GPS) wypadały.
 * Teraz wszystkie zdarzenia, stronami po 1000 (limit odpowiedzi API, `max_rows`); `cap` tylko dla testów.
 * Nowe zdarzenie między stronami przesuwa wiersze — powtórzony wiersz odrzucany po `id`.
 */
export async function fetchAllLoadEvents(
  sb: SupabaseClient,
  cap: number = Infinity,
): Promise<{ data: EventRow[] | null; error: { message: string } | null }> {
  const PAGE = 1000;
  const seen = new Set<string>();
  const out: EventRow[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const to = Math.min(from + PAGE, cap) - 1;
    const r = await sb.from('load_events').select('id,load_id,event_type,occurred_at,payload')
      .order('occurred_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
    if (r.error) return { data: null, error: r.error };
    const rows = (r.data ?? []) as EventRow[];
    for (const row of rows) {
      const k = String((row as { id: unknown }).id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row);
    }
    if (rows.length < to - from + 1) break;
  }
  return { data: out, error: null };
}

export interface SupabaseProviderOptions {
  now?: () => string;
  eventLimit?: number;
}

export function createSupabaseProvider(sb: SupabaseClient, opts: SupabaseProviderOptions = {}): DataProvider & {
  context(): { orgs: OrgRow[]; projectId: string | null };
  loadNotifications(): Promise<Notification[]>;
  loadsVersion(): Promise<string | null>;
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

  /* M7 — centrum powiadomień: własne wiersze IN_APP (RLS notifications_read_own), najnowsze 200 */
  const notificationsQuery = () => sb.from('notifications').select('id,template,payload,load_id,created_at,read_at')
    .eq('channel', 'IN_APP').order('created_at', { ascending: false }).limit(200);

  /** Właściciel 21.10.2026 20:14 (pkt 5): sam dzwonek, bez całego zrzutu — odświeżanie po powrocie do aplikacji na telefonie. */
  async function loadNotifications(): Promise<Notification[]> {
    return (must(await notificationsQuery(), 'notifications') as NotificationRow[]).map((r) => notificationFromRow(r));
  }

  /**
   * Właściciel 23.10.2026 13:43: statusy z automatu (GPS, AIS) zmieniają się na serwerze, a ekran pokazywał stary stan
   * do przeładowania. Jedno lekkie zapytanie: najnowsza zmiana wiersza transportu widocznego dla konta (RLS).
   */
  async function loadsVersion(): Promise<string | null> {
    const r = await sb.from('loads').select('updated_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
    if (r.error) return null;
    const row = (r.data ?? [])[0] as { updated_at?: string | null } | undefined;
    return row?.updated_at ?? null;
  }

  /* 22.10.2026 (właściciel 21:38): wszystkie zdarzenia zamiast 500 najnowszych — patrz fetchAllLoadEvents. */
  const fetchAllEvents = () => fetchAllLoadEvents(sb, opts.eventLimit);

  async function loadSnapshot(): Promise<DataSnapshot> {
    await ensureContext();
    const at = now();
    // 0187: fuel_status (wstępny/ostateczny); przed nałożeniem migracji widok nie ma kolumny → zapas bez niej
    // #409 / 0268: fuel_basis; przed migracją widok nie ma kolumny → zapas bez niej
    const selectPriceView = async (view: string) => {
      const r = await sb.from(view).select(PRICE_VIEW_COLUMNS);
      if (r.error && /fuel_basis/.test(r.error.message ?? '')) {
        const r2 = await sb.from(view).select(PRICE_VIEW_COLUMNS_NO_BASIS);
        if (r2.error && /fuel_status/.test(r2.error.message ?? '')) return sb.from(view).select(PRICE_VIEW_COLUMNS_LEGACY);
        return r2;
      }
      if (r.error && /fuel_status/.test(r.error.message ?? '')) return sb.from(view).select(PRICE_VIEW_COLUMNS_LEGACY);
      return r;
    };
    /* B10: HHL wczytuje anulowane (filtr w Harmonogramie); KSH/SCX — bez CANCELLED */
    const profileQ = await sb.rpc('my_profile');
    const profileRow = Array.isArray(profileQ.data) ? profileQ.data[0] : profileQ.data;
    const profileRole = String((profileRow as { role?: string } | null)?.role ?? '');
    const isHhl = profileRole === 'HHL_ADMIN' || profileRole === 'HHL_OPS';
    const orgKind: OrgKind = isHhl ? 'HHL' : profileRole.startsWith('CLIENT') || profileRole.startsWith('SITE') ? 'KSH' : 'SCX';
    let loadsQuery = sb.from('loads').select(LOAD_COLUMNS).order('plan_load_date', { ascending: true, nullsFirst: false });
    if (!isHhl) loadsQuery = loadsQuery.neq('status', 'CANCELLED');
    const [loads, events, messagesPlain, messagesUi, geos, risks, docs, costV, revV, billsQ, notesQ, sailQ, schedQ, driversQ, permitQ, wfQ, wfRunQ, orderNos, thrQ, gapsQ, a7PermitsQ, a7PoliciesQ, symQ, escQ, escContactQ] = await Promise.all([
      loadsQuery,
      fetchAllEvents(),
      sb.from('load_messages').select('id,load_id,body,created_at,author_org,visible_to').order('created_at', { ascending: true }),
      sb.rpc('list_load_messages_ui'),
      sb.from('v_geofences_circle').select('*').order('sort_order'),
      sb.from('risk_signals').select('id,load_id,kind,severity,title,title_key,detail,detected_at,dedup_key').is('resolved_at', null).order('detected_at', { ascending: false }),
      sb.from('documents').select('id,load_id,category,file_name,mime_type,size_bytes,valid_until,visible_to,uploaded_at,storage_path,version,superseded_at'),
      // M2: ceny wyłącznie z widoków rolowych v2 (0010) — koszt: HHL + przewoźnik, przychód: HHL + klient
      selectPriceView('v_load_price_carrier'),
      selectPriceView('v_load_price_client'),
      // M6: faktury v2 (RLS invoices_read: strony faktury; HHL wszystko)
      sb.from('invoices').select(BILL_COLUMNS).not('direction', 'is', null).order('issue_date', { ascending: false }),
      // M7: centrum powiadomień — własne wiersze IN_APP (RLS notifications_read_own), treść w języku odbiorcy
      notificationsQuery(),
      // M10: rozkład rejsów — widzą wszyscy (sailings_read), zmienia HHL
      sb.from('sailings').select(SAILING_COLUMNS).order('departure_at', { ascending: true }),
      // I-1: wersje importu harmonogramu (RLS schedule_imports_hhl — tylko HHL; pozostali: 0 wierszy)
      sb.from('schedule_imports').select('id,version,file_name,stats,imported_at').order('version', { ascending: false }).limit(20),
      // 0076 (PLAN §1.5): dane kierowcy nie są kolumnami loads dla API — tylko HHL i przewoźnik transportu (RPC); inni: 0 wierszy
      sb.rpc('load_driver_contacts'),
      // 0081 (SCOPE 6.5): zgodność powiązanych zezwoleń z wymiarami zestawu — tylko transporty z zezwoleniem
      sb.rpc('load_permit_status'),
      // 9.4 (0094) / #413 E35 Z1: bez soft-delete (removed_at); RLS: HHL_ADMIN + HHL_OPS odczyt
      sb.from('workflows').select('id,code,name,description,trigger_type,condition,actions,enabled').is('removed_at', null).order('code', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      sb.from('workflow_runs').select('id,workflow_id,load_id,status,result,ran_at').order('id', { ascending: false }).limit(1000),
      /* E41: KSH dostaje null. Brak funkcji (okno przed migracją) nie gasi całego zrzutu. */
      sb.rpc('load_order_numbers'),
      /* B7: progi ETA / ciszy — cache dla mappera (RLS: HHL wszystko, inni podzbiór) */
      sb.from('ops_thresholds').select('key,value_num'),
      /* A9: braki do Gotowy z bazy; brak RPC (przed migracją) → widok liczy sam */
      sb.rpc('load_ready_gaps'),
      /* A7: zezwolenia i polisy z bazy (KSH tylko HHL; SCX tylko własna) */
      sb.rpc('a7_permits_list'),
      sb.rpc('a7_policies_list'),
      /* D-20261020-1118-01: tabela symboli (zezwolenie Firma/Trasa, piloci) i piloci z awizacji (load_escorts PL/SE) */
      sb.from('symbol_specs').select('symbol,position_name,combo_length_m,combo_width_m,combo_height_m,pilot,permit_kind'),
      sb.from('load_escorts').select('load_id,seq,plate,scope').order('load_id').order('seq'), /* stała kolejność wpisów PL_SE między sobą; pierwszeństwo PL/SE ustala setPilotsFromServer (F7 #357 P6, #360) */
      sb.rpc('load_escort_contacts'),
    ]);
    /* brak tabeli lub odmowa (okno przed migracją) nie gasi zrzutu — widok wraca do stanu bez tabeli */
    setSymbolSpecsFromServer(symQ.error ? null : ((symQ.data ?? []) as SymbolSpecRow[]));
    {
      const names = new Map(((escContactQ.error ? [] : escContactQ.data ?? []) as { load_id: string; seq: number; driver_name: string | null }[])
        .map((c) => [`${c.load_id}|${c.seq}`, c.driver_name]));
      setPilotsFromServer(escQ.error ? null : ((escQ.data ?? []) as { load_id: string; seq: number; plate: string; scope: string }[])
        .map((e) => ({ loadId: e.load_id, scope: e.scope, plate: e.plate, name: names.get(`${e.load_id}|${e.seq}`) ?? null })));
    }
    if (!thrQ.error && thrQ.data) {
      setOpsThresholdCache(thrQ.data as { key: string; value_num: number }[]);
    }
    const wfRuns = (wfRunQ.error ? [] : wfRunQ.data ?? []) as WorkflowRunDbRow[];
    const okBy = new Map<string, number>();
    for (const r of wfRuns) if (r.status === 'OK') okBy.set(r.workflow_id, (okBy.get(r.workflow_id) ?? 0) + 1);
    if (orderNos.error && !/load_order_numbers|PGRST202|schema cache|Could not find/i.test(orderNos.error.message ?? '')) {
      throw new Error(`load_order_numbers: ${orderNos.error.message}`);
    }
    if (gapsQ.error && !/load_ready_gaps|PGRST202|schema cache|Could not find/i.test(gapsQ.error.message ?? '')) {
      throw new Error(`load_ready_gaps: ${gapsQ.error.message}`);
    }
    if (a7PermitsQ.error && !/a7_permits_list|PGRST202|schema cache|Could not find/i.test(a7PermitsQ.error.message ?? '')) {
      throw new Error(`a7_permits_list: ${a7PermitsQ.error.message}`);
    }
    if (a7PoliciesQ.error && !/a7_policies_list|PGRST202|schema cache|Could not find/i.test(a7PoliciesQ.error.message ?? '')) {
      throw new Error(`a7_policies_list: ${a7PoliciesQ.error.message}`);
    }
    if (!a7PermitsQ.error) {
      const raw = a7PermitsQ.data;
      const rows = (Array.isArray(raw) ? raw : raw ?? []) as PermitView[];
      setPermitsFromServer(Array.isArray(rows) ? rows : []);
    } else {
      setPermitsFromServer([]);
    }
    if (!a7PoliciesQ.error) {
      const raw = a7PoliciesQ.data;
      const rows = (Array.isArray(raw) ? raw : raw ?? []) as PolicyView[];
      setPoliciesFromServer(Array.isArray(rows) ? rows : []);
    } else {
      setPoliciesFromServer([]);
    }
    const orderBy = new Map(((orderNos.error ? [] : orderNos.data ?? []) as { load_id: string; hhl_order_no: string | null; carrier_order_no: string | null }[])
      .map((r) => [r.load_id, r]));
    const gapsBy = new Map(((gapsQ.error ? [] : gapsQ.data ?? []) as { load_id: string; gaps: import('../types').ReadyGap[] | null }[])
      .map((r) => [r.load_id, Array.isArray(r.gaps) ? r.gaps : []]));
    const permitOk = new Map(((permitQ.error ? [] : permitQ.data ?? []) as { load_id: string; permits_linked: number; ok: boolean }[])
      .filter((p) => p.permits_linked > 0).map((p) => [p.load_id, p.ok]));
    /* Kokpit „Zezwolenia 7 dni”: komplet = podpięte, pasują do zestawu i nie brakuje kraju (FIRMA — jedno zezwolenie) */
    const permitDone = new Map(((permitQ.error ? [] : permitQ.data ?? []) as { load_id: string; permits_linked: number; ok: boolean; missing_countries: string[] | null }[])
      .map((p) => [p.load_id, p.permits_linked > 0 && p.ok === true && (p.missing_countries ?? []).length === 0]));
    const drivers = new Map(((driversQ.error ? [] : driversQ.data ?? []) as {
      load_id: string; driver_name: string | null; driver_phone: string | null; driver_phone_country?: string | null;
      driver_delivery_name?: string | null; driver_delivery_phone?: string | null; driver_delivery_phone_country?: string | null;
      tractor_delivery_plate?: string | null; trailer_swap?: boolean | null;
    }[])
      .map((d) => [d.load_id, d]));
    const docRows = must(docs, 'documents') as DocumentRow[];
    const costBy = new Map((must(costV, 'v_load_price_carrier') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    const revBy = new Map((must(revV, 'v_load_price_client') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    /* D-20261018-1100-01: karta L14 = otwarta sprawa DELIVERED_CHECK, nie zdarzenie GEOFENCE_EXIT */
    const dcQ = await sb.from('decisions')
      .select('id,load_id,status,detail')
      .eq('type_code', 'DELIVERED_CHECK')
      .in('status', ['NEW', 'ASSIGNED', 'SNOOZED']);
    if (dcQ.error) throw new Error(`decisions L14: ${dcQ.error.message}`);
    const dcBy = new Map<string, { id: string; status: string; detail: Record<string, unknown> | null }>();
    for (const row of (dcQ.data ?? []) as { id: string; load_id: string; status: string; detail: Record<string, unknown> | null }[]) {
      if (!dcBy.has(row.load_id)) dcBy.set(row.load_id, row);
    }
    const mappedEvents = (must(events, 'load_events') as EventRow[]).map(eventFromRow) as LoadEvent[];
    const geosRows = (must(geos, 'v_geofences_circle') as GeofenceRow[]).map((g) => geofenceFromRow(g, orgs));
    const loadRows = must(loads, 'loads') as unknown as LoadRow[];
    const rioByLoad = new Map(loadRows.map((r) => [r.id, r.rio_tracking_id ?? null]));
    let mappedLoads: Load[] = loadRows
      .map((r) => ({
        ...r,
        order_no: null,
        hhl_order_no: orderBy.get(r.id)?.hhl_order_no ?? null,
        carrier_order_no: orderBy.get(r.id)?.carrier_order_no ?? null,
        driver_name: drivers.get(r.id)?.driver_name ?? null,
        driver_phone: drivers.get(r.id)?.driver_phone ?? null,
        driver_phone_country: drivers.get(r.id)?.driver_phone_country ?? 'PL',
        driver_delivery_name: drivers.get(r.id)?.driver_delivery_name ?? null,
        driver_delivery_phone: drivers.get(r.id)?.driver_delivery_phone ?? null,
        driver_delivery_phone_country: drivers.get(r.id)?.driver_delivery_phone_country ?? 'PL',
        tractor_delivery_plate: drivers.get(r.id)?.tractor_delivery_plate ?? null,
        trailer_swap: drivers.get(r.id)?.trailer_swap ?? false,
      }))
      .map((r, i) => applyPriceViews(loadFromRow(r, orgs, i, at), costBy.get(r.id), revBy.get(r.id)))
      .map((l) => (permitOk.has(l.id) ? { ...l, permitFits: permitOk.get(l.id) ?? null } : l))
      .map((l) => (permitDone.has(l.id) ? { ...l, permitComplete: permitDone.get(l.id) ?? null } : l));
    /* B5 K2.1: usedBy — inne transporty z tym samym rio_tracking_id */
    const rioGroups = new Map<string, Load[]>();
    for (const l of mappedLoads) {
      const rioId = rioByLoad.get(l.id);
      if (!rioId || l.trackingLink?.provider !== 'RIO') continue;
      const g = rioGroups.get(rioId) ?? [];
      g.push(l);
      rioGroups.set(rioId, g);
    }
    const dcRole = orgKind === 'HHL' ? 'HHL' as const : orgKind === 'KSH' ? 'KSH' as const : 'SCX' as const;
    mappedLoads = mappedLoads.map((l) => {
      const rioId = rioByLoad.get(l.id);
      const peers = rioId ? (rioGroups.get(rioId) ?? []).filter((p) => p.id !== l.id) : [];
      const usedBy = peers.map((p) => transportLabel(p, orgKind, 'plain'));
      let next = l;
      if (l.trackingLink?.provider === 'RIO' && usedBy.length) {
        next = { ...next, trackingLink: { ...l.trackingLink, usedBy } };
      }
      next = { ...next, deliveredCheck: deliveredCheckFromDecision(l, dcBy.get(l.id) ?? null, dcRole) };
      /* A9: baza podała listę → widok nie liczy sam (undefined = brak RPC). */
      if (!gapsQ.error) next = { ...next, readyGaps: gapsBy.get(l.id) ?? [] };
      return next;
    });
    return {
      ...emptySnapshot(),
      workflows: ((wfQ.error ? [] : wfQ.data ?? []) as WorkflowDbRow[]).map((r) => workflowFromRow(r, okBy.get(r.id) ?? 0)),
      workflowRuns: wfRuns.map(workflowRunFromRow),
      loads: mappedLoads,
      events: mappedEvents,
      messages: (() => {
        const rows = (messagesUi.error ? must(messagesPlain, 'load_messages') : (messagesUi.data ?? [])) as MessageRow[];
        const mapped = rows.map(messageFromRow);
        // B-10g: oznacz odczyt (niekrytyczne; bez await w snapshot)
        void Promise.resolve().then(async () => {
          try {
            for (const m of rows.slice(-40)) {
              const id = Number(m.id);
              if (Number.isFinite(id) && id > 0) await sb.rpc('mark_load_message_read', { p_message: id });
            }
          } catch { /* ignore */ }
        });
        return mapped;
      })(),
      geofences: geosRows,
      risks: (must(risks, 'risk_signals') as RiskRow[]).map((r) => riskFromRow(r, at)),
      documents: docRows.map(documentFromRow).filter((d) => d !== null),
      notifications: (must(notesQ, 'notifications') as NotificationRow[]).map((r) => notificationFromRow(r)),
      bills: (must(billsQ, 'invoices') as unknown as BillRow[]).map((r) => billFromRow(r, orgs, docRows)).filter((b) => b !== null),
      sailings: (must(sailQ, 'sailings') as unknown as SailingDbRow[]).map(sailingFromRow),
      scheduleVersions: ((schedQ.error ? [] : schedQ.data ?? []) as { id: string; version: number; file_name: string | null; stats: Record<string, number> | null; imported_at: string }[])
        .map((r) => ({
          id: r.id, at: r.imported_at, by: `v${r.version}`, filename: r.file_name ?? '',
          added: Number(r.stats?.added ?? 0), changed: Number(r.stats?.changed ?? 0),
          removed: Number(r.stats?.cancelled ?? 0), rejected: Number(r.stats?.rejected ?? 0),
          skippedStandard: Number(r.stats?.skipped_standard ?? 0),
        })),
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

  // M4 — user_preferences (RLS: wyłącznie własny wiersz)
  let appUserId: string | null = null;
  async function myUserId(): Promise<string> {
    if (appUserId) return appUserId;
    const r = await sb.rpc('current_app_user_id');
    if (r.error || !r.data) throw new Error(`current_app_user_id: ${r.error?.message ?? 'brak'}`);
    appUserId = r.data as string;
    return appUserId;
  }
  /* B9 (8A, D-20261019-1515-01): panel tylko po polsku — kolumny języka w `user_preferences` nie czytamy ani nie zapisujemy
     (wykonawca usuwa ją w bazie; aplikacja kierowcy ma własny wybór języka). */
  async function loadPreferences(): Promise<UserPrefsPatch | null> {
    const r = await sb.from('user_preferences').select('display_currency,theme').maybeSingle();
    if (r.error) throw new Error(`user_preferences: ${r.error.message}`);
    if (!r.data) return null;
    const d = r.data as { display_currency: string; theme: string | null };
    return {
      displayCurrency: d.display_currency === 'PLN' ? 'PLN' : 'EUR',
      theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : null,
    };
  }
  async function savePreferences(p: UserPrefsPatch): Promise<void> {
    const row: Record<string, unknown> = { user_id: await myUserId(), updated_at: new Date().toISOString() };
    if (p.displayCurrency) row.display_currency = p.displayCurrency;
    if ('theme' in p) row.theme = p.theme ?? null;
    const r = await sb.from('user_preferences').upsert(row, { onConflict: 'user_id' }).select('user_id');
    if (r.error) throw new Error(`user_preferences: ${r.error.message}`);
  }

  async function apply(m: DataMutation): Promise<{ id?: string } | void> {
    switch (m.type) {
      case 'load.status': {
        const db = statusToDb(m.status);
        if (!db) return;
        // E25 — jedna funkcja w bazie (role, kierunek, czas, audit); UNLOADED→DELIVERED po stronie RPC
        const when = m.occurredAt ?? m.unloadedAt ?? new Date().toISOString();
        const r = await sb.rpc('load_status_set', {
          p_load: m.loadId,
          p_status: db,
          p_occurred_at: when,
          p_note: m.note ?? null,
        });
        if (r.error) throw new Error(`status: ${r.error.message}`);
        return;
      }
      case 'sailing.save': {
        await ensureContext();
        if (!projectId) throw new Error('rejs: brak projektu');
        const row = sailingToRow(m.sailing);
        if (m.isNew) {
          const vName = vesselToDb(m.sailing.vessel === 'Wawel' || m.sailing.vessel === 'Nova Star' ? m.sailing.vessel : null) ?? m.sailing.vessel;
          const v = await sb.from('vessels').select('id').eq('name', vName).maybeSingle();
          const vessel = must(v, 'statek') as { id: string } | null;
          if (!vessel) throw new Error(`rejs: nieznany statek ${m.sailing.vessel}`);
          const res = await sb.from('sailings').insert({ ...row, project_id: projectId, vessel_id: vessel.id }).select('id').single();
          return { id: (must(res, 'rejs') as { id: string }).id };
        }
        const res = await sb.from('sailings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', m.sailing.id).select('id');
        if (!(must(res, 'rejs') as { id: string }[]).length) throw new Error('rejs: rozkład zmienia wyłącznie HHL');
        return;
      }
      case 'load.sailing':
        return updateLoad(m.loadId, { sailing_id: m.sailingId, ferry_booking_ref: m.bookingRef }, 'rejs');
      case 'position.report': {
        const r = await sb.rpc('report_position', {
          p_load_id: m.loadId, p_lat: m.lat, p_lon: m.lng, p_ts: m.at,
          p_accuracy: m.accuracy, p_speed: m.speedKmh, p_heading: m.heading,
        });
        if (r.error) throw new Error(`pozycja: ${r.error.message}`);
        // liczba zdarzeń stref — >0 oznacza możliwą zmianę statusu (most odświeża dane)
        return { id: String(Array.isArray(r.data) ? r.data.length : 0) };
      }
      case 'load.resources': return updateLoad(m.loadId, resourcesPatchToDb(m.patch), 'zasoby');
      case 'load.awizacja': return updateLoad(m.loadId, awizacjaPatchToDb(m.patch), 'awizacja');
      case 'load.ferry': return updateLoad(m.loadId, ferryPatchToDb(m.patch, await resolveSailing(m.patch)), 'prom');
      case 'event.append': {
        const res = await sb.from('load_events').insert(eventToRow(m.event)).select('id').single();
        return { id: String((must(res, 'zdarzenie') as { id: number }).id) };
      }
      case 'message.send': {
        /* B4: „tylko HHL i SCX” → {FORWARDER,CARRIER}; bez wyboru — domyślnie wszyscy (baza normalizuje, KSH zawsze wszyscy) */
        const row: { load_id: string; body: string; visible_to?: string[] } = { load_id: m.loadId, body: m.text };
        if (m.visibleTo === 'HHL_SCX') row.visible_to = ['FORWARDER', 'CARRIER'];
        const res = await sb.from('load_messages').insert(row).select('id').single();
        return { id: String((must(res, 'wiadomość') as { id: number }).id) };
      }
      case 'load.orderNo':
        return updateLoad(m.loadId, m.side === 'HHL' ? { hhl_order_no: m.value } : { carrier_order_no: m.value }, 'numer zlecenia');
      case 'prefs.save':
        await savePreferences(m.prefs);
        return;
      case 'bill.register': {
        // PDF → Storage (dokument bez transportu, projekt faktury), potem RPC: kontrole i zapis w jednej transakcji
        await ensureContext();
        if (!projectId) throw new Error('faktura: brak projektu');
        if (!m.file) throw new Error('Plik PDF faktury jest wymagany');
        const created = await sb.rpc('create_document', {
          p_load_id: null, p_category: 'INVOICE', p_file_name: m.bill.pdfName ?? 'faktura.pdf',
          p_mime: 'application/pdf', p_size: m.file.size, p_project_id: projectId,
        });
        const row = (Array.isArray(created.data) ? created.data[0] : created.data) as { id: string; bucket: string; object_path: string } | null;
        if (created.error || !row) throw new Error(`faktura PDF: ${created.error?.message ?? 'brak rejestracji'}`);
        const stored = safeStorageTarget(row.bucket, row.object_path);
        const objectPath = stored.objectPath.replace(/\.\.\//g, '');
        const up = await sb.storage.from(stored.bucket).upload(objectPath, m.file, { contentType: 'application/pdf', upsert: false });
        if (up.error) {
          await sb.rpc('discard_document', { p_id: row.id });
          throw new Error(`faktura PDF: ${up.error.message}`);
        }
        const res = await sb.rpc('register_invoice', { p: billToRpc(m.bill, row.id) });
        if (res.error) {
          // odrzucona rejestracja: najpierw plik (discard_document wymaga braku obiektu), potem wiersz
          await sb.storage.from(stored.bucket).remove([objectPath]);
          await sb.rpc('discard_document', { p_id: row.id });
          throw new Error(res.error.message);
        }
        /* E4b (0287): wybór „Faktoring HHL” — po zapisie faktury; odmowa nie cofa faktury (wybór można zmienić w szczegółach do akceptacji) */
        if (m.bill.factoring?.selected && m.bill.direction === 'KOSZT') {
          const f = await sb.rpc('invoice_factoring_set', { p_invoice: String(res.data), p_selected: true });
          if (f.error) throw new Error(`Faktura zapisana, ale wybór faktoringu nie: ${f.error.message}`);
        }
        return { id: String(res.data) };
      }
      case 'bill.update': {
        // A4 / D-20261020-0115-01: edycja faktury — nowy PDF (opcjonalnie) → Storage, potem `update_invoice`
        // (uprawnienia, VAT, co do grosza, CMR, historia „było → jest” i powiadomienia — w bazie, jedna transakcja)
        await ensureContext();
        let docId = m.bill.pdfDocId ?? null;
        let uploaded: { id: string; bucket: string; objectPath: string } | null = null;
        if (m.file) {
          if (!projectId) throw new Error('faktura: brak projektu');
          const created = await sb.rpc('create_document', {
            p_load_id: null, p_category: 'INVOICE', p_file_name: m.bill.pdfName ?? 'faktura.pdf',
            p_mime: 'application/pdf', p_size: m.file.size, p_project_id: projectId,
          });
          const row = (Array.isArray(created.data) ? created.data[0] : created.data) as { id: string; bucket: string; object_path: string } | null;
          if (created.error || !row) throw new Error(`faktura PDF: ${created.error?.message ?? 'brak rejestracji'}`);
          const stored = safeStorageTarget(row.bucket, row.object_path);
          const objectPath = stored.objectPath.replace(/\.\.\//g, '');
          const up = await sb.storage.from(stored.bucket).upload(objectPath, m.file, { contentType: 'application/pdf', upsert: false });
          if (up.error) {
            await sb.rpc('discard_document', { p_id: row.id });
            throw new Error(`faktura PDF: ${up.error.message}`);
          }
          uploaded = { id: row.id, bucket: stored.bucket, objectPath };
          docId = row.id;
        }
        const { lines, ...patch } = billToRpc(m.bill, docId ?? '');
        delete patch.direction; // kierunku faktury nie zmienia się (wystawca i odbiorca bez zmian)
        /* F7 #347 P2: pełna treść nagłówka, bez „null = licz sam” — termin zawsze jawnie, z flagą „z dokumentu” */
        const res = await sb.rpc('update_invoice', {
          p_invoice: m.billId,
          p_patch: { ...patch, due_date: m.bill.dueDate, due_date_from_document: m.bill.dueFromDocument, document_id: docId },
          p_lines: lines,
          p_note: m.note,
        });
        if (res.error) {
          if (uploaded) {
            await sb.storage.from(uploaded.bucket).remove([uploaded.objectPath]);
            await sb.rpc('discard_document', { p_id: uploaded.id });
          }
          throw new Error(res.error.message);
        }
        return;
      }
      case 'bill.verify': {
        const res = await sb.from('invoices').update({
          verification_status: m.verification, dispute_note: m.note, decided_at: now(),
        }).eq('id', m.billId).select('id');
        const rows = must(res, 'weryfikacja faktury') as { id: string }[];
        if (!rows.length) throw new Error('weryfikacja faktury: brak uprawnień (weryfikuje odbiorca)');
        return;
      }
      case 'bill.paid': {
        const res = await sb.rpc('mark_invoice_paid', { p_invoice: m.billId, p_paid_at: m.paidAt });
        if (res.error) throw new Error(res.error.message);
        return;
      }
      case 'notifications.read': {
        if (!m.ids.length) return;
        const res = await sb.rpc('mark_notifications_read', { p_ids: m.ids });
        if (res.error) throw new Error(res.error.message);
        return;
      }
      case 'bill.unpaid': {
        const res = await sb.rpc('unmark_invoice_paid', { p_invoice: m.billId, p_reason: m.reason });
        if (res.error) throw new Error(res.error.message);
        return;
      }
      case 'loads.importCancel': {
        const res = await sb.rpc('import_cancel_loads', { p_load_ids: m.loadIds, p_reason: m.reason });
        if (res.error) throw new Error(`import: ${res.error.message}`);
        const rows = (res.data ?? []) as { verdict: string }[];
        return { id: String(rows.filter((r) => r.verdict === 'CANCELLED').length) };
      }
      case 'workflow.create': {
        await ensureContext();
        if (!projectId) throw new Error('reguła: brak projektu');
        const row = workflowToDb(m.rule);
        const res = await sb.rpc('workflow_rule_write', {
          p_id: null,
          p_project: projectId,
          p_name: row.name,
          p_description: row.description ?? '',
          p_trigger_type: row.trigger_type,
          p_condition: row.condition ?? true,
          p_actions: row.actions ?? [],
          p_enabled: row.enabled ?? true,
          p_reason: m.reason?.trim() || null,
        });
        if (res.error) throw new Error(res.error.message);
        return { id: String(res.data) };
      }
      case 'workflow.update': {
        const row = workflowToDb(m.patch);
        const res = await sb.rpc('workflow_rule_write', {
          p_id: m.id,
          p_project: null,
          p_name: row.name ?? null,
          p_description: row.description ?? null,
          p_trigger_type: row.trigger_type ?? null,
          p_condition: row.condition ?? null,
          p_actions: row.actions ?? null,
          p_enabled: row.enabled ?? null,
          p_reason: m.reason?.trim() || null,
        });
        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('reguła: zmienia wyłącznie administrator HHL');
        return;
      }
      case 'workflow.delete': {
        /* #505 F7 #506 pkt 9: zawsze soft-delete (hard DELETE kasował workflow_runs). */
        const res = await sb.rpc('workflow_rule_soft_delete', {
          p_id: m.id,
          p_reason: m.reason?.trim() || null,
        });
        if (res.error) throw new Error(res.error.message);
        return;
      }
      case 'geofence.save': {
        await ensureContext();
        if (!projectId) throw new Error('strefa: brak projektu');
        const serverId = isServerId(m.geofence.id) ? m.geofence.id : null;
        const res = await sb.rpc('upsert_geofence_circle', geofenceToRpc(m.geofence, projectId, orgs, serverId, m.reason));
        return { id: String(must(res, 'strefa')) };
      }
      case 'geofence.delete': {
        if (!isServerId(m.id)) return;
        const res = await sb.rpc('delete_geofence', { p_id: m.id });
        if (res.error) throw new Error(res.error.message);
        return;
      }
    }
  }

  return { kind: 'supabase', loadSnapshot, loadNotifications, loadsVersion, apply, loadPreferences, context: () => ({ orgs, projectId }) };
}
