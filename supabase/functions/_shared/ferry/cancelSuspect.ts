/**
 * BN3 decyzja 61 — „podejrzenie odwołania”: ETA+45 bez ATA albo zniknięcie z Portnet
 * + AIS stoi w **porcie wyjścia** Zatoki Fińskiej → FERRY MEDIUM (bez zmiany statusu rejsu).
 * Viking / Eckerö / Finbo / Tallink · trasy TLL↔HEL / TLLA↔HEL / MUU↔VUO.
 * F7 #696 r1: B1 hub wyjścia; B2 świeżość AIS; B3 brak SOG ≠ stoi; B5 komplet Portnet; B6 okno ETA+6 h.
 */
import { distanceKm, type VesselFix } from './digitraffic.ts';
import { DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX } from './digitrafficPortCalls.ts';
import type { FerryRoute } from './polferries.ts';
import type { RiskInput } from '../integrations/sync.ts';

/** Trasy Zatoki Fińskiej (ferryCatalog / polferries FerryRoute). */
export const GULF_FERRY_ROUTES: ReadonlySet<FerryRoute> = new Set([
  'TLL-HEL', 'HEL-TLL', 'TLLA-HEL', 'HELA-TLL', 'MUU-VUO', 'VUO-MUU',
]);

export const CANCEL_SUSPECT_GRACE_MIN = 45;
/** F7 #696 r1 B6: górna granica okna podejrzenia po ETA. */
export const CANCEL_SUSPECT_WINDOW_AFTER_ETA_H = 6;
export const CANCEL_SUSPECT_MAX_SOG_KN = 0.5;
export const CANCEL_SUSPECT_RADIUS_KM = 3;
/** F7 #696 r1 B2: pozycja AIS starsza → „nie wiadomo”. */
export const CANCEL_SUSPECT_MAX_AIS_AGE_MIN = 60;
export const CANCEL_SUSPECT_DEDUP_PREFIX = 'FERRY_CANCEL_SUSPECT:';

export const DIGITRAFFIC_AIS_LOCATIONS_URL =
  'https://meri.digitraffic.fi/api/ais/v1/locations';

export function digitrafficAisUrl(mmsi: number): string {
  return `${DIGITRAFFIC_AIS_LOCATIONS_URL}?mmsi=${mmsi}`;
}

/**
 * Huby portowe — współrzędne jak `ferryCatalog` FERRY_PORTS
 * (+ Katajanokka / Eteläsatama dla Terminal A, bo HEL w katalogu = Länsisatama).
 */
export const GULF_PORT_HUBS: readonly { code: string; lat: number; lon: number }[] = [
  /* Helsinki West Harbour (Länsisatama) — Tallink HEL-TLL */
  { code: 'HEL', lat: 60.153, lon: 24.915 },
  /* Helsinki Katajanokka / Eteläsatama — Viking HELA-TLL */
  { code: 'HEL_ES', lat: 60.167, lon: 24.968 },
  /* Tallinn Vanasadam A/D */
  { code: 'TLL', lat: 59.443, lon: 24.77 },
  { code: 'TLL_D', lat: 59.440, lon: 24.775 },
  /* Vuosaari / Muuga */
  { code: 'VUO', lat: 60.206, lon: 25.19 },
  { code: 'MUU', lat: 59.497, lon: 24.96 },
];

/** F7 #696 r1 B1: huby **portu wyjścia** (nie docelowego). */
export const DEPARTURE_HUB_CODES: Readonly<Record<string, readonly string[]>> = {
  'TLL-HEL': ['TLL', 'TLL_D'],
  'TLLA-HEL': ['TLL', 'TLL_D'],
  'HEL-TLL': ['HEL'],
  'HELA-TLL': ['HEL_ES'],
  'MUU-VUO': ['MUU'],
  'VUO-MUU': ['VUO'],
};

export function isGulfFerryRoute(route: string): boolean {
  return GULF_FERRY_ROUTES.has(route as FerryRoute);
}

export function departureHubsForRoute(
  route: string,
): readonly { code: string; lat: number; lon: number }[] {
  const codes = DEPARTURE_HUB_CODES[route];
  if (!codes?.length) return [];
  const set = new Set(codes);
  return GULF_PORT_HUBS.filter((h) => set.has(h.code));
}

