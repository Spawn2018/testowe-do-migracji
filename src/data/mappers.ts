/**
 * BK3 — mapowanie wierszy Supabase (schemat 0001/0006) ↔ typy aplikacji.
 * Czyste funkcje (bez klienta Supabase) — testowane jednostkowo.
 */
import type {
  Awizacja, CorridorStage, DocCategory, Document, FerryBooking, Geofence, GeofenceType, Load,
  LoadEvent, LoadMessage, LoadResources, LoadStatus, OrgKind, Risk, RiskType, Severity,
} from '../types';
import { PROGRESS_OF, STATUS_TO_STAGE, positionAlong } from '../lib/status';
import { applyEtaToLoad } from '../lib/eta';

// ---- status ---------------------------------------------------------------
export type DbLoadStatus =
  | 'PLANNED' | 'RESOURCES_PENDING' | 'DOCS_PENDING' | 'READY' | 'AT_LOADING' | 'IN_TRANSIT_PL'
  | 'AT_PORT_GDANSK' | 'FERRY' | 'AT_PORT_NYNASHAMN' | 'IN_TRANSIT_SE' | 'AT_SITE' | 'UNLOADED'
  | 'DELIVERED' | 'CANCELLED';

const DB_TO_APP_STATUS: Record<DbLoadStatus, LoadStatus> = {
  PLANNED: 'PLANNED',
  RESOURCES_PENDING: 'RESOURCES_PENDING',
  DOCS_PENDING: 'DOC_MISSING',
  READY: 'READY',
  AT_LOADING: 'LOADING',
  IN_TRANSIT_PL: 'IN_TRANSIT_PL',
  AT_PORT_GDANSK: 'AT_PORT',
  FERRY: 'ON_FERRY',
  AT_PORT_NYNASHAMN: 'IN_TRANSIT_SE',
  IN_TRANSIT_SE: 'IN_TRANSIT_SE',
  AT_SITE: 'APPROACHING_SITE',
  UNLOADED: 'UNLOADING',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'PLANNED',
};

/** App → DB. DELAYED / SILENT to flagi, nie statusy w bazie → null (tylko zdarzenie). */
const APP_TO_DB_STATUS: Record<LoadStatus, DbLoadStatus | null> = {
  PLANNED: 'PLANNED',
  RESOURCES_PENDING: 'RESOURCES_PENDING',
  DOC_MISSING: 'DOCS_PENDING',
  READY: 'READY',
  LOADING: 'AT_LOADING',
  IN_TRANSIT_PL: 'IN_TRANSIT_PL',
  AT_PORT: 'AT_PORT_GDANSK',
  ON_FERRY: 'FERRY',
  IN_TRANSIT_SE: 'IN_TRANSIT_SE',
  APPROACHING_SITE: 'AT_SITE',
  UNLOADING: 'UNLOADED',
  DELIVERED: 'DELIVERED',
  DELAYED: null,
  SILENT: null,
};

export const statusFromDb = (s: string): LoadStatus => DB_TO_APP_STATUS[s as DbLoadStatus] ?? 'PLANNED';
export const statusToDb = (s: LoadStatus): DbLoadStatus | null => APP_TO_DB_STATUS[s] ?? null;

// ---- organizacje ----------------------------------------------------------
export interface OrgRow { id: string; code: string; kind: string }
const ORG_KIND_TO_APP: Record<string, OrgKind> = { FORWARDER: 'HHL', CLIENT: 'KSH', CARRIER: 'SCX' };
const APP_TO_ORG_KIND: Record<OrgKind, string> = { HHL: 'FORWARDER', KSH: 'CLIENT', SCX: 'CARRIER' };
export const orgKindToApp = (k: string): OrgKind | null => ORG_KIND_TO_APP[k] ?? null;
export const appToOrgKind = (k: OrgKind): string => APP_TO_ORG_KIND[k];
/** carrier_org_id → identyfikator aplikacji ('org-scx'). */
export const appOrgId = (orgs: OrgRow[], id: string | null): string => {
  const o = orgs.find((x) => x.id === id);
  return o ? `org-${o.code.toLowerCase()}` : '';
};

