/**
 * BK3 — mapowanie wierszy Supabase (schemat 0001/0006) ↔ typy aplikacji.
 * Czyste funkcje (bez klienta Supabase) — testowane jednostkowo.
 */
import { mechanismIssue, type MoneySideV2 } from '../lib/money/loadMoney';
import type {
  Awizacja, Bill, BillFlag, BillPayment, BillVerification, CorridorStage, DocCategory, Document, FerryBooking, Geofence, GeofenceType, Load,
  LoadEvent, LoadMessage, LoadResources, LoadStatus, Notification, OrgKind, Risk, RiskType, Severity,
} from '../types';
import { PROGRESS_OF, STATUS_TO_STAGE, positionAlong } from '../lib/status';
import { renderNotice, asLocale } from '../../supabase/functions/_shared/notifyTemplates';
import { applyEtaToLoad } from '../lib/eta';
import { shows } from '../lib/prodFacade';
import { autoRiskCode } from '../lib/sailings';
import type { Sailing } from '../types';

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
  shipment_code: string; item_type: string | null; length_m: number | string | null; width_m: number | string | null;
  height_m: number | string | null; cargo_class?: string | null; total_weight_t: number | string | null; unit_weight_t: number | string | null;
  qty: number; assembly_seq: number | null;
}
export interface LoadRow {
  id: string; order_no: string | null; carrier_org_id: string | null; status: string;
  plan_load_date: string | null; plan_load_from: string | null; plan_load_to: string | null;
  plan_delivery_date: string | null; plan_delivery_from: string | null; plan_delivery_to: string | null;
  /** I-18 (0061) */
  plan_dates_status?: string | null; plan_dates_confirmed_at?: string | null;
  tractor_plate: string | null; trailer_plate: string | null; driver_name: string | null; driver_phone: string | null;
  escort_vehicles: number | null; ferry_booking_ref: string | null; sailing_id?: string | null;
  telematics_vehicle_id?: string | null;
  /** Rejs (AN1): jedno źródło prawdy — `sailings` przez `loads.sailing_id` (embed PostgREST). */
  sailings?: SailingRow | null;
  combo_length_m: number | string | null; combo_width_m: number | string | null; combo_height_m: number | string | null;
  combo_weight_t: number | string | null; delay_minutes: number | null; eta_site: string | null;
  /** I-2d (0051): ETA v1 liczone w bazie. */
  eta_confidence_min?: number | null; eta_basis?: EtaBasis | null; eta_computed_at?: string | null;
  hhl_order_no?: string | null; carrier_order_no?: string | null;
  actual_delivery_at?: string | null;
  shipment_items?: ShipmentItemRow[];
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export interface EtaBasis {
  method?: string; segment?: string; flags?: string[]; sailing?: string | null;
  segments?: Array<Record<string, unknown>>; computed_at?: string;
}

/** I-2d: pasmo ufności (minuty) → poziom. ≤60 min WYSOKA, ≤240 ŚREDNIA, inaczej NISKA. */
export function etaConfidenceFromMinutes(min: number | null | undefined): 'HIGH' | 'MED' | 'LOW' {
  if (min === null || min === undefined) return 'LOW';
  if (min <= 60) return 'HIGH';
  if (min <= 240) return 'MED';
  return 'LOW';
}

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
    ...(item?.cargo_class === 'STANDARD' ? { cargoClass: 'STANDARD' as const } : {}),
  };
  const resources: LoadResources = {
    driverName: row.driver_name, driverPhone: row.driver_phone,
    tractorPlate: row.tractor_plate, trailerPlate: row.trailer_plate,
    escort: (row.escort_vehicles ?? 0) > 0, escortPlate: null,
    setLengthM: num(row.combo_length_m), setWidthM: num(row.combo_width_m),
    setHeightM: num(row.combo_height_m), setWeightT: num(row.combo_weight_t),
    trackingRef: row.telematics_vehicle_id ?? null,
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
    ...(row.plan_dates_status ? { planDates: {
      status: row.plan_dates_status === 'POTWIERDZONA' ? 'POTWIERDZONA' as const : 'WSTEPNA' as const, confirmedAt: row.plan_dates_confirmed_at ?? null,
      loadFrom: row.plan_load_from, loadTo: row.plan_load_to, deliveryFrom: row.plan_delivery_from, deliveryTo: row.plan_delivery_to,
      preLoading: ['PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY'].includes(row.status) } } : {}),
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
    delayMinutesDb: row.delay_minutes ?? null,
    docMissing: row.status === 'DOCS_PENDING',
    permitFits: null,
    orderNo: row.order_no,
    hhlOrderNo: row.hhl_order_no ?? null,
    carrierOrderNo: row.carrier_order_no ?? null,
    unloadedAt: row.actual_delivery_at ?? null,
    sailingId: row.sailing_id ?? null,
  };
  // I-2d: ETA v1 z bazy (0051) — klient niczego nie dolicza (zero fasady).
  if (row.eta_basis || !shows('clientEta')) {
    const nowMs = Date.parse(nowIso);
    const etaMs = row.eta_site ? Date.parse(row.eta_site) : NaN;
    const conf = row.eta_confidence_min ?? null;
    const h = (ms: number) => Math.round((ms / 3600000) * 10) / 10;
    return {
      ...base,
      etaConfidence: etaConfidenceFromMinutes(conf),
      etaConfMin: conf,
      etaEarliestHours: Number.isFinite(etaMs) ? Math.max(0, h(etaMs - (conf ?? 0) * 60000 - nowMs)) : 0,
      etaLatestHours: Number.isFinite(etaMs) ? Math.max(0, h(etaMs + (conf ?? 0) * 60000 - nowMs)) : 0,
      etaReasons: row.eta_basis?.flags ?? [],
      etaMethod: row.eta_basis?.method ?? 'ETA v1 (baza)',
      etaUpdatedAt: row.eta_computed_at ?? nowIso,
    };
  }
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
  if ('trackingRef' in p) out.telematics_vehicle_id = p.trackingRef;
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
    ...(e.actor === 'driver-pwa' ? { source: 'DRIVER_PWA' } : {}),
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
export interface RiskRow { id: string; load_id: string | null; kind: string; severity: string; title: string; title_key?: string | null; detail: Record<string, unknown> | null; detected_at: string; dedup_key?: string | null }
const RISK_TYPE: Record<string, RiskType> = {
  FERRY: 'FERRY', WEATHER: 'FORCE_MAJEURE', ROAD_SE: 'ROAD_SE', ROAD_PL: 'OPS', PERMIT: 'DOC', INSURANCE: 'DOC',
  DOC_MISSING: 'DOC', SILENT_VEHICLE: 'OPS', ETA_BREACH: 'OPS', RESOURCE_MISSING: 'OPS', SEQUENCE: 'OPS', INVOICE_MISMATCH: 'OPS',
  AUTO_STATUS: 'OPS', LOADING_UNCONFIRMED: 'OPS', USAGE_LIMIT: 'OPS', JOB_FAILURE: 'OPS', DATES_UNCONFIRMED: 'OPS',
};
const SEVERITY: Record<string, Severity> = { INFO: 'LOW', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };
export function riskFromRow(r: RiskRow, nowIso: string): Risk {
  const d = (r.detail ?? {}) as Record<string, unknown>;
  const owner = (['HHL', 'KSH', 'SCX'].includes(String(d.owner)) ? d.owner : 'HHL') as OrgKind;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const params = (d.params && typeof d.params === 'object' ? d.params : {}) as Record<string, unknown>;
  return {
    id: r.id, type: RISK_TYPE[r.kind] ?? 'OPS', severity: SEVERITY[r.severity] ?? 'LOW', title: r.title,
    /* M12 — ryzyka z funkcji Edge: opis / ostrzeżenia źródła i atrybucja (Digitraffic CC BY 4.0) */
    detail: [str(d.text) || str(d.detail) || str(d.opis) || (Array.isArray(d.ostrzezenia) ? d.ostrzezenia.map(String).join(' · ') : ''), str(d.atrybucja)].filter(Boolean).join(' · '),
    loadId: r.load_id ?? undefined, owner,
    meta: str(d.meta), nextAction: str(d.next_action),
    ageHours: Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(r.detected_at)) / 36e5)),
    /* M10 — rodzaj ryzyka automatu / rejsu z klucza deduplikacji (0004) */
    code: autoRiskCode(r.kind, r.dedup_key),
    /* A6-T1 — tekst w języku odbiorcy: klucz + parametry (0042) */
    titleKey: r.title_key ?? undefined,
    titleParams: params,
    metaKey: str(d.meta_key) || undefined,
    metaParams: params,
  };
}

