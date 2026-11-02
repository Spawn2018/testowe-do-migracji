/**
 * BN3 (#573) / BN5 (#714) — Digitraffic winter-navigation v2 (IBNet)
 * + lekka obserwacja port-call v2 cancelled.
 * BN3: GET …/locations → FERRY_WINTER (ferry-portnet).
 * BN5 cz.3: te same lokalizacje → FERRY_ICE per rejs (ferry-weather; HIGH przy zawieszeniu).
 * Licencja CC BY 4.0 (Fintraffic Digitraffic). Nagłówek Digitraffic-User + gzip.
 * F7 #694 r1: bez ryzyka z v2 cancelled (DP-121); locode tylko z tras korytarza.
 */
import type { RiskInput } from '../integrations/sync.ts';
import { ROUTE_AIS_PORTS, type AisPortCode } from './digitraffic.ts';

export const WINTER_NAV_LOCATIONS_URL =
  'https://meri.digitraffic.fi/api/winter-navigation/v2/locations';
export const WINTER_NAV_ATTRIBUTION =
  'Zimowa nawigacja: Fintraffic Digitraffic IBNet, licencja CC BY 4.0';
/** BN5 — skrót atrybucji do marine_conditions / FERRY_ICE. */
export const FERRY_ICE_ATTRIBUTION = 'Fintraffic / digitraffic.fi (CC BY 4.0)';
export const PORT_CALL_V2_CANCELLED_URL =
  'https://meri.digitraffic.fi/api/port-call/v2/visits?status=cancelled&locode=FIHEL';

/**
 * UN/LOCODE portów tras korytarza (ferryCatalog / ferry_ports).
 * F7 #694 R1-B2: bez SEMMA / LTKLJ / LVRIX (spoza tras).
 * BN5 #714: FIHEL, EETLL, EEMUG, EEPLA, SEKPS, SESTO (+ SENYN).
 */
export const WINTER_NAV_WATCHED_LOCODES = [
  'FIHEL', 'EETLL', 'EEMUG', 'EEPLA',
  'SEKPS', 'SESTO', 'SEKAA', 'SENYN',
  'PLGDY', 'PLGDN',
] as const;

/** Kod portu Watch Tower → UN/LOCODE Digitraffic winter-nav (#714). */
export const PORT_TO_WINTER_LOCODE: Readonly<Partial<Record<AisPortCode, string>>> = {
  HEL: 'FIHEL',
  HELA: 'FIHEL',
  TLL: 'EETLL',
  TLLA: 'EETLL',
  MUU: 'EEMUG',
  PLD: 'EEPLA',
  KPS: 'SEKPS',
  STO: 'SESTO',
  NYN: 'SENYN',
  GDN: 'PLGDN',
  GDY: 'PLGDY',
  KAA: 'SEKAA',
  /* F7 #722 B1: Vuosaari = Port Helsinki → ten sam UN/LOCODE FIHEL. */
  VUO: 'FIHEL',
};

export type WinterNavHitKind = 'RESTRICTION' | 'SUSPENSION';

export interface WinterNavHit {
  locode: string;
  name: string;
  kind: WinterNavHitKind;
  summary: string;
  startTime: string | null;
  endTime: string | null;
}

