/**
 * BK3 — SupabaseProvider (produkcja). Klient Supabase wstrzykiwany (przeglądarka:
 * sesja użytkownika z klucza anon; test live: ta sama sesja z magic linku) —
 * widoczność wyłącznie przez RLS, nigdy service role w przeglądarce.
 * Ładowany leniwie z bramki logowania → paczka demo go nie zawiera.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataMutation, DataProvider, DataSnapshot, UserPrefsPatch } from './provider';
import { emptySnapshot } from './provider';
import type { FerryBooking } from '../types';
import { isServerId } from './registry';
import { workflowFromRow, workflowRunFromRow, workflowToDb, type WorkflowDbRow, type WorkflowRunDbRow } from './workflowMap';
import {
  awizacjaPatchToDb, documentFromRow, eventFromRow, eventToRow, ferryPatchToDb, geofenceFromRow, geofenceToRpc,
  PRICE_VIEW_COLUMNS, applyPriceViews, type PriceViewRow,
  BILL_COLUMNS, billFromRow, billToRpc, type BillRow, notificationFromRow, type NotificationRow,
  loadFromRow, messageFromRow, resourcesPatchToDb, riskFromRow, statusToDb, vesselToDb,
  type DocumentRow, type EventRow, type GeofenceRow, type LoadRow, type MessageRow, type OrgRow, type RiskRow,
  SAILING_COLUMNS, sailingFromRow, sailingToRow, type SailingDbRow,
} from './mappers';

export const PROJECT_CODE = 'STEGRA_BODEN';
const LOAD_COLUMNS =
  'id,order_no,carrier_org_id,status,plan_load_date,plan_load_from,plan_load_to,plan_delivery_date,plan_delivery_from,' +
  'plan_delivery_to,tractor_plate,trailer_plate,escort_vehicles,ferry_booking_ref,sailing_id,' +
  'plan_dates_status,plan_dates_confirmed_at,' +
  'combo_length_m,combo_width_m,combo_height_m,combo_weight_t,delay_minutes,eta_site,eta_confidence_min,eta_basis,eta_computed_at,hhl_order_no,carrier_order_no,actual_delivery_at,' +
  'shipment_items(shipment_code,item_type,cargo_class,length_m,width_m,height_m,total_weight_t,unit_weight_t,qty,assembly_seq),' +
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
    const [loads, events, messages, geos, risks, docs, costV, revV, billsQ, notesQ, sailQ, schedQ, driversQ, permitQ, wfQ, wfRunQ] = await Promise.all([
      sb.from('loads').select(LOAD_COLUMNS).neq('status', 'CANCELLED').order('plan_load_date', { ascending: true, nullsFirst: false }),
      sb.from('load_events').select('id,load_id,event_type,occurred_at,payload').order('occurred_at', { ascending: false }).limit(opts.eventLimit ?? 500),
      sb.from('load_messages').select('id,load_id,body,created_at,author_org').order('created_at', { ascending: true }),
      sb.from('v_geofences_circle').select('*').order('sort_order'),
      sb.from('risk_signals').select('id,load_id,kind,severity,title,title_key,detail,detected_at,dedup_key').is('resolved_at', null).order('detected_at', { ascending: false }),
      sb.from('documents').select('id,load_id,category,file_name,mime_type,size_bytes,valid_until,visible_to,uploaded_at,storage_path,version,superseded_at'),
      // M2: ceny wyłącznie z widoków rolowych v2 (0010) — koszt: HHL + przewoźnik, przychód: HHL + klient
      sb.from('v_load_price_carrier').select(PRICE_VIEW_COLUMNS),
      sb.from('v_load_price_client').select(PRICE_VIEW_COLUMNS),
      // M6: faktury v2 (RLS invoices_read: strony faktury; HHL wszystko)
      sb.from('invoices').select(BILL_COLUMNS).not('direction', 'is', null).order('issue_date', { ascending: false }),
      // M7: centrum powiadomień — własne wiersze IN_APP (RLS notifications_read_own), treść w języku odbiorcy
      sb.from('notifications').select('id,template,payload,load_id,created_at,read_at').eq('channel', 'IN_APP').order('created_at', { ascending: false }).limit(200),
      // M10: rozkład rejsów — widzą wszyscy (sailings_read), zmienia HHL
      sb.from('sailings').select(SAILING_COLUMNS).order('departure_at', { ascending: true }),
      // I-1: wersje importu harmonogramu (RLS schedule_imports_hhl — tylko HHL; pozostali: 0 wierszy)
      sb.from('schedule_imports').select('id,version,file_name,stats,imported_at').order('version', { ascending: false }).limit(20),
      // 0076 (PLAN §1.5): dane kierowcy nie są kolumnami loads dla API — tylko HHL i przewoźnik transportu (RPC); inni: 0 wierszy
      sb.rpc('load_driver_contacts'),
      // 0081 (SCOPE 6.5): zgodność powiązanych zezwoleń z wymiarami zestawu — tylko transporty z zezwoleniem
      sb.rpc('load_permit_status'),
      // 9.4 (0094): reguły automatyzacji — RLS wf_all: tylko HHL_ADMIN (pozostali: 0 wierszy); przebiegi — odczyt HHL
      sb.from('workflows').select('id,name,description,trigger_type,condition,actions,enabled').order('code', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      sb.from('workflow_runs').select('id,workflow_id,load_id,status,result,ran_at').order('id', { ascending: false }).limit(1000),
    ]);
    const wfRuns = (wfRunQ.error ? [] : wfRunQ.data ?? []) as WorkflowRunDbRow[];
    const okBy = new Map<string, number>();
    for (const r of wfRuns) if (r.status === 'OK') okBy.set(r.workflow_id, (okBy.get(r.workflow_id) ?? 0) + 1);
    const permitOk = new Map(((permitQ.error ? [] : permitQ.data ?? []) as { load_id: string; permits_linked: number; ok: boolean }[])
      .filter((p) => p.permits_linked > 0).map((p) => [p.load_id, p.ok]));
    const drivers = new Map(((driversQ.error ? [] : driversQ.data ?? []) as { load_id: string; driver_name: string | null; driver_phone: string | null }[])
      .map((d) => [d.load_id, d]));
    const docRows = must(docs, 'documents') as DocumentRow[];
    const costBy = new Map((must(costV, 'v_load_price_carrier') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    const revBy = new Map((must(revV, 'v_load_price_client') as unknown as PriceViewRow[]).map((r) => [r.load_id, r]));
    return {
      ...emptySnapshot(),
      workflows: ((wfQ.error ? [] : wfQ.data ?? []) as WorkflowDbRow[]).map((r) => workflowFromRow(r, okBy.get(r.id) ?? 0)),
      workflowRuns: wfRuns.map(workflowRunFromRow),
      loads: (must(loads, 'loads') as unknown as LoadRow[])
        .map((r) => ({ ...r, driver_name: drivers.get(r.id)?.driver_name ?? null, driver_phone: drivers.get(r.id)?.driver_phone ?? null }))
        .map((r, i) => applyPriceViews(loadFromRow(r, orgs, i, at), costBy.get(r.id), revBy.get(r.id)))
        .map((l) => (permitOk.has(l.id) ? { ...l, permitFits: permitOk.get(l.id) ?? null } : l)),
      events: (must(events, 'load_events') as EventRow[]).map(eventFromRow),
      messages: (must(messages, 'load_messages') as MessageRow[]).map(messageFromRow),
      geofences: (must(geos, 'v_geofences_circle') as GeofenceRow[]).map((g) => geofenceFromRow(g, orgs)),
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
  async function loadPreferences(): Promise<UserPrefsPatch | null> {
    const r = await sb.from('user_preferences').select('display_currency,locale,theme').maybeSingle();
    if (r.error) throw new Error(`user_preferences: ${r.error.message}`);
    if (!r.data) return null;
    const d = r.data as { display_currency: string; locale: string; theme: string | null };
    return {
      displayCurrency: d.display_currency === 'PLN' ? 'PLN' : 'EUR',
      locale: (['pl', 'en', 'sv'].includes(d.locale) ? d.locale : 'pl') as UserPrefsPatch['locale'],
      theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : null,
    };
  }
  async function savePreferences(p: UserPrefsPatch): Promise<void> {
    const row: Record<string, unknown> = { user_id: await myUserId(), updated_at: new Date().toISOString() };
    if (p.displayCurrency) row.display_currency = p.displayCurrency;
    if (p.locale) row.locale = p.locale;
    if ('theme' in p) row.theme = p.theme ?? null;
    const r = await sb.from('user_preferences').upsert(row, { onConflict: 'user_id' }).select('user_id');
    if (r.error) throw new Error(`user_preferences: ${r.error.message}`);
  }

  async function apply(m: DataMutation): Promise<{ id?: string } | void> {
    switch (m.type) {
      case 'load.status': {
        const db = statusToDb(m.status);
        if (!db) return;
        // STATUSY_AUTOMATYCZNE §3.3 — UNLOADED wyłącznie razem z datą rozładunku (jedna zmiana)
        const patch: Record<string, unknown> = db === 'UNLOADED'
          ? { status: db, actual_delivery_at: m.unloadedAt ?? new Date().toISOString() }
          : { status: db };
        await updateLoad(m.loadId, patch, 'status');
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
        const res = await sb.from('load_messages').insert({ load_id: m.loadId, body: m.text }).select('id').single();
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
        const up = await sb.storage.from(row.bucket).upload(row.object_path, m.file, { contentType: 'application/pdf', upsert: false });
        if (up.error) {
          await sb.rpc('discard_document', { p_id: row.id });
          throw new Error(`faktura PDF: ${up.error.message}`);
        }
        const res = await sb.rpc('register_invoice', { p: billToRpc(m.bill, row.id) });
        if (res.error) {
          // odrzucona rejestracja: najpierw plik (discard_document wymaga braku obiektu), potem wiersz
          await sb.storage.from(row.bucket).remove([row.object_path]);
          await sb.rpc('discard_document', { p_id: row.id });
          throw new Error(res.error.message);
        }
        return { id: String(res.data) };
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
        const res = await sb.from('workflows').insert({ ...workflowToDb(m.rule), project_id: projectId }).select('id').single();
        return { id: (must(res, 'reguła') as { id: string }).id };
      }
      case 'workflow.update': {
        const res = await sb.from('workflows').update(workflowToDb(m.patch)).eq('id', m.id).select('id');
        if (!(must(res, 'reguła') as { id: string }[]).length) throw new Error('reguła: zmienia wyłącznie administrator HHL');
        return;
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

  return { kind: 'supabase', loadSnapshot, apply, loadPreferences, context: () => ({ orgs, projectId }) };
}