// ---- rejsy (M10) --------------------------------------------------------------
export interface SailingDbRow {
  id: string; route: string; departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null; status: string; source: string;
  vessels?: { name: string } | null;
}
export const SAILING_COLUMNS = 'id,route,departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status,source,vessels(name)';
export function sailingFromRow(r: SailingDbRow): Sailing {
  const name = r.vessels?.name ?? '';
  return {
    id: r.id, vessel: vesselFromDb(name) ?? name.replace(/^M\/F\s+/i, ''),
    route: r.route === 'NYN-GDN' ? 'NYN-GDN' : 'GDN-NYN',
    departureAt: r.departure_at, arrivalAt: r.arrival_at,
    delayedDepartureAt: r.delayed_departure_at, delayedArrivalAt: r.delayed_arrival_at,
    status: r.status === 'ODWOLANY' ? 'ODWOLANY' : r.status === 'OPOZNIONY' ? 'OPOZNIONY' : 'ZAPLANOWANY',
    source: r.source === 'POLFERRIES' ? 'POLFERRIES' : r.source === 'DANE_STARTOWE' ? 'DANE_STARTOWE' : 'RECZNIE',
  };
}
export function sailingToRow(s: Sailing): Record<string, unknown> {
  return {
    route: s.route, departure_at: s.departureAt, arrival_at: s.arrivalAt,
    delayed_departure_at: s.delayedDepartureAt, delayed_arrival_at: s.delayedArrivalAt, status: s.status, source: s.source,
  };
}

