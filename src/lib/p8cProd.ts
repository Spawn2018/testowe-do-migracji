/**
 * #413 / E34 Z1–Z2 — źródło Stref na produkcji (store + upsert_geofence_circle).
 * #505: route z bazy (v_geofences_circle / p_route); powód → tower.audit_reason.
 * Historia: brak RPC audit dla geofences → pusta tablica (lepiej pusto niż zmyślone).
 */
import { useTowerStore } from '../store/useTowerStore';
import type { Geofence, GeofenceType, LoadEvent } from '../types';
import { accountRole } from './accountRole';
import { getNowIso } from './frozenNow';
import { canEditGeofence } from './permissions';
import { edgeM, routeOf, type ZoneChange, type ZoneRoute, type ZoneRow } from './p8cZones';
import { trackingPhase } from './stageTiles';

type NearPos = { code: string; lat: number; lng: number; at: string; label: string };
type ZoneDraft = {
  name: string; type: GeofenceType; country: 'PL' | 'SE'; route: ZoneRoute | null;
  lat: number; lng: number; radiusM: number; hysteresisM: number; samplesRequired: number; dwellMin: number;
};

const LAST_KIND: Record<string, 'ENTER' | 'EXIT' | 'DWELL'> = {
  GEOFENCE_ENTER: 'ENTER',
  GEOFENCE_EXIT: 'EXIT',
  GEOFENCE_DWELL: 'DWELL',
};

function lastFor(zoneId: string, events: LoadEvent[], codeOf: Map<string, string>): ZoneRow['last'] {
  let best: ZoneRow['last'] = null;
  for (const e of events) {
    const kind = LAST_KIND[e.type];
    if (!kind) continue;
    if (String(e.payload?.geofence_id ?? '') !== zoneId) continue;
    if (!best || e.at > best.at) {
      best = { code: codeOf.get(e.loadId) ?? e.loadId, kind, at: e.at };
    }
  }
  return best;
}

function toRow(g: Geofence, events: LoadEvent[], codeOf: Map<string, string>): ZoneRow {
  /* #505: route z kolumny; routeOf tylko gdy baza null (stare wiersze / nieportowe). */
  return {
    ...g,
    route: routeOf({ name: g.name, type: g.type, route: g.route ?? null }),
    last: lastFor(g.id, events, codeOf),
  };
}

async function prodZones(): Promise<ZoneRow[]> {
  const s = useTowerStore.getState();
  const codeOf = new Map(s.loads.map((l) => [l.id, l.code]));
  return s.geofences.map((g) => toRow(g, s.events, codeOf));
}

async function prodHistory(_id: string): Promise<ZoneChange[]> {
  /* E34 Z1.7: brak RPC historii geofences — pusta lista (nie zmyślamy wpisów). */
  return [];
}

async function prodNear(id: string): Promise<NearPos[]> {
  const s = useTowerStore.getState();
  const z = s.geofences.find((g) => g.id === id);
  if (!z) return [];
  const now = getNowIso();
  const labelOf = (status: string): string => {
    if (status === 'APPROACHING_SITE' || status === 'DELIVERED') return 'rozładunek';
    if (status === 'LOADING') return 'załadunek';
    if (status === 'AT_PORT' || status === 'AT_PORT_SE' || status === 'ON_FERRY') return 'postój';
    return 'w drodze';
  };
  return pickNearLoads(
    s.loads.filter((l) => trackingPhase(l, now) === 'on'),
    z,
    labelOf,
  );
}

/** #413 F7: edgeM ≤ 5 km (także wnętrze dużych stref); tylko z lastFixAt. */
export function pickNearLoads(
  loads: { code: string; lat: number; lng: number; status: string; etaDetail?: { lastFixAt?: string | null } | null }[],
  z: { lat: number; lng: number; radiusM: number },
  labelOf: (status: string) => string,
): NearPos[] {
  return loads
    .filter((l) => (l.lat !== 0 || l.lng !== 0) && Number.isFinite(l.lat) && Number.isFinite(l.lng))
    .filter((l) => Boolean(l.etaDetail?.lastFixAt))
    .filter((l) => edgeM(l, z) <= 5_000)
    .map((l) => ({
      code: l.code,
      lat: l.lat,
      lng: l.lng,
      at: l.etaDetail!.lastFixAt!,
      label: labelOf(l.status),
    }));
}

async function prodSaveZone(
  id: string | null,
  z: ZoneDraft,
  reason: string,
): Promise<{ ok: boolean; zone?: ZoneRow; error?: string }> {
  const store = useTowerStore.getState();
  const old = id ? store.geofences.find((g) => g.id === id) : null;
  const port = z.type === 'PORT_OUT' || z.type === 'PRE_PORT' || z.type === 'PORT_IN';
  const row: Geofence = {
    id: old?.id ?? `geo-${Date.now().toString(36)}`,
    name: z.name,
    type: z.type,
    shape: 'circle',
    lat: z.lat,
    lng: z.lng,
    radiusM: z.radiusM,
    hysteresisM: z.hysteresisM,
    samplesRequired: z.samplesRequired,
    dwellMin: z.dwellMin,
    country: z.country,
    route: port ? z.route : null,
    notifyHhl: old?.notifyHhl ?? false,
    notifyKsh: old?.notifyKsh ?? false,
    notifyScx: old?.notifyScx ?? false,
    active: old?.active ?? true,
    trigger: old?.trigger ?? 'ENTER',
  };
  try {
    store.saveGeofence(row, reason);
    const codeOf = new Map(store.loads.map((l) => [l.id, l.code]));
    return { ok: true, zone: toRow(row, store.events, codeOf) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'zapis nieudany' };
  }
}

async function prodSetActive(id: string, active: boolean, reason: string): Promise<{ ok: boolean }> {
  const store = useTowerStore.getState();
  const g = store.geofences.find((x) => x.id === id);
  if (!g) return { ok: false };
  try {
    store.saveGeofence({ ...g, active }, reason);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function prodZonesSource() {
  /* jak canManageWorkflows w p8dProd: zapis tylko Administrator HHL (profil), nie sam widok HHL */
  const admin = canEditGeofence('HHL') && accountRole('HHL') === 'HHL_ADMIN';
  return {
    zones: prodZones,
    history: prodHistory,
    near: prodNear,
    saveZone: admin ? prodSaveZone : null,
    setActive: admin ? prodSetActive : null,
  };
}
