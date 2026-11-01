/**
 * BN9-c2 (#573) — ekrany po BN4: marker promu Bałtyku z trasą rejsu i pasek śledzenia „Na promie”.
 * Czyste funkcje (bez zapytań): dane rejsu z wiersza `ferry_sailings_map` (to samo RPC, które już czyta mapa),
 * pozycja statku z `AisPosition` (AIS albo pozycja szacowana z rozkładu, `estimate.ts`).
 */
import type { Locale } from '../types';
import type { AisPosition } from './ais';
import { bearing, type SailingMapRow } from './ferry/estimate';
import { portName } from './portName';
import { rpcPortName } from './ferryCatalog';
import { t, tp } from '../i18n/messages';
import { formatOpsDateTime } from './time';
import { etaDuration } from './etaDuration';
import { vesselKey } from './p9eGroups';
import { stageTileOf, trackingPhase } from './stageTiles';
import type { Load, Sailing } from '../types';

/** Rejs statku do dymka markera: porty (kody z bazy, np. `TLL_D`, `HEL_T2`) i ich współrzędne. */
export interface FerryVoyage {
  sailingId: string;
  route: string | null;
  depPort: string;
  arrPort: string;
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
}

const PORT_SEED = new Set(['GDN', 'GDY', 'NYN', 'KAA', 'TLL', 'MUU', 'PLD', 'HEL', 'VUO', 'STO', 'KPS']);

/** „TLL_D” → TLL, „TLL_A” → TLL + terminal A (jak `routeEnds`); kod spoza katalogu → null. */
function seedPort(code: string): { base: string; terminal?: string } | null {
  const [base, term] = String(code ?? '').toUpperCase().split('_');
  if (!PORT_SEED.has(base)) return null;
  return { base, terminal: term === 'A' ? 'A' : undefined };
}

/** Nazwa portu rejsu: „Tallinn”, „Tallinn A”, „Helsinki”; spoza katalogu — nazwa ze słownika z bazy albo kod. */
export function voyagePortName(locale: Locale, code: string): string {
  const s = seedPort(code);
  if (s) {
    const n = portName(locale, s.base);
    return s.terminal ? `${n} ${s.terminal}` : n;
  }
  return rpcPortName(code) ?? code;
}

/** „Tallinn → Helsinki” z portów rejsu (nie z kodów). */
export function voyageRouteText(locale: Locale, v: Pick<FerryVoyage, 'depPort' | 'arrPort'>): string {
  return `${voyagePortName(locale, v.depPort)} → ${voyagePortName(locale, v.arrPort)}`;
}

function toVoyage(r: SailingMapRow): FerryVoyage {
  return {
    sailingId: r.sailing_id,
    route: r.route,
    depPort: r.dep_port,
    arrPort: r.arr_port,
    depLat: r.dep_lat,
    depLng: r.dep_lon,
    arrLat: r.arr_lat,
    arrLng: r.arr_lon,
  };
}

/**
 * Rejs statku z wierszy `ferry_sailings_map`: trwający (wypłynął, nie dopłynął) albo najbliższy przyszły.
 * Odwołane i zakończone pomijane. Statek rozpoznany po `vessel_id`, MMSI albo nazwie (bez „M/F”).
 */
export function voyageOfVessel(
  rows: readonly SailingMapRow[],
  ship: Pick<AisPosition, 'vesselId' | 'mmsi' | 'name'>,
  nowMs: number,
): FerryVoyage | null {
  const key = vesselKey(ship.name);
  const mine = rows.filter((r) => r.vessel_id === ship.vesselId
    || (!!ship.mmsi && r.mmsi != null && String(r.mmsi) === ship.mmsi)
    || (!!key && vesselKey(r.vessel_name) === key));
  let ongoing: { r: SailingMapRow; dep: number } | null = null;
  let next: { r: SailingMapRow; dep: number } | null = null;
  for (const r of mine) {
    if (r.status === 'ODWOLANY' || r.arrived_at) continue;
    const dep = Date.parse(r.departed_at ?? r.departure_at ?? '');
    const arr = Date.parse(r.arrival_at ?? '');
    if (!Number.isFinite(dep)) continue;
    if (dep <= nowMs) {
      /* wypłynął (departed_at) i nie dopłynął — trwa także po planowym przypłynięciu (opóźnienie), żeby nie wskoczył powrót */
      if (!r.departed_at && Number.isFinite(arr) && nowMs >= arr) continue;
      if (!ongoing || dep < ongoing.dep) ongoing = { r, dep };
    } else if (!next || dep < next.dep) {
      next = { r, dep };
    }
  }
  const pick = ongoing ?? next;
  return pick ? toVoyage(pick.r) : null;
}

/** Dopina rejs do każdego markera statku (gdy da się go ustalić). Pozycje bez rejsu — bez zmian. */
export function withVoyages(markers: readonly AisPosition[], rows: readonly SailingMapRow[], nowMs: number): AisPosition[] {
  if (!rows.length) return markers.slice();
  return markers.map((m) => {
    const v = voyageOfVessel(rows, m, nowMs);
    return v ? { ...m, voyage: v } : m;
  });
}