export interface DocumentRow {
  id: string; load_id: string | null; category: string; file_name: string; mime_type: string | null;
  size_bytes: number | null; valid_until: string | null; visible_to: string[] | null; uploaded_at: string;
  storage_path?: string | null;
  version?: number | null; superseded_at?: string | null;
}
const DOC_CAT: Record<string, DocCategory> = {
  PERMIT_PL: 'PERMIT_PL', PERMIT_SE: 'PERMIT_SE', INSURANCE: 'INSURANCE', CMR: 'CMR', POD: 'POD',
  LASHING_PHOTO: 'LASHING_PHOTOS', SPEC: 'DRAWING', INVOICE: 'INVOICE',
};
/** Kategoria aplikacji → `doc_category` bazy (BK4: rejestracja pliku). */
export const DOC_CAT_TO_DB: Record<DocCategory, string> = {
  PERMIT_PL: 'PERMIT_PL', PERMIT_SE: 'PERMIT_SE', INSURANCE: 'INSURANCE', CMR: 'CMR', POD: 'POD',
  LASHING_PHOTOS: 'LASHING_PHOTO', DRAWING: 'SPEC', INVOICE: 'INVOICE',
};
/** Metadane dokumentu; plik w Storage (BK4) pod `storage_path`. Kategorie bez odpowiednika w UI → pominięte (null). */
export function documentFromRow(r: DocumentRow): Document | null {
  const category = DOC_CAT[r.category];
  if (!category || !r.load_id) return null;
  return {
    id: r.id, loadId: r.load_id, category, name: r.file_name, uploadedAt: r.uploaded_at,
    deadline: r.valid_until, status: 'UPLOADED', permitFits: null,
    visibleTo: (r.visible_to ?? []).map(orgKindToApp).filter((k): k is OrgKind => k !== null),
    dataUrl: null, mimeType: r.mime_type, bytes: r.size_bytes, source: 'tower',
    storagePath: r.storage_path && r.storage_path !== '-' ? r.storage_path : null,
    version: r.version ?? 1, superseded: Boolean(r.superseded_at),
  };
}

/* ------------------------------------------------------------------ */
/* M2 — ceny z widoków rolowych v2 (0010). Tabele load_cost/load_revenue */
/* są zamknięte; każdy widok zwraca wyłącznie wiersze dozwolone roli.    */
/* ------------------------------------------------------------------ */
export interface PriceViewRow {
  load_id: string; pricing_tier: string | null;
  base_amount: number | string | null; baf_amount: number | string | null; extras_amount: number | string | null;
  computed_total_eur: number | string | null; invoiced_total_eur: number | string | null; effective_total_eur: number | string | null;
  fuel_ref_date: string | null; fuel_mult_sek: number | string | null; fuel_mult_pln: number | string | null; fuel_applied_mult: number | string | null;
  fx_table_no: string | null; fx_effective_date: string | null; fx_rate_pln: number | string | null; fx_provisional: boolean | null;
}

export const PRICE_VIEW_COLUMNS =
  'load_id,pricing_tier,base_amount,baf_amount,extras_amount,computed_total_eur,invoiced_total_eur,effective_total_eur,' +
  'fuel_ref_date,fuel_mult_sek,fuel_mult_pln,fuel_applied_mult,fx_table_no,fx_effective_date,fx_rate_pln,fx_provisional';

const TIERS = ['PROGNOZA', 'REALIZACJA', 'FAKTURA'] as const;
type Tier = (typeof TIERS)[number];
const tierOf = (t: string | null): Tier => (TIERS as readonly string[]).includes(t ?? '') ? (t as Tier) : 'PROGNOZA';