// ---- transport ------------------------------------------------------------
export interface ShipmentItemRow {
  shipment_code: string; item_type: string | null; length_m: number | string; width_m: number | string;
  height_m: number | string; total_weight_t: number | string | null; unit_weight_t: number | string | null;
  qty: number; assembly_seq: number | null;
}
export interface LoadRow {
  id: string; order_no: string | null; carrier_org_id: string | null; status: string;
  plan_load_date: string | null; plan_load_from: string | null; plan_load_to: string | null;
  plan_delivery_date: string | null; plan_delivery_from: string | null; plan_delivery_to: string | null;
  tractor_plate: string | null; trailer_plate: string | null; driver_name: string | null; driver_phone: string | null;
  escort_vehicles: number | null; ferry_booking_ref: string | null; sailing_id?: string | null;
  /** Rejs (AN1): jedno źródło prawdy — `sailings` przez `loads.sailing_id` (embed PostgREST). */
  sailings?: SailingRow | null;
  combo_length_m: number | string | null; combo_width_m: number | string | null; combo_height_m: number | string | null;
  combo_weight_t: number | string | null; delay_minutes: number | null; eta_site: string | null;
  hhl_order_no?: string | null; carrier_order_no?: string | null;
  shipment_items?: ShipmentItemRow[];
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export interface SailingRow {
  departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null;
  status: 'ZAPLANOWANY' | 'OPOZNIONY' | 'ODWOLANY' | string;
  vessels?: { name: string } | null;
}

/** `vessels.name` (np. „M/F Wawel”) → nazwa w UI. */
export function vesselFromDb(name: string | null | undefined): FerryBooking['vessel'] {
  if (!name) return null;
  const n = name.replace(/^M\/F\s+/i, '').trim().toLowerCase();
  return n === 'wawel' ? 'Wawel' : n === 'nova star' ? 'Nova Star' : null;
}
/** Nazwa w UI → `vessels.name` (seed `stegra.sql`). */
export const vesselToDb = (v: FerryBooking['vessel']): string | null =>
  v === 'Wawel' ? 'M/F Wawel' : v === 'Nova Star' ? 'M/F Nova Star' : null;

export function ferryFromRow(row: Pick<LoadRow, 'ferry_booking_ref' | 'sailings'>): FerryBooking {
  const s = row.sailings ?? null;
  if (!s) return { vessel: null, departureAt: null, arrivalAt: null, bookingRef: row.ferry_booking_ref, status: row.ferry_booking_ref ? 'BOOKED' : 'NONE' };
  return {
    vessel: vesselFromDb(s.vessels?.name),
    departureAt: s.delayed_departure_at ?? s.departure_at,
    arrivalAt: s.delayed_arrival_at ?? s.arrival_at,
    bookingRef: row.ferry_booking_ref,
    status: s.status === 'ODWOLANY' ? 'CANCELLED' : s.status === 'OPOZNIONY' ? 'DELAYED' : 'BOOKED',
  };
}

export function loadFromRow(row: LoadRow, orgs: OrgRow[], index: number, nowIso: string): Load {
  const item = [...(row.shipment_items ?? [])].sort((a, b) => (a.assembly_seq ?? 1e9) - (b.assembly_seq ?? 1e9))[0];
  const status = statusFromDb(row.status);
  const stage: CorridorStage = STATUS_TO_STAGE[status];
  const progress = PROGRESS_OF[status] ?? 0;
  const pos = positionAlong(progress);
  const dims = {
    lengthM: num(item?.length_m) ?? num(row.combo_length_m) ?? 0,
    widthM: num(item?.width_m) ?? num(row.combo_width_m) ?? 0,
    heightM: num(item?.height_m) ?? num(row.combo_height_m) ?? 0,
    weightT: num(item?.total_weight_t) ?? num(item?.unit_weight_t) ?? num(row.combo_weight_t) ?? 0,
  };
  const resources: LoadResources = {
    driverName: row.driver_name, driverPhone: row.driver_phone,
    tractorPlate: row.tractor_plate, trailerPlate: row.trailer_plate,
    escort: (row.escort_vehicles ?? 0) > 0, escortPlate: null,
    setLengthM: num(row.combo_length_m), setWidthM: num(row.combo_width_m),
    setHeightM: num(row.combo_height_m), setWeightT: num(row.combo_weight_t),
  };
  const awizacja: Awizacja = {
    loadWindowStart: row.plan_load_from, loadWindowEnd: row.plan_load_to,
    unloadWindowStart: row.plan_delivery_from, unloadWindowEnd: row.plan_delivery_to,
    confirmed: Boolean(row.plan_load_from && row.plan_load_to),
  };
  const ferry = ferryFromRow(row);
  const base: Load = {
    id: row.id,
    code: item?.shipment_code ?? row.order_no ?? row.id.slice(0, 8),
    itemType: item?.item_type ?? '',
    dims,
    qty: item?.qty ?? 1,
    status, stage, progress,
    plannedLoadDate: row.plan_load_date ?? '',
    plannedDeliverDate: row.plan_delivery_date ?? '',
    carrierId: appOrgId(orgs, row.carrier_org_id),
    resources, awizacja, ferry,
    // Ceny: wyłącznie widoki rolowe (Etap 4 / M-*) — tu zera, nie dane demo.
    pricing: {
      costBase: 0, revBase: 0, costSefs: 0, revSefs: 0, costBaf: 0, revBaf: 0, costExtras: 0, revExtras: 0,
      ferryEco: 0, costTotal: 0, revTotal: 0, margin: 0, marginPct: 0, belowThreshold: false, currency: 'EUR',
      baf_multiplier: 1, baf_source_week: '', price_sek: 0, price_pln: 0, mult_sek: 1, mult_pln: 1,
    },
    etaSegments: [], etaBoden: row.eta_site,
    etaConfidence: 'LOW', etaEarliestHours: 0, etaLatestHours: 0, etaReasons: [], etaMethod: 'server', etaUpdatedAt: nowIso,
    lat: pos.lat, lng: pos.lng, heading: pos.heading,
    silentMinutes: null,
    sequenceOrder: item?.assembly_seq ?? index + 1,
    sequenceRisk: false,
    delayed: (row.delay_minutes ?? 0) > 0,
    docMissing: row.status === 'DOCS_PENDING',
    permitFits: null,
    orderNo: row.order_no,
    hhlOrderNo: row.hhl_order_no ?? null,
    carrierOrderNo: row.carrier_order_no ?? null,
  };
  return applyEtaToLoad(base, nowIso);
}

/** Zmiany zasobów → kolumny `loads` (przywileje kolumnowe przewoźnika z 0001). */
export function resourcesPatchToDb(p: Partial<LoadResources>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('driverName' in p) out.driver_name = p.driverName;
  if ('driverPhone' in p) out.driver_phone = p.driverPhone;
  if ('tractorPlate' in p) out.tractor_plate = p.tractorPlate;
  if ('trailerPlate' in p) out.trailer_plate = p.trailerPlate;
  if ('escort' in p) out.escort_vehicles = p.escort ? 1 : 0;
  if ('setLengthM' in p) out.combo_length_m = p.setLengthM;
  if ('setWidthM' in p) out.combo_width_m = p.setWidthM;
  if ('setHeightM' in p) out.combo_height_m = p.setHeightM;
  if ('setWeightT' in p) out.combo_weight_t = p.setWeightT;
  return out;
}

export function awizacjaPatchToDb(p: Partial<Awizacja>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('loadWindowStart' in p) out.plan_load_from = p.loadWindowStart;
  if ('loadWindowEnd' in p) out.plan_load_to = p.loadWindowEnd;
  if ('unloadWindowStart' in p) out.plan_delivery_from = p.unloadWindowStart;
  if ('unloadWindowEnd' in p) out.plan_delivery_to = p.unloadWindowEnd;
  return out; // `confirmed` nie ma kolumny — zostaje w zdarzeniu AWIZACJA_UPDATED
}

/**
 * AN1: statek/godzina nie są już kolumnami `loads` — zapisujemy tylko numer rezerwacji
 * i (gdy provider rozwiązał rejs) `sailing_id`. Pełne przypisanie rejsu: M10.
 */
export function ferryPatchToDb(p: Partial<FerryBooking>, sailingId?: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('bookingRef' in p) out.ferry_booking_ref = p.bookingRef;
  if (sailingId !== undefined) out.sailing_id = sailingId;
  return out;
}

// ---- zdarzenia / wiadomości ------------------------------------------------
export interface EventRow { id: number | string; load_id: string; event_type: string; occurred_at: string; payload: Record<string, unknown> | null }
export function eventFromRow(r: EventRow): LoadEvent {
  const p = (r.payload ?? {}) as Record<string, unknown>;
  const { actor, note, ...rest } = p;
  return {
    id: `ev-${r.id}`, loadId: r.load_id, type: r.event_type, at: r.occurred_at,
    actor: typeof actor === 'string' ? actor : 'system',
    note: typeof note === 'string' ? note : undefined,
    payload: Object.keys(rest).length ? rest : undefined,
  };
}
export function eventToRow(e: Omit<LoadEvent, 'id'>): Record<string, unknown> {
  return {
    load_id: e.loadId, event_type: e.type, occurred_at: e.at,
    payload: { ...(e.payload ?? {}), actor: e.actor, ...(e.note ? { note: e.note } : {}) },
  };
}

export interface MessageRow { id: number | string; load_id: string; body: string; created_at: string; author_org: string | null }
export function messageFromRow(r: MessageRow): LoadMessage {
  const org = (['HHL', 'KSH', 'SCX'].includes(r.author_org ?? '') ? r.author_org : 'HHL') as OrgKind;
  return { id: `msg-${r.id}`, loadId: r.load_id, at: r.created_at, author: org, org, text: r.body };
}

// ---- strefy ---------------------------------------------------------------
export interface GeofenceRow {
  id: string; name: string; kind: string; hysteresis_m: number; dwell_seconds: number; debounce_fixes: number;
  notify_enter: boolean; notify_exit: boolean; notify_dwell: boolean; notify_orgs: string[] | null;
  active: boolean; lat: number; lng: number; radius_m: number;
}
const GEO_KINDS: GeofenceType[] = ['LOADING', 'PORT_OUT', 'PRE_PORT', 'PORT_IN', 'CHECKPOINT', 'PRE_ARRIVAL', 'SITE', 'REST'];
export function geofenceFromRow(r: GeofenceRow, orgs: OrgRow[]): Geofence {
  const kinds = new Set((r.notify_orgs ?? []).map((id) => orgKindToApp(orgs.find((o) => o.id === id)?.kind ?? '')));
  return {
    id: r.id, name: r.name,
    type: (GEO_KINDS as string[]).includes(r.kind) ? (r.kind as GeofenceType) : 'CHECKPOINT',
    shape: 'circle', lat: r.lat, lng: r.lng, radiusM: r.radius_m, hysteresisM: r.hysteresis_m,
    dwellMin: Math.round(r.dwell_seconds / 60), samplesRequired: r.debounce_fixes,
    notifyHhl: kinds.has('HHL'), notifyKsh: kinds.has('KSH'), notifyScx: kinds.has('SCX'),
    active: r.active,
    trigger: r.notify_dwell ? 'DWELL_EXCEEDED' : r.notify_exit ? 'EXIT' : 'ENTER',
  };
}
export function geofenceToRpc(g: Geofence, projectId: string, orgs: OrgRow[], serverId: string | null) {
  const orgIds = (kind: OrgKind) => orgs.filter((o) => orgKindToApp(o.kind) === kind).map((o) => o.id);
  return {
    p_id: serverId, p_project: projectId, p_name: g.name, p_kind: g.type,
    p_lat: g.lat, p_lng: g.lng, p_radius_m: Math.round(g.radiusM),
    p_hysteresis_m: Math.round(g.hysteresisM), p_dwell_seconds: Math.round(g.dwellMin * 60),
    p_debounce_fixes: g.samplesRequired,
    p_notify_enter: g.trigger === 'ENTER', p_notify_exit: g.trigger === 'EXIT', p_notify_dwell: g.trigger === 'DWELL_EXCEEDED',
    p_notify_orgs: [...(g.notifyHhl ? orgIds('HHL') : []), ...(g.notifyKsh ? orgIds('KSH') : []), ...(g.notifyScx ? orgIds('SCX') : [])],
    p_active: g.active,
  };
}

// ---- ryzyka / dokumenty -----------------------------------------------------
export interface RiskRow { id: string; load_id: string | null; kind: string; severity: string; title: string; detail: Record<string, unknown> | null; detected_at: string }
const RISK_TYPE: Record<string, RiskType> = {
  FERRY: 'FERRY', WEATHER: 'FORCE_MAJEURE', ROAD_SE: 'ROAD_SE', ROAD_PL: 'OPS', PERMIT: 'DOC', INSURANCE: 'DOC',
  DOC_MISSING: 'DOC', SILENT_VEHICLE: 'OPS', ETA_BREACH: 'OPS', RESOURCE_MISSING: 'OPS', SEQUENCE: 'OPS', INVOICE_MISMATCH: 'OPS',
};
const SEVERITY: Record<string, Severity> = { INFO: 'LOW', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };
export function riskFromRow(r: RiskRow, nowIso: string): Risk {
  const d = (r.detail ?? {}) as Record<string, unknown>;
  const owner = (['HHL', 'KSH', 'SCX'].includes(String(d.owner)) ? d.owner : 'HHL') as OrgKind;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: r.id, type: RISK_TYPE[r.kind] ?? 'OPS', severity: SEVERITY[r.severity] ?? 'LOW', title: r.title,
    detail: str(d.text) || str(d.detail), loadId: r.load_id ?? undefined, owner,
    meta: str(d.meta), nextAction: str(d.next_action),
    ageHours: Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(r.detected_at)) / 36e5)),
  };
}