/** F7 #696 r1 B2: timestamp AIS nie starszy niż maxAgeMin względem nowMs. */
export function aisFixFresh(
  fix: Pick<VesselFix, 'timestampUtc'>,
  nowMs: number,
  maxAgeMin = CANCEL_SUSPECT_MAX_AIS_AGE_MIN,
): boolean {
  const t = Date.parse(fix.timestampUtc);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= maxAgeMin * 60_000 && nowMs - t >= -5 * 60_000;
}

/** Alias dla joba: `nowIso` zamiast nowMs. */
export function isFreshAisFix(
  fix: Pick<VesselFix, 'timestampUtc'>,
  nowIso: string,
  maxAgeMin = CANCEL_SUSPECT_MAX_AIS_AGE_MIN,
): boolean {
  return aisFixFresh(fix, Date.parse(nowIso), maxAgeMin);
}

/**
 * F7 #696 r1 B5 / jak #688 completeForRemoval:
 * obie strony OK, obie mają niepustą tablicę portCalls → scalone id; inaczej null.
 */
export function mergePortCallIdsIfComplete(o: {
  etaOk: boolean;
  etdOk: boolean;
  etaJson: unknown;
  etdJson: unknown;
}): Set<string> | null {
  if (!o.etaOk || !o.etdOk) return null;
  const etaIds = collectPortCallIds(o.etaJson);
  const etdIds = collectPortCallIds(o.etdJson);
  if (etaIds.size === 0 || etdIds.size === 0) return null;
  const out = new Set<string>(etaIds);
  for (const id of etdIds) out.add(id);
  return out;
}

/**
 * SOG ≈ 0 i pozycja ≤ radiusKm od hubu **wyjścia**.
 * F7 #696 r1 B1/B3: brak SOG → nie stoi; huby tylko z trasy.
 */
export function isStandingAtDeparturePort(
  fix: Pick<VesselFix, 'lat' | 'lon' | 'sogKn'>,
  route: string,
  maxSogKn = CANCEL_SUSPECT_MAX_SOG_KN,
  radiusKm = CANCEL_SUSPECT_RADIUS_KM,
): boolean {
  if (fix.sogKn == null || !Number.isFinite(fix.sogKn)) return false;
  if (fix.sogKn > maxSogKn) return false;
  const hubs = departureHubsForRoute(route);
  if (!hubs.length) return false;
  return hubs.some((h) => distanceKm(fix.lat, fix.lon, h.lat, h.lon) <= radiusKm);
}

/** @deprecated F7 #696 r1 — używaj `isStandingAtDeparturePort`. Zostawione pod stare importy testów. */
export function isStandingInGulfPort(
  fix: Pick<VesselFix, 'lat' | 'lon' | 'sogKn'>,
  maxSogKn = CANCEL_SUSPECT_MAX_SOG_KN,
  radiusKm = CANCEL_SUSPECT_RADIUS_KM,
  hubs: readonly { lat: number; lon: number }[] = GULF_PORT_HUBS,
): boolean {
  if (fix.sogKn == null || !Number.isFinite(fix.sogKn)) return false;
  if (fix.sogKn > maxSogKn) return false;
  return hubs.some((h) => distanceKm(fix.lat, fix.lon, h.lat, h.lon) <= radiusKm);
}

/** true gdy now ∈ [ETA + graceMin, ETA + windowAfterEtaH]. */
export function cancelSuspectDue(
  etaIso: string,
  nowMs: number,
  graceMin = CANCEL_SUSPECT_GRACE_MIN,
  windowAfterEtaH = CANCEL_SUSPECT_WINDOW_AFTER_ETA_H,
): boolean {
  const eta = Date.parse(etaIso);
  if (!Number.isFinite(eta)) return false;
  const lo = eta + graceMin * 60_000;
  const hi = eta + windowAfterEtaH * 3600_000;
  return nowMs >= lo && nowMs <= hi;
}

export function collectPortCallIds(json: unknown): Set<string> {
  const ids = new Set<string>();
  if (!json || typeof json !== 'object' || !('portCalls' in json)) return ids;
  const list = (json as { portCalls?: unknown }).portCalls;
  if (!Array.isArray(list)) return ids;
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { portCallId?: unknown }).portCallId;
    if (id != null && id !== '') ids.add(String(id));
  }
  return ids;
}