function sideFromView(r: PriceViewRow): MoneySideV2 {
  const computed = num(r.computed_total_eur) ?? num(r.effective_total_eur) ?? 0;
  return {
    tier: tierOf(r.pricing_tier),
    computedEur: computed,
    invoicedEur: num(r.invoiced_total_eur),
    fuel: {
      refDate: r.fuel_ref_date ?? '',
      multSek: num(r.fuel_mult_sek) ?? 1, multPln: num(r.fuel_mult_pln) ?? 1, applied: num(r.fuel_applied_mult) ?? 1,
    },
    fx: { tableNo: r.fx_table_no ?? '', mid: num(r.fx_rate_pln) ?? 0, date: r.fx_effective_date ?? '', provisional: Boolean(r.fx_provisional) },
  };
}

/** Strona niewidoczna dla roli = zero (nie dane demo) — marża tylko, gdy widać obie strony. */
export function applyPriceViews(load: Load, cost?: PriceViewRow, rev?: PriceViewRow): Load {
  if (!cost && !rev) return load;
  const eff = (r?: PriceViewRow) => (r ? num(r.effective_total_eur) ?? 0 : 0);
  const costTotal = eff(cost);
  const revTotal = eff(rev);
  const both = Boolean(cost && rev);
  const margin = both ? Math.round((revTotal - costTotal) * 100) / 100 : 0;
  const empty: MoneySideV2 = { tier: 'PROGNOZA', computedEur: 0, invoicedEur: null, fuel: { refDate: '', multSek: 1, multPln: 1, applied: 1 }, fx: { tableNo: '', mid: 0, date: '', provisional: true } };
  const c = cost ? sideFromView(cost) : empty;
  const r = rev ? sideFromView(rev) : empty;
  const tier: Tier = both ? TIERS[Math.min(TIERS.indexOf(c.tier), TIERS.indexOf(r.tier))] : (cost ? c.tier : r.tier);
  return {
    ...load,
    pricing: {
      ...load.pricing,
      costBase: cost ? num(cost.base_amount) ?? 0 : 0, revBase: rev ? num(rev.base_amount) ?? 0 : 0,
      costSefs: cost ? num(cost.baf_amount) ?? 0 : 0, revSefs: rev ? num(rev.baf_amount) ?? 0 : 0,
      costBaf: cost ? num(cost.baf_amount) ?? 0 : 0, revBaf: rev ? num(rev.baf_amount) ?? 0 : 0,
      costExtras: cost ? num(cost.extras_amount) ?? 0 : 0, revExtras: rev ? num(rev.extras_amount) ?? 0 : 0,
      costTotal, revTotal, margin,
      marginPct: both && revTotal > 0 ? margin / revTotal : 0,
      belowThreshold: both && revTotal > 0 ? margin / revTotal < 0.12 : false,
      currency: 'EUR',
      baf_multiplier: c.fuel.applied, mult_sek: c.fuel.multSek, mult_pln: c.fuel.multPln,
      money: { v: 2, tier, cost: c, rev: r },
      /* M8 — niezmiennik także na migawkach z bazy (HHL widzi obie strony) */
      moneyError: both ? mechanismIssue({ v: 2, tier, cost: c, rev: r }) : null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* M6 — faktury v2 (invoices z kierunkiem + invoice_lines; 0003/0014)   */
/* ------------------------------------------------------------------ */
export interface BillLineRow {
  load_id: string; invoiced_net: number | string | null; invoiced_fuel: number | string | null;
  fx_table_no: string | null; fx_mid: number | string | null; fx_effective_date: string | null;
  expected_amount: number | string | null; flags: string[] | null;
}
export interface BillRow {
  id: string; direction: string; issuer_org_id: string | null; recipient_org_id: string | null;
  invoice_number: string | null; issue_date: string | null; receipt_date: string | null; week_key: string | null;
  currency: string | null; net_total: number | string | null; vat_total: number | string | null; gross_total: number | string | null;
  due_date: string | null; due_date_from_document: boolean | null; verification_status: string; dispute_note: string | null;
  payment_status: string; paid_at: string | null; document_id: string | null; check_flags: string[] | null;
  missing_load_ids: string[] | null; submitted_at: string | null; invoice_lines: BillLineRow[] | null;
}
export const BILL_COLUMNS =
  'id,direction,issuer_org_id,recipient_org_id,invoice_number,issue_date,receipt_date,week_key,currency,net_total,vat_total,' +
  'gross_total,due_date,due_date_from_document,verification_status,dispute_note,payment_status,paid_at,document_id,check_flags,' +
  'missing_load_ids,submitted_at,invoice_lines(load_id,invoiced_net,invoiced_fuel,fx_table_no,fx_mid,fx_effective_date,expected_amount,flags)';

const numOrNull = (v: number | string | null | undefined): number | null => (v == null || v === '' ? null : Number(v));
const orgKindById = (orgs: OrgRow[], id: string | null): OrgKind => orgKindToApp(orgs.find((o) => o.id === id)?.kind ?? '') ?? 'HHL';

export function billFromRow(r: BillRow, orgs: OrgRow[], docs: { id: string; file_name: string; storage_path?: string | null }[]): Bill | null {
  if (r.direction !== 'KOSZT' && r.direction !== 'PRZYCHOD') return null;
  const pdf = r.document_id ? docs.find((d) => d.id === r.document_id) : undefined;
  return {
    id: r.id, direction: r.direction, issuer: orgKindById(orgs, r.issuer_org_id), recipient: orgKindById(orgs, r.recipient_org_id),
    number: r.invoice_number ?? '', issueDate: r.issue_date ?? '', receiptDate: r.receipt_date, weekKey: r.week_key ?? '',
    currency: r.currency === 'PLN' ? 'PLN' : 'EUR',
    net: numOrNull(r.net_total) ?? 0, vat: numOrNull(r.vat_total) ?? 0, gross: numOrNull(r.gross_total) ?? 0,
    dueDate: r.due_date ?? '', dueFromDocument: Boolean(r.due_date_from_document),
    verification: r.verification_status as BillVerification, disputeNote: r.dispute_note,
    payment: r.payment_status as BillPayment, paidAt: r.paid_at,
    pdfDocId: r.document_id, pdfName: pdf?.file_name ?? null,
    pdfStoragePath: pdf?.storage_path && pdf.storage_path !== '-' ? pdf.storage_path : null,
    lines: (r.invoice_lines ?? []).map((l) => ({
      loadId: l.load_id, invoicedNet: numOrNull(l.invoiced_net) ?? 0, invoicedFuel: numOrNull(l.invoiced_fuel),
      fx: l.fx_mid != null && l.fx_table_no ? { tableNo: l.fx_table_no, mid: Number(l.fx_mid), effectiveDate: l.fx_effective_date ?? '' } : null,
      expectedNet: numOrNull(l.expected_amount), flags: (l.flags ?? []) as BillFlag[],
    })),
    headerFlags: r.check_flags ?? [], missingLoadIds: r.missing_load_ids ?? [], createdAt: r.submitted_at ?? '',
  };
}

/** Payload RPC `register_invoice` (kontrole liczy baza; OPLATA_PALIWOWA z kontroli aplikacji). */
export function billToRpc(b: Bill, documentId: string): Record<string, unknown> {
  return {
    direction: b.direction, currency: b.currency, invoice_number: b.number, issue_date: b.issueDate,
    receipt_date: b.receiptDate ?? null, week_key: b.weekKey, net_total: b.net, vat_total: b.vat, gross_total: b.gross,
    due_date: b.dueFromDocument ? b.dueDate : null, document_id: documentId,
    lines: b.lines.map((l) => ({
      load_id: l.loadId, invoiced_net: l.invoicedNet, invoiced_fuel: l.invoicedFuel ?? null,
      fx_table_no: l.fx?.tableNo ?? null, fx_mid: l.fx?.mid ?? null, fx_effective_date: l.fx?.effectiveDate ?? null,
      flags: l.flags.filter((f) => f === 'OPLATA_PALIWOWA'),
    })),
  };
}

/* M7 — centrum powiadomień: wiersze IN_APP bieżącego użytkownika (RLS) w jego języku */
export interface NotificationRow {
  id: number; template: string; payload: Record<string, unknown> | null; load_id: string | null;
  created_at: string; read_at: string | null;
}
export const NOTIFICATION_PREFIX = 'srv-';
export function notificationFromRow(r: NotificationRow, locale?: string): Notification {
  const n = renderNotice({ template: r.template, payload: r.payload ?? {} }, locale ? asLocale(locale) : undefined);
  const inv = (r.payload ?? {}).invoice_id;
  return {
    id: `${NOTIFICATION_PREFIX}${r.id}`, at: r.created_at, title: n.subject, body: n.body, severity: n.severity,
    loadId: r.load_id ?? undefined, read: Boolean(r.read_at),
    href: n.view ? { view: n.view, entityId: typeof inv === 'string' ? inv : undefined, loadId: r.load_id ?? undefined } : undefined,
  };
}