export interface DocumentRow {
  id: string; load_id: string | null; category: string; file_name: string; mime_type: string | null;
  size_bytes: number | null; valid_until: string | null; visible_to: string[] | null; uploaded_at: string;
}
const DOC_CAT: Record<string, DocCategory> = {
  PERMIT_PL: 'PERMIT_PL', PERMIT_SE: 'PERMIT_SE', INSURANCE: 'INSURANCE', CMR: 'CMR', POD: 'POD',
  LASHING_PHOTO: 'LASHING_PHOTOS', SPEC: 'DRAWING', INVOICE: 'INVOICE',
};
/** Metadane dokumentu (pliki: BK4 Storage). Kategorie bez odpowiednika w UI → pominięte (null). */
export function documentFromRow(r: DocumentRow): Document | null {
  const category = DOC_CAT[r.category];
  if (!category || !r.load_id) return null;
  return {
    id: r.id, loadId: r.load_id, category, name: r.file_name, uploadedAt: r.uploaded_at,
    deadline: r.valid_until, status: 'UPLOADED', permitFits: null,
    visibleTo: (r.visible_to ?? []).map(orgKindToApp).filter((k): k is OrgKind => k !== null),
    dataUrl: null, mimeType: r.mime_type, bytes: r.size_bytes, source: 'tower',
  };
}