/** `digitraffic:portcall:<id>:<route>` → id; inaczej null. */
export function portCallIdFromSourceRef(sourceRef: string | null | undefined): string | null {
  if (!sourceRef?.startsWith(DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX)) return null;
  const rest = sourceRef.slice(DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX.length);
  const id = rest.split(':')[0];
  return id || null;
}

/**
 * Zgłoszenie Portnet zniknęło z bieżącej puli (tylko rejsy z source_ref Digitraffic).
 * `activeIds === null` → nie oceniaj (awaria / niepełna pula — F7 #696 r1 B5).
 */
export function portCallDisappeared(
  sourceRef: string | null | undefined,
  activeIds: Set<string> | null,
): boolean {
  if (activeIds == null) return false;
  const id = portCallIdFromSourceRef(sourceRef);
  if (!id) return false;
  return !activeIds.has(id);
}

/**
 * Czy sprawdzać AIS: ETA w oknie grace…+6 h bez ATA **lub** zniknięcie Portnet po planowym odejściu
 * (w tym samym oknie ETA). Nie zmienia statusu — tylko sygnał do ryzyka.
 */
export function cancelSuspectTrigger(o: {
  etaIso: string;
  departureIso: string;
  nowMs: number;
  sourceRef?: string | null;
  activePortCallIds?: Set<string> | null;
  graceMin?: number;
  windowAfterEtaH?: number;
}): { due: boolean; disappeared: boolean; check: boolean } {
  const due = cancelSuspectDue(o.etaIso, o.nowMs, o.graceMin, o.windowAfterEtaH);
  const depPast = Date.parse(o.departureIso) < o.nowMs;
  const disappeared = due
    && depPast
    && portCallDisappeared(o.sourceRef, o.activePortCallIds ?? null);
  /* F7 #696 r1 B6: zniknięcie też tylko w oknie ETA (due). */
  return { due, disappeared, check: due || disappeared };
}

export function cancelSuspectRiskDedup(sailingId: string): string {
  return `${CANCEL_SUSPECT_DEDUP_PREFIX}AIS:${sailingId}`;
}

export function cancelSuspectRisk(o: {
  sailingId: string;
  vessel: string;
  route: string;
  departureAt: string;
  etaIso: string;
  reason: 'ETA_GRACE' | 'PORTCALL_GONE' | 'BOTH';
  hubCode?: string | null;
  sogKn?: number | null;
  nowIso: string;
}): RiskInput {
  return {
    kind: 'FERRY',
    severity: 'MEDIUM',
    title: `Podejrzenie odwołania: ${o.vessel} ${o.departureAt.slice(0, 16)} — AIS stoi w porcie, brak ATA (HHL)`,
    titleKey: 'rk_ferry_cancel_suspect',
    params: { vessel: o.vessel, dep: o.departureAt.slice(0, 16) },
    detail: {
      zrodlo: 'DIGITRAFFIC_AIS',
      powod: o.reason,
      trasa: o.route,
      eta: o.etaIso,
      hub: o.hubCode ?? null,
      sog_kn: o.sogKn ?? null,
      sailing_id: o.sailingId,
      detected_at: o.nowIso,
    },
    dedup: cancelSuspectRiskDedup(o.sailingId),
    sourceUrl: DIGITRAFFIC_AIS_LOCATIONS_URL,
  };
}

/** Najbliższy hub z listy (do detail); null gdy poza radiusKm. */
export function nearestHub(
  lat: number,
  lon: number,
  hubs: readonly { code: string; lat: number; lon: number }[],
  radiusKm = CANCEL_SUSPECT_RADIUS_KM,
): { code: string; km: number } | null {
  let best: { code: string; km: number } | null = null;
  for (const h of hubs) {
    const km = distanceKm(lat, lon, h.lat, h.lon);
    if (km > radiusKm) continue;
    if (!best || km < best.km) best = { code: h.code, km };
  }
  return best;
}

/**
 * Najbliższy hub. F7 #696 r1: opcjonalna lista hubów (wyjścia);
 * `radiusKm` może być `undefined` (job przekazuje hubs jako 4. arg).
 */
export function nearestGulfHub(
  lat: number,
  lon: number,
  radiusKm?: number,
  hubs: readonly { code: string; lat: number; lon: number }[] = GULF_PORT_HUBS,
): { code: string; km: number } | null {
  return nearestHub(lat, lon, hubs, radiusKm ?? CANCEL_SUSPECT_RADIUS_KM);
}