export interface WinterNavParseResult {
  hits: WinterNavHit[];
  warnings: string[];
  lastUpdated: string | null;
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function parseWindow(raw: unknown): {
  startTime: string | null; endTime: string | null; summary: string;
} | null {
  const o = asObj(raw);
  if (!o) return null;
  const summary = str(o.textCompilation) ?? str(o.text) ?? str(o.reason) ?? str(o.dueTo) ?? '';
  if (!summary && !str(o.startTime) && !str(o.endTime)) return null;
  return {
    startTime: str(o.startTime),
    endTime: str(o.endTime),
    summary: summary || 'ograniczenie lodowe',
  };
}

/** Aktywne w chwili `nowMs`: start ≤ now < end (brak end = otwarte). */
export function isWinterNavWindowActive(
  startTime: string | null,
  endTime: string | null,
  nowMs: number,
): boolean {
  if (startTime) {
    const s = Date.parse(startTime);
    if (Number.isFinite(s) && s > nowMs) return false;
  }
  if (endTime) {
    const e = Date.parse(endTime);
    if (Number.isFinite(e) && e <= nowMs) return false;
  }
  return !!(startTime || endTime);
}

function locodesOf(list: string | null): string[] {
  if (!list) return [];
  return list.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export function winterNavRiskDedup(hit: WinterNavHit): string {
  return `FERRY_WINTER:${hit.locode}:${hit.kind}`;
}

export function winterNavIceRisk(hit: WinterNavHit, nowIso: string): RiskInput {
  const what = hit.kind === 'SUSPENSION' ? 'zawieszenie portu' : 'ograniczenie lodowe';
  return {
    kind: 'FERRY',
    severity: 'MEDIUM',
    title: `Zima: ${what} ${hit.name} (${hit.locode}) — ${hit.summary}; HHL weryfikuje wpływ na rejsy`,
    titleKey: 'rk_ferry_winter_nav',
    params: {
      kind: what,
      port: hit.name,
      locode: hit.locode,
      summary: hit.summary.slice(0, 80),
    },
    detail: {
      zrodlo: 'DIGITRAFFIC_WINTER',
      locode: hit.locode,
      port: hit.name,
      kind: hit.kind,
      text: hit.summary,
      start: hit.startTime,
      end: hit.endTime,
      atrybucja: WINTER_NAV_ATTRIBUTION,
      czas: nowIso,
    },
    dedup: winterNavRiskDedup(hit),
    sourceUrl: WINTER_NAV_LOCATIONS_URL,
  };
}

/** LOCODE wyjścia/przypłynięcia rejsu (oba końce); pusta trasa → []. */
export function winterLocodesForRoute(route: string | null | undefined): string[] {
  if (!route) return [];
  const ports = ROUTE_AIS_PORTS[route.trim().toUpperCase()];
  if (!ports) return [];
  const out: string[] = [];
  for (const code of [ports.dep, ports.arr]) {
    const loc = PORT_TO_WINTER_LOCODE[code];
    if (loc && !out.includes(loc)) out.push(loc);
  }
  return out;
}

export function ferryIceRiskDedup(sailingId: string, hit: WinterNavHit): string {
  return `FERRY_ICE:${sailingId}:${hit.locode}:${hit.kind}`;
}

/**
 * BN5 cz.3 — ryzyko FERRY_ICE per rejs (MEDIUM; HIGH przy zawieszeniu).
 * Bez klasy lodowej w `vessels` → informacja „sprawdź klasę lodową”, bez zgadywania.
 */
export function ferryIceRisk(args: {
  hit: WinterNavHit;
  sailingId: string;
  vessel: string;
  route: string;
  departureUtc: string;
  nowIso: string;
  /** Dziś zawsze false — kolumny ice class w vessels nie ma (#714 §8). */
  hasIceClass?: boolean;
}): RiskInput {
  const { hit } = args;
  const suspension = hit.kind === 'SUSPENSION';
  const what = suspension ? 'zawieszenie ruchu do portu' : 'ograniczenie lodowe';
  const since = hit.startTime ? hit.startTime.slice(0, 16) : '—';
  const checkClass = args.hasIceClass === true
    ? ''
    : ' — sprawdź klasę lodową statku';
  return {
    kind: 'FERRY',
    severity: suspension ? 'HIGH' : 'MEDIUM',
    title: `Lód: ${what} ${hit.name} (${hit.locode}) — ${hit.summary}; od ${since}`
      + ` (${args.vessel}${checkClass})`,
    titleKey: 'rk_ferry_ice',
    params: {
      kind: what,
      port: hit.name,
      locode: hit.locode,
      summary: hit.summary.slice(0, 80),
      vessel: args.vessel,
      since,
    },
    detail: {
      zrodlo: 'DIGITRAFFIC_ICE',
      locode: hit.locode,
      port: hit.name,
      kind: hit.kind,
      text: hit.summary,
      start: hit.startTime,
      end: hit.endTime,
      sailing_id: args.sailingId,
      trasa: args.route,
      odejscie: args.departureUtc,
      klasa_lodowa: args.hasIceClass === true ? 'znana' : 'brak — sprawdź klasę lodową statku',
      atrybucja: FERRY_ICE_ATTRIBUTION,
      czas: args.nowIso,
    },
    dedup: ferryIceRiskDedup(args.sailingId, hit),
    sourceUrl: WINTER_NAV_LOCATIONS_URL,
    validUntil: new Date(Date.parse(args.departureUtc) + 18 * 3600_000).toISOString(),
  };
}

/**
 * FeatureCollection winter-navigation/v2/locations → aktywne ograniczenia/zawieszenia
 * dla portów z WINTER_NAV_WATCHED_LOCODES.
 */
export function parseWinterNavigationLocations(
  json: unknown,
  nowIso: string,
): WinterNavParseResult {
  const warnings: string[] = [];
  const root = asObj(json);
  if (!root) {
    return { hits: [], warnings: ['Winter-nav: oczekiwano obiektu FeatureCollection (struktura)'], lastUpdated: null };
  }
  if (root.type != null && root.type !== 'FeatureCollection') {
    warnings.push(`Winter-nav: nieznany type=${String(root.type)} (struktura)`);
  }
  const features = asArr(root.features);
  const nowMs = Date.parse(nowIso);
  const watched = new Set<string>(WINTER_NAV_WATCHED_LOCODES);
  const hits: WinterNavHit[] = [];

  for (const feat of features) {
    const f = asObj(feat);
    const props = asObj(f?.properties);
    if (!props) continue;
    const name = str(props.name) ?? 'port';
    const locs = locodesOf(str(props.locodeList));
    const matched = locs.filter((l) => watched.has(l));
    if (!matched.length) continue;

    for (const [propKey, kind] of [
      ['restrictions', 'RESTRICTION'],
      ['suspensions', 'SUSPENSION'],
    ] as const) {
      for (const raw of asArr(props[propKey])) {
        const win = parseWindow(raw);
        if (!win) continue;
        if (!isWinterNavWindowActive(win.startTime, win.endTime, nowMs)) continue;
        for (const locode of matched) {
          hits.push({
            locode,
            name,
            kind,
            summary: win.summary,
            startTime: win.startTime,
            endTime: win.endTime,
          });
        }
      }
    }
  }

  return {
    hits,
    warnings,
    lastUpdated: str(root.lastUpdated),
  };
}

export interface PortCallV2CancelledProbe {
  hasFihel: boolean;
  count: number;
  warnings: string[];
}

/**
 * F7 #694 R1-B1: tylko sonda na observations — bez ryzyka.
 * Nieznana struktura → count 0 + jedno ostrzeżenie (nie count=1).
 */
export function portCallV2CancelledHasFihel(json: unknown): PortCallV2CancelledProbe {
  const warnings: string[] = [];
  if (json == null) {
    return { hasFihel: false, count: 0, warnings: ['port-call v2: pusta odpowiedź'] };
  }
  if (Array.isArray(json)) {
    return { hasFihel: json.length > 0, count: json.length, warnings: [] };
  }
  if (typeof json !== 'object') {
    return { hasFihel: false, count: 0, warnings: ['port-call v2: nieobiekt'] };
  }
  const o = json as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return { hasFihel: false, count: 0, warnings: [] };
  }
  let count = 0;
  if (Array.isArray(o.visits)) {
    count = o.visits.length;
  } else if (Array.isArray(o.features)) {
    count = o.features.length;
  } else if (Array.isArray(o.portCalls)) {
    count = o.portCalls.length;
  } else {
    warnings.push(`port-call v2 cancelled FIHEL: nieznane klucze ${keys.slice(0, 8).join(',')}`);
    count = 0;
  }
  return { hasFihel: count > 0, count, warnings };
}
