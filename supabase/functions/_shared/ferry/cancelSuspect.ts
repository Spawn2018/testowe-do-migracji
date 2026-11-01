/**
 * BN3 decyzja 61 — „podejrzenie odwołania”: ETA+45 bez ATA albo zniknięcie z Portnet
 * + AIS stoi w porcie Zatoki Fińskiej → FERRY MEDIUM (bez zmiany statusu rejsu).
 * Viking / Eckerö / Finbo / Tallink · trasy TLL↔HEL / TLLA↔HEL / MUU↔VUO.
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
export const CANCEL_SUSPECT_MAX_SOG_KN = 0.5;
export const CANCEL_SUSPECT_RADIUS_KM = 3;
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
  /* Helsinki West Harbour (Länsisatama) — Tallink TLL-HEL */
  { code: 'HEL', lat: 60.153, lon: 24.915 },
  /* Helsinki Katajanokka / Eteläsatama — Viking TLLA-HEL */
  { code: 'HEL_ES', lat: 60.167, lon: 24.968 },
  /* Tallinn Vanasadam A/D */
  { code: 'TLL', lat: 59.443, lon: 24.77 },
  { code: 'TLL_D', lat: 59.440, lon: 24.775 },
  /* Vuosaari / Muuga */
  { code: 'VUO', lat: 60.206, lon: 25.19 },
  { code: 'MUU', lat: 59.497, lon: 24.96 },
];

export function isGulfFerryRoute(route: string): boolean {
  return GULF_FERRY_ROUTES.has(route as FerryRoute);
}

/** SOG ≈ 0 i pozycja ≤ radiusKm od dowolnego hubu zatoki. */
export function isStandingInGulfPort(
  fix: Pick<VesselFix, 'lat' | 'lon' | 'sogKn'>,
  maxSogKn = CANCEL_SUSPECT_MAX_SOG_KN,
  radiusKm = CANCEL_SUSPECT_RADIUS_KM,
  hubs: readonly { lat: number; lon: number }[] = GULF_PORT_HUBS,
): boolean {
  if ((fix.sogKn ?? 0) > maxSogKn) return false;
  return hubs.some((h) => distanceKm(fix.lat, fix.lon, h.lat, h.lon) <= radiusKm);
}

/** true gdy now ≥ ETA + graceMin. */
export function cancelSuspectDue(
  etaIso: string,
  nowMs: number,
  graceMin = CANCEL_SUSPECT_GRACE_MIN,
): boolean {
  const eta = Date.parse(etaIso);
  if (!Number.isFinite(eta)) return false;
  return nowMs >= eta + graceMin * 60_000;
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
 * `activeIds === null` → nie oceniaj (awaria Portnet).
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
 * Czy sprawdzać AIS: ETA+45 bez ATA **lub** zniknięcie Portnet po planowym odejściu.
 * Nie zmienia statusu — tylko sygnał do ryzyka.
 */
export function cancelSuspectTrigger(o: {
  etaIso: string;
  departureIso: string;
  nowMs: number;
  sourceRef?: string | null;
  activePortCallIds?: Set<string> | null;
  graceMin?: number;
}): { due: boolean; disappeared: boolean; check: boolean } {
  const due = cancelSuspectDue(o.etaIso, o.nowMs, o.graceMin);
  const depPast = Date.parse(o.departureIso) < o.nowMs;
  const disappeared = depPast
    && portCallDisappeared(o.sourceRef, o.activePortCallIds ?? null);
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

/** Najbliższy hub (do detail); null gdy poza radiusKm. */
export function nearestGulfHub(
  lat: number,
  lon: number,
  radiusKm = CANCEL_SUSPECT_RADIUS_KM,
): { code: string; km: number } | null {
  let best: { code: string; km: number } | null = null;
  for (const h of GULF_PORT_HUBS) {
    const km = distanceKm(lat, lon, h.lat, h.lon);
    if (km > radiusKm) continue;
    if (!best || km < best.km) best = { code: h.code, km };
  }
  return best;
}