/**
 * Kierunek strzałki markera promu: COG z AIS; bez COG — namiar port wyjścia → port przypłynięcia rejsu (każda trasa,
 * także GDN-NYN i GDY-KAA — DP-141). Statek bez wiersza rejsu — dotychczasowa reguła (demo: rejs z rozkładu, 20° / 200°).
 */
export function ferryMarkerHeading(
  p: Pick<AisPosition, 'cog' | 'vesselId' | 'voyage'>,
  liveSail: { vessel: string; depPort: string },
): number {
  if (typeof p.cog === 'number') return p.cog;
  const v = p.voyage;
  if (v) return Math.round(bearing(v.depLat, v.depLng, v.arrLat, v.arrLng));
  return p.vesselId === liveSail.vessel ? (liveSail.depPort === 'GDN' ? 20 : 200) : 20;
}

/** Nazwa statku w dymku: „M/F Megastar · Tallinn → Helsinki”; bez rejsu — jak dotąd (nazwa albo MMSI). */
export function ferryMarkerName(p: Pick<AisPosition, 'name' | 'mmsi' | 'voyage'>, locale: Locale): string {
  const name = p.name || p.mmsi;
  return p.voyage ? `${name} · ${voyageRouteText(locale, p.voyage)}` : name;
}

/* ---------- pasek śledzenia „Na promie” (karta transportu i PDF) ---------- */

/** Dane promu dla paska: statek, trasa (już nazwami portów) i pozycja statku. */
export interface FerryTrackInfo {
  vessel: string | null;
  route: string | null;
  pos:
    | { kind: 'ais'; ts: string }
    | { kind: 'est'; lastAisTs: string | null }
    | { kind: 'none' };
}

function agoText(fromIso: string, nowIso: string, locale: Locale): string {
  const m = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000));
  if (m < 1) return t(locale, 'p4b_ago_now');
  if (m < 60) return tp(locale, 'p4b_ago_min', { n: m });
  return tp(locale, 'p4b_ago_dur', { d: etaDuration(m) });
}

/** „Na promie · Megastar · Tallinn → Helsinki” + „pozycja statku z AIS 5 min temu · lokalizator naczepy na promie zwykle milknie”. */
export function ferryTrackingLines(info: FerryTrackInfo, locale: Locale, nowIso: string): { head: string; sub: string } {
  const head = [t(locale, 'bn9c2_trk_ferry'), info.vessel?.trim() || null, info.route?.trim() || null].filter(Boolean).join(' · ');
  const pos = info.pos.kind === 'ais'
    ? tp(locale, 'bn9c2_trk_ferry_ais', { ago: agoText(info.pos.ts, nowIso, locale) })
    : info.pos.kind === 'est'
      ? (info.pos.lastAisTs
        ? tp(locale, 'bn9c2_trk_ferry_est', { t: formatOpsDateTime(info.pos.lastAisTs) })
        : t(locale, 'bn9c2_trk_ferry_est_none'))
      : t(locale, 'bn9c2_trk_ferry_none');
  return { head, sub: `${pos} · ${t(locale, 'bn9c2_trk_ferry_note')}` };
}

/**
 * Pozycja statku dla paska: pozycja z bazy/AIS o tej samej nazwie statku (bez „M/F”), bez pozycji przykładowych.
 * Trasa: z rejsu przypiętego do ładunku (nazwy portów z kodu trasy), inaczej z rejsu markera statku.
 */
export function ferryTrackInfo(opts: {
  vessel: string | null;
  routeText: string | null;
  positions: readonly AisPosition[];
  locale: Locale;
}): FerryTrackInfo {
  const key = vesselKey(opts.vessel);
  const p = key ? opts.positions.find((x) => x.source !== 'seed' && vesselKey(x.name) === key) : undefined;
  const route = opts.routeText || (p?.voyage ? voyageRouteText(opts.locale, p.voyage) : null);
  const pos: FerryTrackInfo['pos'] = !p ? { kind: 'none' }
    : p.estimated ? { kind: 'est', lastAisTs: p.estimated.lastAisTs }
      : { kind: 'ais', ts: p.ts };
  return { vessel: opts.vessel ?? p?.name ?? null, route, pos };
}

/** Pasek „Na promie”: okno śledzenia trwa i transport jest w etapie promu (kafelek FERRY). */
export function ferryBarOn(load: Pick<Load, 'status' | 'stage' | 'plannedLoadDate'> | null | undefined, nowIso: string): boolean {
  return !!load && trackingPhase(load, nowIso) === 'on' && stageTileOf(load) === 'FERRY';
}

/**
 * Rejs ładunku: przypięty (`sailingId`); bez przypięcia — rejs tego statku (ta sama normalizacja nazwy co pozycja AIS,
 * `vesselKey`) o godzinie odejścia z rezerwacji (porównanie chwil, nie zapisu).
 */
export function loadSailing(
  load: Pick<Load, 'sailingId' | 'ferry'>,
  sailings: readonly Sailing[],
): Sailing | undefined {
  if (load.sailingId) return sailings.find((x) => x.id === load.sailingId);
  const key = vesselKey(load.ferry.vessel);
  const dep = Date.parse(load.ferry.departureAt ?? '');
  if (!key || !Number.isFinite(dep)) return undefined;
  return sailings.find((x) => vesselKey(x.vessel) === key && Date.parse(x.departureAt) === dep);
}
